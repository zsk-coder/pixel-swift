import type {
  BatchSummary,
  GoalInput,
  ProcessPlan,
} from "~~/shared/types/workflow-copilot";
import { processPlanSchema, validateStepParams } from "./schemas";
import { getPlannerPrompt, buildUserMessage } from "./prompts";
import type { RetrievedKnowledge } from "./knowledge";

// ────────────────────────────────────────────────────────
// LangChain Chain 驱动的核心规划器
// 使用动态 import 延迟加载 ChatDeepSeek，兼容 CF Workers
// ────────────────────────────────────────────────────────

// DeepSeek API 运行时配置接口
export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// ── 模型实例缓存（按 config 指纹复用，避免每次请求重建） ──
const _modelCache = new Map<string, unknown>();

function getConfigFingerprint(config: DeepSeekConfig): string {
  return `${config.apiKey}::${config.model}::${config.baseUrl}`;
}

/**
 * 创建或复用 LangChain ChatDeepSeek 模型实例
 * 使用动态 import 延迟加载，避免全局作用域副作用
 */
export async function createChatModel(config: DeepSeekConfig) {
  const key = getConfigFingerprint(config);
  const cached = _modelCache.get(key);
  if (cached) return cached as any;

  const { ChatDeepSeek } = await import("@langchain/deepseek");
  const model = new ChatDeepSeek({
    apiKey: config.apiKey,
    model: config.model,
    configuration: {
      baseURL: `${config.baseUrl}/v1`,
    },
    temperature: 0.3, // 低温度保证输出稳定性
    maxTokens: 4096, // 防止 JSON 截断
  });

  _modelCache.set(key, model);
  return model;
}

// ── 审计模型缓存（独立温度配置） ──
const _reviewerModelCache = new Map<string, unknown>();

/**
 * 创建或复用审计专用 ChatDeepSeek 模型实例
 * 使用极低温度 (0.1) 保证审计更严谨，maxTokens 较小
 */
export async function createReviewerModel(config: DeepSeekConfig) {
  const key = getConfigFingerprint(config);
  const cached = _reviewerModelCache.get(key);
  if (cached) return cached as any;

  const { ChatDeepSeek } = await import("@langchain/deepseek");
  const model = new ChatDeepSeek({
    apiKey: config.apiKey,
    model: config.model,
    configuration: {
      baseURL: `${config.baseUrl}/v1`,
    },
    temperature: 0.1, // 审计需要更加严谨，极低温度
    maxTokens: 2048,
  });

  _reviewerModelCache.set(key, model);
  return model;
}

/**
 * 调用 LangChain Chain 生成图片处理计划
 *
 * 完整流程：
 * 1. 接收预检索的场景知识（由 LangGraph retrieve 节点提供）
 * 2. 通过 ChatPromptTemplate 构建提示词
 * 3. ChatDeepSeek.withStructuredOutput(zodSchema) 生成结构化输出
 * 4. Action 级二次参数校验
 */
export async function generateProcessPlan(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
  knowledge: RetrievedKnowledge[] = [],
): Promise<ProcessPlan> {
  // 1. 构建 User Message（知识已由 retrieve 节点准备好）
  const userMessage = buildUserMessage(goal, batch, knowledge);

  // 2. 创建 LangChain Chain：Prompt → ChatModel → 结构化输出
  const chatModel = await createChatModel(config);

  // 使用 withStructuredOutput 将 Zod Schema 绑定到模型输出
  const structuredModel = chatModel.withStructuredOutput(processPlanSchema, {
    name: "ProcessPlan",
    method: "jsonMode",
  });

  // 构建完整的 Chain：Prompt Template → Structured Model
  const plannerPrompt = await getPlannerPrompt();
  const plannerChain = plannerPrompt.pipe(structuredModel);

  // 调用 Chain 生成计划
  const plan = await plannerChain.invoke({
    userMessage,
  });

  // 3. Action 级二次参数校验
  const paramErrors = validateStepParams(plan);
  if (paramErrors.length > 0) {
    const details = paramErrors
      .map((e) => `${e.action}(${e.stepId}): ${e.error}`)
      .join("; ");
    throw new Error(`步骤参数校验失败: ${details}`);
  }

  // 全部校验通过，返回合法计划
  return plan as ProcessPlan;
}
