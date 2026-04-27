import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BatchSummary,
  GoalInput,
  ProcessPlan,
} from "~~/shared/types/workflow-copilot";
import { generateProcessPlan, type DeepSeekConfig } from "./planner";
import { reviewPlan, type PlanReviewResult } from "./reviewer";
import { retrieveKnowledge, type RetrievedKnowledge } from "./knowledge";
import { type EmbeddingConfig } from "./embeddings";
import { gradeRetrievedKnowledge } from "./retrieval-grader";
import { rewriteQuery } from "./query-rewriter";
import { createReviewerModel } from "./planner";

// ────────────────────────────────────────────────────────
// LangGraph 状态图编排器（Corrective RAG 升级版）
//
// 完整的 6 节点自纠错管道：
//
//   START
//     → retrieve       （向量语义检索知识片段）
//     → gradeKnowledge （LLM 评估检索结果相关性）
//     → [条件边: shouldRewriteQuery]
//         ├── 相关 → planner
//         ├── 不相关 + 未达上限 → rewriteQuery → retrieve（回环）
//         └── 不相关 + 达上限 → planner（降级继续）
//     → planner        （生成结构化处理计划）
//     → reviewer       （独立 LLM 审计计划质量）
//     → [条件边: shouldRetry]
//         ├── 通过 → output
//         └── 未通过 → planner（回环修正）
//     → output → END
//
// 两条条件回环边：
// 1. 检索质量回环：检索不相关 → 重写查询 → 再检索
// 2. 计划质量回环：审计未通过 → 重新生成计划
// ────────────────────────────────────────────────────────

// ── 定义 LangGraph 状态 Schema ──

const CopilotState = Annotation.Root({
  // ── 输入 ──
  goal: Annotation<GoalInput>,
  batch: Annotation<BatchSummary>,
  config: Annotation<DeepSeekConfig>,
  embeddingConfig: Annotation<EmbeddingConfig | null>,
  supabaseClient: Annotation<SupabaseClient | null>,

  // ── CRAG 检索状态 ──
  queryText: Annotation<string>({
    default: () => "",
    reducer: (_prev, next) => next,
  }),
  knowledge: Annotation<RetrievedKnowledge[]>({
    default: () => [],
    reducer: (_prev, next) => next,
  }),
  knowledgeRelevant: Annotation<boolean>({
    default: () => false,
    reducer: (_prev, next) => next,
  }),
  retrievalAttempts: Annotation<number>({
    default: () => 0,
    reducer: (_prev, next) => next,
  }),

  // ── 规划状态 ──
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

  // ── 节点元信息（通过 SSE 透传给前端，用于展示用户日志） ──
  lastNodeMeta: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_prev, next) => next,
  }),

  // ── 输出 ──
  finalPlan: Annotation<ProcessPlan | null>({
    default: () => null,
    reducer: (_prev, next) => next,
  }),
  reviewSummary: Annotation<string>({
    default: () => "",
    reducer: (_prev, next) => next,
  }),
});

// ── 节点 1: retrieve（向量语义检索） ──

/**
 * 使用当前 queryText 检索知识片段
 * 首次使用用户原始目标，重写后使用重写查询
 */
async function retrieveNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  const query = state.queryText || state.goal.text;
  console.info(
    `[LangGraph] Retrieve 节点执行中... (第 ${state.retrievalAttempts + 1} 次, 查询: "${query}")`,
  );

  const knowledge = await retrieveKnowledge(
    query,
    state.embeddingConfig,
    state.supabaseClient,
  );

  console.info(`[LangGraph] 检索到 ${knowledge.length} 条知识片段`);

  return {
    knowledge,
    queryText: query,
    retrievalAttempts: state.retrievalAttempts + 1,
    // 元信息透传给前端日志面板
    lastNodeMeta: {
      node: "retrieve",
      query,
      knowledgeCount: knowledge.length,
      knowledgeTitles: knowledge.map((k) => k.title),
    },
  };
}

// ── 节点 2: gradeKnowledge（LLM 评估检索相关性） ──

