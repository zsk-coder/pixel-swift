import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from "#supabase/server";
import { type H3Event } from "h3";
import type { JwtPayload } from "@supabase/supabase-js";

import { isSupabaseServiceEnabled } from "~~/shared/utils/supabaseAuth";
import { ok, fail } from "../../utils/response";
import { ApiCode } from "~~/shared/types/api";
import { generatePlanRequestSchema } from "../../lib/copilot/schemas";
import { runCopilotGraph } from "../../lib/copilot/graph";
import type { UserEntitlementRow } from "../../lib/billing/trial";
import type { GeneratePlanResponse } from "~~/shared/types/workflow-copilot";

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
    return fail(ApiCode.SERVER_ERROR, "AI 服务尚未配置，请联系管理员");
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
    return fail(ApiCode.UNAUTHORIZED, "请先登录后再使用 AI 规划功能");
  }

  // ── 3. 配额检查 ──
  const entitlement = await getEntitlement(event, userId);
  if (!entitlement) {
    return fail(ApiCode.SERVER_ERROR, "用户配额数据异常，请稍后重试");
  }

  const trialRemaining = Math.max(
    0,
    entitlement.trial_total - entitlement.trial_used,
  );
  const canGenerate = entitlement.plan_type === "pro" || trialRemaining > 0;

  if (!canGenerate) {
    return fail(
      ApiCode.QUOTA_EXHAUSTED,
      "免费体验次数已用完，请升级 Pro 继续使用",
    );
  }

  // ── 4. 校验请求体 ──
  const body = await readBody(event);
  const parseResult = generatePlanRequestSchema.safeParse(body);

  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return fail(ApiCode.SERVER_ERROR, `请求参数不合法: ${issues}`);
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
    return fail(ApiCode.SERVER_ERROR, "AI 服务配置不完整，请联系管理员");
  }

  // ── 6. 运行 LangGraph Copilot 流程 ──
  // 编排：Planner Chain → Reviewer Chain → 条件回环（最多 1 轮自我修正）
  try {
    const result = await runCopilotGraph(goal, batch, deepseekConfig);

    console.info(
      `[Copilot] LangGraph 完成 — 尝试次数: ${result.attempts}, 审计摘要: ${result.reviewSummary}`,
    );

    // ── 7. 计划生成成功，扣减免费次数（仅 free 用户扣减） ──
    if (entitlement.plan_type === "free") {
      await deductTrialUsage(event, userId);
    }

    // ── 8. 返回成功响应 ──
    const remainingTrialCount =
      entitlement.plan_type === "pro"
        ? trialRemaining
        : Math.max(0, trialRemaining - 1);

    const responseData: GeneratePlanResponse = {
      plan: result.plan,
      remainingTrialCount,
    };

    return ok(responseData);
  } catch (err) {
    console.error("[Copilot] LangGraph 规划失败:", err);
    const message =
      err instanceof Error ? err.message : "AI 规划服务暂时不可用";
    return fail(ApiCode.SERVER_ERROR, message);
  }
});
