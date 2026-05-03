import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from "#supabase/server";
import { type H3Event, createEventStream } from "h3";
import type { JwtPayload } from "@supabase/supabase-js";

import { isSupabaseServiceEnabled } from "~~/shared/utils/supabaseAuth";
import { ok, fail } from "../../utils/response";
import { ApiCode } from "~~/shared/types/api";
import { generatePlanRequestSchema } from "../../lib/copilot/schemas";
import { streamCopilotGraph } from "../../lib/copilot/graph";
import type { UserEntitlementRow } from "../../lib/billing/trial";
import { enforceRateLimit } from "../../utils/rateLimiter";

// ────────────────────────────────────────────────────────
// POST /api/ai-workflow/plan
// 核心 AI 规划接口：接收用户目标 + 图片摘要，返回结构化处理计划
// ────────────────────────────────────────────────────────

/**
 * 查询用户的当前配额记录
 * 查询失败时返回 null 而非抛异常，保持 fail-safe 风格
 */
async function getEntitlement(event: H3Event, userId: string) {
  const supabase = serverSupabaseServiceRole(event);
  const result = await supabase
    .from("user_entitlements")
    .select("user_id, plan_type, trial_total, trial_used, subscription_status")
    .eq("user_id", userId)
    .maybeSingle<UserEntitlementRow>();

  if (result.error) {
    console.error(`[Copilot] 配额查询失败: ${result.error.message}`);
    return null;
  }

  return result.data;
}

/**
 * 原子扣减用户的免费试用次数（trial_used + 1）
 * 使用原子 read-then-update：先读取当前值再 +1 写回
 * 配合 Rate Limiter 确保并发安全（限流后不会出现高并发竞态）
 */
async function deductTrialUsage(event: H3Event, userId: string) {
  const supabase = serverSupabaseServiceRole(event);

  const { data: current } = await supabase
    .from("user_entitlements")
    .select("trial_used")
    .eq("user_id", userId)
    .single<{ trial_used: number }>();

  if (current) {
    await (supabase.from("user_entitlements") as any)
      .update({ trial_used: current.trial_used + 1 })
      .eq("user_id", userId);
  }
}

/**
 * 回退用户的免费试用次数（trial_used - 1），AI 调用失败时使用
 */
