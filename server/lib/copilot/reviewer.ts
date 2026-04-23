import { z } from "zod";
import { ChatDeepSeek } from "@langchain/deepseek";
import type { ProcessPlan } from "~~/shared/types/workflow-copilot";
import { reviewerPrompt, buildReviewMessage } from "./prompts";
import type { DeepSeekConfig } from "./planner";
import { createReviewerModel } from "./planner";

// ────────────────────────────────────────────────────────
// Plan Reviewer 审计模块
// 让第二条 LangChain Chain 审计第一条 Chain 的输出
// 实现"AI 审计 AI"的自我纠错模式
// ────────────────────────────────────────────────────────

// ── 审计结果的 Zod Schema ──

const reviewIssueSchema = z.object({
  stepId: z.string(),
  severity: z.enum(["error", "warning", "suggestion"]),
  message: z.string(),
  fix: z.string(),
});

const planReviewResultSchema = z.object({
  approved: z.boolean(),
  overallScore: z.number().min(0).max(100),
  issues: z.array(reviewIssueSchema),
  summary: z.string(),
});

export type PlanReviewResult = z.infer<typeof planReviewResultSchema>;

/**
 * 审计 AI 生成的处理计划
 *
 * 使用独立的 LangChain Chain 对规划器输出的 ProcessPlan 进行质量审计：
 * - 检查步骤的逻辑合理性（顺序、参数范围）
 * - 检查是否与用户目标矛盾
 * - 检查是否遗漏关键步骤
 *
 * @param goalText 用户的原始目标文本（用于对比计划是否偏题）
 * @param plan 规划器生成的处理计划
 * @param config DeepSeek API 配置
 * @returns 审计结果（approved + issues）
 */
export async function reviewPlan(
  goalText: string,
  plan: ProcessPlan,
  config: DeepSeekConfig,
): Promise<PlanReviewResult> {
  // 复用缓存的审计专用模型实例（温度 0.1，更严谨）
  const reviewModel = createReviewerModel(config);

  // 绑定结构化输出：审计结果 Schema
  const structuredReviewer = reviewModel.withStructuredOutput(
    planReviewResultSchema,
    { name: "PlanReviewResult" },
  );

  // 构建审计 Chain
  const reviewChain = reviewerPrompt.pipe(structuredReviewer);

  // 构建审计消息
  const reviewMessage = buildReviewMessage(
    goalText,
    plan as unknown as Record<string, unknown>,
  );

  try {
    const result = await reviewChain.invoke({ reviewMessage });
    return result as PlanReviewResult;
  } catch (err) {
    // 审计失败时降级为"无条件通过"，不阻塞主流程
    console.warn(
      "[Copilot Reviewer] 审计链调用失败，降级为自动通过:",
      err instanceof Error ? err.message : err,
    );
    return {
      approved: true,
      overallScore: 70,
      issues: [],
      summary: "审计服务暂时不可用，计划已自动通过",
    };
  }
}
