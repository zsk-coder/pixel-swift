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
// 使用动态 import 延迟加载 @langchain/langgraph，兼容 CF Workers
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

// ── 状态类型定义（与 Annotation 一一对应） ──

interface CopilotStateType {
  goal: GoalInput;
  batch: BatchSummary;
  config: DeepSeekConfig;
  embeddingConfig: EmbeddingConfig | null;
  supabaseClient: SupabaseClient | null;
  queryText: string;
  knowledge: RetrievedKnowledge[];
  knowledgeRelevant: boolean;
  retrievalAttempts: number;
  plan: ProcessPlan | null;
  review: PlanReviewResult | null;
  attempts: number;
  lastNodeMeta: Record<string, unknown>;
  finalPlan: ProcessPlan | null;
  reviewSummary: string;
}

// ── 节点 1: retrieve（向量语义检索） ──

async function retrieveNode(
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
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
    lastNodeMeta: {
      node: "retrieve",
      query,
      knowledgeCount: knowledge.length,
      knowledgeTitles: knowledge.map((k) => k.title),
    },
  };
}

// ── 节点 2: gradeKnowledge（LLM 评估检索相关性） ──

async function gradeKnowledgeNode(
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
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

  const knowledgeText = state.knowledge
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n");

  const graderModel = await createReviewerModel(state.config);
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
    lastNodeMeta: {
      node: "gradeKnowledge",
      relevant: grade.relevant,
    },
  };
}

// ── 节点 3: rewriteQuery（查询重写） ──

async function rewriteQueryNode(
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
  console.info("[LangGraph] RewriteQuery 节点执行中...");

  const graderModel = await createReviewerModel(state.config);
  const result = await rewriteQuery(state.queryText, graderModel);

  return { queryText: result.rewrittenQuery };
}

// ── 节点 4: planner（生成处理计划） ──

async function plannerNode(
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
  console.info(
    `[LangGraph] Planner 节点执行中... (第 ${state.attempts + 1} 次)`,
  );

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

async function reviewerNode(
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
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
  state: CopilotStateType,
): Promise<Partial<CopilotStateType>> {
  return {
    finalPlan: state.plan,
    reviewSummary: state.review?.summary ?? "",
  };
}

// ── 条件边 1: 检索质量回环判断 ──

function shouldRewriteQuery(state: CopilotStateType): string {
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

// ── 条件边 2: 计划质量回环判断 ──

function shouldRetry(state: CopilotStateType): string {
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

// ── 构建状态图（动态 import LangGraph，避免全局作用域副作用） ──

async function buildCopilotGraph() {
  const { StateGraph, Annotation, END, START } =
    await import("@langchain/langgraph");

  // 定义 LangGraph 状态 Schema
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

    // ── 节点元信息 ──
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

  const graph = new StateGraph(CopilotState)
    .addNode("retrieve", retrieveNode)
    .addNode("gradeKnowledge", gradeKnowledgeNode)
    .addNode("rewriteQuery", rewriteQueryNode)
    .addNode("planner", plannerNode)
    .addNode("reviewer", reviewerNode)
    .addNode("output", outputNode)

    .addEdge(START, "retrieve")
    .addEdge("retrieve", "gradeKnowledge")

    .addConditionalEdges("gradeKnowledge", shouldRewriteQuery, {
      planner: "planner",
      rewriteQuery: "rewriteQuery",
    })
    .addEdge("rewriteQuery", "retrieve")

    .addEdge("planner", "reviewer")

    .addConditionalEdges("reviewer", shouldRetry, {
      output: "output",
      planner: "planner",
    })
    .addEdge("output", END);

  return graph.compile();
}

// 编译后的状态图（单例复用，开发环境每次重建以适配 HMR）
let _compiledGraph: Awaited<ReturnType<typeof buildCopilotGraph>> | null = null;

async function getCopilotGraph() {
  if (!_compiledGraph || import.meta.dev) {
    _compiledGraph = await buildCopilotGraph();
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
 */
export async function runCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
  embeddingConfig: EmbeddingConfig | null = null,
  supabaseClient: SupabaseClient | null = null,
): Promise<CopilotResult> {
  const graph = await getCopilotGraph();

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
 */
export async function* streamCopilotGraph(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
  embeddingConfig: EmbeddingConfig | null = null,
  supabaseClient: SupabaseClient | null = null,
) {
  const graph = await getCopilotGraph();

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
