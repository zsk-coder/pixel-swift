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

// ────────────────────────────────────────────────────────
// POST /api/workflow-copilot/plan
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
 * 扣减用户的免费试用次数（trial_used + 1）
 */
async function deductTrialUsage(event: H3Event, userId: string) {
  const supabase = serverSupabaseServiceRole(event);

  // 使用原子 RPC 操作避免竞态条件（如果有的话），否则用简单 update
  const { error } = await (supabase.rpc as any)("increment_trial_used", {
    p_user_id: userId,
  });

  // 如果 RPC 不存在，回退到直接更新的方式
  if (error) {
    console.warn(
      `[Copilot] RPC increment_trial_used 调用失败 (${error.message})，回退到直接 update`,
    );

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

  // ── 6. 运行 LangGraph Copilot 流程 (SSE 模式) ──
  const eventStream = createEventStream(event);

  // Background execution for streaming
  (async () => {
    try {
      const stream = streamCopilotGraph(goal, batch, deepseekConfig);

      for await (const chunk of stream) {
        eventStream.push({
          event: "message",
          data: JSON.stringify({ type: "progress", chunk }),
        });
      }

      // ── 7. 计划生成成功，扣减免费次数（仅 free 用户扣减） ──
      if (entitlement.plan_type === "free") {
        await deductTrialUsage(event, userId);
      }

      // ── 8. 返回成功结束标记 ──
      const remainingTrialCount =
        entitlement.plan_type === "pro"
          ? trialRemaining
          : Math.max(0, trialRemaining - 1);

      eventStream.push({
        event: "message",
        data: JSON.stringify({
          type: "complete",
          remainingTrialCount,
        }),
      });
    } catch (err) {
      console.error("[Copilot] LangGraph 规划失败:", err);
      // Prefer wrapping any unexpected internal Node errors as a standard unavailable key
      const message = "SERVER_ERROR.AI_UNAVAILABLE";
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