/**
 * 让 LLM 评估检索到的知识是否与用户目标相关
 * 使用独立的 Structured Output Chain（复用 Reviewer 的低温度模型）
 */
async function gradeKnowledgeNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  // 无知识片段 → 视为不相关，触发重写
  if (state.knowledge.length === 0) {
    console.info("[LangGraph] 无知识片段，标记为不相关");
    return {
      knowledgeRelevant: false,
      lastNodeMeta: {
        node: "gradeKnowledge",
        relevant: false,
        noKnowledge: true,
      },
    };
  }

  console.info("[LangGraph] GradeKnowledge 节点执行中...");

  // 拼接所有知识片段为一段文本，提交给 Grader 评估
  const knowledgeText = state.knowledge
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n");

  // 复用审计模型（低温度 0.1，更严谨的判断）
  const graderModel = createReviewerModel(state.config);
  const grade = await gradeRetrievedKnowledge(
    state.goal.text,
    knowledgeText,
    graderModel,
  );

  console.info(
    `[LangGraph] 相关性评估: ${grade.relevant ? "✅ 相关" : "❌ 不相关"} (置信度: ${grade.confidence}, 理由: ${grade.reason})`,
  );

  return {
    knowledgeRelevant: grade.relevant,
    // 元信息透传给前端日志面板
    lastNodeMeta: {
      node: "gradeKnowledge",
      relevant: grade.relevant,
    },
  };
}

// ── 节点 3: rewriteQuery（查询重写） ──

/**
 * 当检索结果不相关时，LLM 重写查询以提升下一轮检索命中率
 */
async function rewriteQueryNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  console.info("[LangGraph] RewriteQuery 节点执行中...");

  const graderModel = createReviewerModel(state.config);
  const result = await rewriteQuery(state.queryText, graderModel);

  return { queryText: result.rewrittenQuery };
}

// ── 节点 4: planner（生成处理计划） ──

/**
 * 调用 LangChain Chain 生成处理计划
 * 使用检索到的知识片段（从 state.knowledge 获取，不再自己检索）
 */
async function plannerNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  console.info(
    `[LangGraph] Planner 节点执行中... (第 ${state.attempts + 1} 次)`,
  );

  // 知识已由 retrieve 节点准备好，直接传入
  const plan = await generateProcessPlan(
    state.goal,
    state.batch,
    state.config,
    state.knowledge,
  );

  return {
    plan,
    attempts: state.attempts + 1,
  };
}

// ── 节点 5: reviewer（审计计划质量） ──

/**
 * 调用独立的 LangChain Chain 审计计划
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

  // 空步骤计划（用户请求了不支持的操作）→ 自动通过
  if (state.plan.steps.length === 0) {
    console.info("[LangGraph] 空步骤计划，跳过审计直接通过");
    return {
      review: {
        approved: true,
        overallScore: 100,
        issues: [],
        summary: "Empty-step plan auto-approved (unsupported operations)",
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

// ── 节点 6: output（确定最终计划） ──

async function outputNode(
  state: typeof CopilotState.State,
): Promise<Partial<typeof CopilotState.State>> {
  return {
    finalPlan: state.plan,
    reviewSummary: state.review?.summary ?? "",
  };
}

// ── 条件边 1: 检索质量回环判断 ──

/**
 * 根据 Grader 评估结果决定：
 * - 知识相关 → 进入 planner
 * - 知识不相关 + 未达重试上限 → 重写查询再检索
 * - 知识不相关 + 达上限 → 降级进入 planner
 */
function shouldRewriteQuery(state: typeof CopilotState.State): string {
  const MAX_RETRIEVAL_ATTEMPTS = 2;

  if (state.knowledgeRelevant) {
    return "planner";
  }

  if (state.retrievalAttempts >= MAX_RETRIEVAL_ATTEMPTS) {
    console.warn(
      `[LangGraph] 检索不相关，但已达最大重试次数 (${MAX_RETRIEVAL_ATTEMPTS})，降级进入 Planner`,
    );
    return "planner";
  }

  console.info("[LangGraph] 检索不相关，回环到 RewriteQuery 重写查询...");
  return "rewriteQuery";
}

