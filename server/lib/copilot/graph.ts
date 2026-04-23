import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import type {
  BatchSummary,
  GoalInput,
  ProcessPlan,
} from "~~/shared/types/workflow-copilot";
import { generateProcessPlan, type DeepSeekConfig } from "./planner";
import { reviewPlan, type PlanReviewResult } from "./reviewer";

// ────────────────────────────────────────────────────────
// LangGraph 状态图编排器
// 将 Planner → Reviewer 组合成带条件回环的多节点状态图
//
// 状态图结构：
//   START → planner → reviewer → (approved? → END / → planner 回环)
//
// 最多执行 1 轮回环修正，防止无限循环
// ────────────────────────────────────────────────────────

// ── 定义 LangGraph 状态 Schema ──
// Annotation 描述了在状态图节点之间流转的数据结构

const CopilotState = Annotation.Root({
  // 输入
  goal: Annotation<GoalInput>,
  batch: Annotation<BatchSummary>,
  config: Annotation<DeepSeekConfig>,

  // 中间状态
  plan: Annotation<ProcessPlan | null>({
    default: () => null,
    reducer: (_prev, next) => next,
  }),
  review: Annotation<PlanReviewResult | null>({
    default: () => null,
    reducer: (_prev, next) => next,
  }),
  attempts: Annotation<number>({
    default: () => 0,
    reducer: (_prev, next) => next,
  }),

  // 输出
  finalPlan: Annotation<ProcessPlan | null>({
    default: () => null,
    reducer: (_prev, next) => next,
  }),
  reviewSummary: Annotation<string>({
    default: () => "",
    reducer: (_prev, next) => next,
  }),
});

// ── 定义节点处理函数 ──

/**
 * Planner 节点：调用 LangChain Chain 生成处理计划
 */
async function plannerNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  console.info(
    `[LangGraph] Planner 节点执行中... (第 ${state.attempts + 1} 次)`,
  );

  const plan = await generateProcessPlan(state.goal, state.batch, state.config);

  return {
    plan,
    attempts: state.attempts + 1,
  };
}

/**
 * Reviewer 节点：调用独立的 LangChain Chain 审计计划
 */
async function reviewerNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  if (!state.plan) {
    return {
      review: {
        approved: false,
        overallScore: 0,
        issues: [
          {
            stepId: "general",
            severity: "error",
            message: "Plan is null",
            fix: "Regenerate",
          },
        ],
        summary: "No plan to review",
      },
    };
  }

  console.info("[LangGraph] Reviewer 节点执行中...");

  const review = await reviewPlan(state.goal.text, state.plan, state.config);

  console.info(
    `[LangGraph] 审计结果: ${review.approved ? "✅ 通过" : "❌ 需修正"} (评分: ${review.overallScore})`,
  );

  return { review };
}

/**
 * 输出节点：确定最终计划
 */
async function outputNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  return {
    finalPlan: state.plan,
    reviewSummary: state.review?.summary ?? "",
  };
}

/**
 * 条件边：根据审计结果决定是 输出 还是 回环修正
 */
function shouldRetry(state: typeof CopilotState.State): string {
  const MAX_ATTEMPTS = 2;

  // 审计通过 → 直接输出
  if (state.review?.approved) {
    return "output";
  }

  // 未通过但已达最大尝试次数 → 仍然输出（降级）
  if (state.attempts >= MAX_ATTEMPTS) {
    console.warn(
      `[LangGraph] 审计未通过，但已达最大重试次数 (${MAX_ATTEMPTS})，降级输出`,
    );
    return "output";
  }

  // 未通过且还有重试机会 → 回环到 Planner
  console.info("[LangGraph] 审计未通过，回环到 Planner 重新生成...");
  return "planner";
}

/**
 * 构建并返回 LangGraph 状态图
 * 编排流程：START → planner → reviewer → 条件(approved? → output / → planner)
 */
function buildCopilotGraph() {
  const graph = new StateGraph(CopilotState)
    // 添加节点
    .addNode("planner", plannerNode)
    .addNode("reviewer", reviewerNode)
    .addNode("output", outputNode)

    // 添加边
    .addEdge(START, "planner") // 入口 → Planner
    .addEdge("planner", "reviewer") // Planner → Reviewer
    .addConditionalEdges("reviewer", shouldRetry, {
      output: "output", // 审计通过 → 输出
      planner: "planner", // 审计未通过 → 回环到 Planner
    })
    .addEdge("output", END); // 输出 → 结束

  return graph.compile();
}

// 编译后的状态图（单例复用，开发环境每次重建以适配 HMR）
let _compiledGraph: ReturnType<typeof buildCopilotGraph> | null = null;

function getCopilotGraph() {
  if (!_compiledGraph || import.meta.dev) {
    _compiledGraph = buildCopilotGraph();
  }
  return _compiledGraph;
}

// ── 对外暴露的接口 ──

export interface CopilotResult {
  plan: ProcessPlan;
  reviewSummary: string;
  attempts: number;
}

/**
 * 运行完整的 LangGraph Copilot 流程
 *
 * 编排流程：
 * 1. Planner 节点：LangChain Chain 生成结构化 ProcessPlan
 * 2. Reviewer 节点：独立 Chain 审计计划质量
 * 3. 条件边：通过 → 输出；未通过 → 回环 Planner 重新生成（最多 1 轮）
 *
 * @param goal 用户的自然语言目标
 * @param batch 图片批次摘要
 * @param config DeepSeek API 配置
 * @returns 经过审计的最终计划
 */
export async function runCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
): Promise<CopilotResult> {
  const graph = getCopilotGraph();

  const result = await graph.invoke({
    goal,
    batch,
    config,
    plan: null,
    review: null,
    attempts: 0,
    finalPlan: null,
    reviewSummary: "",
  });

  if (!result.finalPlan) {
    throw new Error("LangGraph 流程执行完毕但未生成有效计划");
  }

  return {
    plan: result.finalPlan,
    reviewSummary: result.reviewSummary,
    attempts: result.attempts,
  };
}

/**
 * 流式运行完整的 LangGraph Copilot 流程
 * 通过 SSE 将每个节点的执行状态下发给客户端，以展示真实进度
 */
export async function* streamCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
) {
  const graph = getCopilotGraph();

  const stream = await graph.stream({
    goal,
    batch,
    config,
    plan: null,
    review: null,
    attempts: 0,
    finalPlan: null,
    reviewSummary: "",
  });

  for await (const chunk of stream) {
    yield chunk;
  }
}