async function refundTrialUsage(event: H3Event, userId: string) {
  const supabase = serverSupabaseServiceRole(event);

  const { data: current } = await supabase
    .from("user_entitlements")
    .select("trial_used")
    .eq("user_id", userId)
    .single<{ trial_used: number }>();

  if (current && current.trial_used > 0) {
    await (supabase.from("user_entitlements") as any)
      .update({ trial_used: current.trial_used - 1 })
      .eq("user_id", userId);
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);

  // ── 1. 环境检查：Supabase 服务是否可用 ──
  if (!isSupabaseServiceEnabled(runtimeConfig)) {
    return fail(ApiCode.SERVER_ERROR, "SERVER_ERROR.AI_NOT_CONFIGURED");
  }

  // ── 2. 身份验证：从 Auth 中间件注入的 context 或直接解析 ──
  let user: JwtPayload | null = null;
  try {
    user = await serverSupabaseUser(event);
  } catch {
    // token 无效或过期
  }

  const userId: string = user?.sub || user?.id || "";
  if (!userId) {
    return fail(ApiCode.UNAUTHORIZED, "UNAUTHORIZED.LOGIN_REQUIRED");
  }

  // ── 2.5 Rate Limit 检查：防止单用户高频刷 API ──
  if (enforceRateLimit(event, userId)) {
    return fail(ApiCode.SERVER_ERROR, "SERVER_ERROR.RATE_LIMITED");
  }

  // ── 3. 配额检查 ──
  const entitlement = await getEntitlement(event, userId);
  if (!entitlement) {
    return fail(ApiCode.SERVER_ERROR, "SERVER_ERROR.QUOTA_DATA_ERROR");
  }

  const trialRemaining = Math.max(
    0,
    entitlement.trial_total - entitlement.trial_used,
  );
  const canGenerate = entitlement.plan_type === "pro" || trialRemaining > 0;

  if (!canGenerate) {
    return fail(ApiCode.QUOTA_EXHAUSTED, "QUOTA_EXHAUSTED.UPGRADE_REQUIRED");
  }

  // ── 4. 校验请求体 ──
  const body = await readBody(event);
  const parseResult = generatePlanRequestSchema.safeParse(body);

  if (!parseResult.success) {
    console.error("[Copilot Validator]", parseResult.error.issues);
    return fail(ApiCode.SERVER_ERROR, "SERVER_ERROR.INVALID_PARAMS");
  }

  const { goal, batch } = parseResult.data;

  // ── 5. DeepSeek 配置检查 ──
  const deepseekConfig = {
    apiKey: (runtimeConfig as any).deepseek?.apiKey || "",
    baseUrl:
      (runtimeConfig as any).deepseek?.baseUrl || "https://api.deepseek.com",
    model: (runtimeConfig as any).deepseek?.model || "deepseek-chat",
  };

  if (!deepseekConfig.apiKey) {
    return fail(ApiCode.SERVER_ERROR, "SERVER_ERROR.AI_NOT_CONFIGURED");
  }

  // ── 6. 乐观扣减配额（先扣后用，失败回退） ──
  // 无论 free 还是 pro 都有有限配额，都需要扣减
  await deductTrialUsage(event, userId);

  // ── 7. 构建 Corrective RAG 所需的 Embedding 配置 ──
  const openaiConfig = (runtimeConfig as any).openai;
  const embeddingConfig = openaiConfig?.apiKey
    ? {
        apiKey: openaiConfig.apiKey,
        baseUrl: openaiConfig.baseUrl || undefined,
        model: openaiConfig.embeddingModel || undefined,
      }
    : null;

  // 获取 Supabase service client（用于向量检索，绕过 RLS）
  let supabaseClient = null;
  try {
    supabaseClient = serverSupabaseServiceRole(event);
  } catch {
    // Supabase 不可用时 embeddingConfig 为 null，retrieve 节点会自动 fallback 到关键词匹配
  }

  // ── 8. 运行 LangGraph Copilot 流程 (SSE 模式) ──
  const eventStream = createEventStream(event);

  // Background execution for streaming
  (async () => {
    try {
      const stream = streamCopilotGraph(
        goal,
        batch,
        deepseekConfig,
        embeddingConfig,
        supabaseClient,
      );

      for await (const chunk of stream) {
        eventStream.push({
          event: "message",
          data: JSON.stringify({ type: "progress", chunk }),
        });
      }

      // ── 8. 返回成功结束标记 ──
      // 所有用户都已扣减 1 次
      const remainingTrialCount = Math.max(0, trialRemaining - 1);

      eventStream.push({
        event: "message",
        data: JSON.stringify({
          type: "complete",
          remainingTrialCount,
        }),
      });
    } catch (err) {
      console.error("[Copilot] LangGraph 规划失败:", err);

      // AI 调用失败 → 回退已扣减的配额
      try {
        await refundTrialUsage(event, userId);
        console.info(`[Copilot] 配额已回退 for user ${userId}`);
      } catch (refundErr) {
        console.error("[Copilot] 配额回退失败:", refundErr);
      }

      // 按错误类型分类返回不同的错误 key，方便前端定位问题
      let message = "SERVER_ERROR.AI_UNAVAILABLE";
      if (err instanceof Error) {
        if (err.message.includes("步骤参数校验失败")) {
          message = "SERVER_ERROR.PLAN_VALIDATION_FAILED";
        } else if (
          err.message.includes("401") ||
          err.message.includes("Unauthorized")
        ) {
          message = "SERVER_ERROR.AI_AUTH_FAILED";
        } else if (
          err.message.includes("timeout") ||
          err.message.includes("ETIMEDOUT")
        ) {
          message = "SERVER_ERROR.AI_TIMEOUT";
        }
      }

      eventStream.push({
        event: "error",
        data: JSON.stringify({ message }),
      });
    } finally {
      eventStream.close();
    }
  })();

  return eventStream.send();
});