// ── 条件边 2: 计划质量回环判断（保持原有逻辑） ──

function shouldRetry(state: typeof CopilotState.State): string {
  const MAX_ATTEMPTS = 2;

  if (state.review?.approved) {
    return "output";
  }

  if (state.attempts >= MAX_ATTEMPTS) {
    console.warn(
      `[LangGraph] 审计未通过，但已达最大重试次数 (${MAX_ATTEMPTS})，降级输出`,
    );
    return "output";
  }

  console.info("[LangGraph] 审计未通过，回环到 Planner 重新生成...");
  return "planner";
}

// ── 构建状态图 ──

/**
 * 构建完整的 6 节点 LangGraph 状态图
 *
 * 编排流程：
 * START → retrieve → gradeKnowledge → [条件] → planner → reviewer → [条件] → output → END
 *               ↑                        |                              |
 *               └── rewriteQuery ←───────┘ (检索回环)                    └── planner (计划回环)
 */
function buildCopilotGraph() {
  const graph = new StateGraph(CopilotState)
    // 添加 6 个节点
    .addNode("retrieve", retrieveNode)
    .addNode("gradeKnowledge", gradeKnowledgeNode)
    .addNode("rewriteQuery", rewriteQueryNode)
    .addNode("planner", plannerNode)
    .addNode("reviewer", reviewerNode)
    .addNode("output", outputNode)

    // 添加边
    .addEdge(START, "retrieve") // 入口 → 知识检索
    .addEdge("retrieve", "gradeKnowledge") // 检索 → 相关性评估

    // 条件边 1: 检索质量判断
    .addConditionalEdges("gradeKnowledge", shouldRewriteQuery, {
      planner: "planner", // 相关 → 规划
      rewriteQuery: "rewriteQuery", // 不相关 → 重写查询
    })
    .addEdge("rewriteQuery", "retrieve") // 重写后 → 重新检索（回环）

    .addEdge("planner", "reviewer") // 规划 → 审计

    // 条件边 2: 计划质量判断（保持原有逻辑）
    .addConditionalEdges("reviewer", shouldRetry, {
      output: "output", // 审计通过 → 输出
      planner: "planner", // 审计未通过 → 重新生成
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
 * 运行完整的 LangGraph Copilot 流程（Corrective RAG 升级版）
 *
 * 编排流程：
 * 1. Retrieve 节点：向量语义检索场景知识
 * 2. GradeKnowledge 节点：LLM 评估检索结果相关性
 * 3. [条件] 不相关 → RewriteQuery → 重新检索（最多 1 轮）
 * 4. Planner 节点：LangChain Chain 生成结构化 ProcessPlan
 * 5. Reviewer 节点：独立 Chain 审计计划质量
 * 6. [条件] 未通过 → 回环 Planner 重新生成（最多 1 轮）
 */
export async function runCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
  embeddingConfig: EmbeddingConfig | null = null,
  supabaseClient: SupabaseClient | null = null,
): Promise<CopilotResult> {
  const graph = getCopilotGraph();

  const result = await graph.invoke({
    goal,
    batch,
    config,
    embeddingConfig,
    supabaseClient,
    queryText: goal.text,
    knowledge: [],
    knowledgeRelevant: false,
    retrievalAttempts: 0,
    lastNodeMeta: {},
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
 * 通过 SSE 将每个节点的执行状态下发给客户端
 */
export async function* streamCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
  embeddingConfig: EmbeddingConfig | null = null,
  supabaseClient: SupabaseClient | null = null,
) {
  const graph = getCopilotGraph();

  const stream = await graph.stream({
    goal,
    batch,
    config,
    embeddingConfig,
    supabaseClient,
    queryText: goal.text,
    knowledge: [],
    knowledgeRelevant: false,
    retrievalAttempts: 0,
    lastNodeMeta: {},
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
