import { ChatDeepSeek } from "@langchain/deepseek";
import type {
  BatchSummary,
  GoalInput,
  ProcessPlan,
} from "~~/shared/types/workflow-copilot";
import { processPlanSchema, validateStepParams } from "./schemas";
import { plannerPrompt, buildUserMessage } from "./prompts";
import { retrieveKnowledge } from "./knowledge";

// ────────────────────────────────────────────────────────
// LangChain Chain 驱动的核心规划器
// 使用 ChatDeepSeek + withStructuredOutput 实现类型安全的 AI 规划
// ────────────────────────────────────────────────────────

// DeepSeek API 运行时配置接口
export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// ── 模型实例缓存（按 config 指纹复用，避免每次请求重建） ──
const _modelCache = new Map<string, ChatDeepSeek>();

function getConfigFingerprint(config: DeepSeekConfig): string {
  return `${config.apiKey}::${config.model}::${config.baseUrl}`;
}

/**
 * 创建或复用 LangChain ChatDeepSeek 模型实例
 * 配置低温度保证输出稳定性，合理的 maxTokens 防止 JSON 被截断
 */
export function createChatModel(config: DeepSeekConfig): ChatDeepSeek {
  const key = getConfigFingerprint(config);
  const cached = _modelCache.get(key);
  if (cached) return cached;

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
const _reviewerModelCache = new Map<string, ChatDeepSeek>();

/**
 * 创建或复用审计专用 ChatDeepSeek 模型实例
 * 使用极低温度 (0.1) 保证审计更严谨，maxTokens 较小
 */
export function createReviewerModel(config: DeepSeekConfig): ChatDeepSeek {
  const key = getConfigFingerprint(config);
  const cached = _reviewerModelCache.get(key);
  if (cached) return cached;

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
 * 1. 检索相关场景知识（本地关键词匹配）
 * 2. 通过 ChatPromptTemplate 构建提示词
 * 3. ChatDeepSeek.withStructuredOutput(zodSchema) 生成结构化输出
 * 4. Action 级二次参数校验
 * 5. 校验失败时最多重试 1 次
 *
 * @param goal 用户的自然语言目标
 * @param batch 图片批次摘要
 * @param config DeepSeek API 配置
 * @returns 校验通过的 ProcessPlan
 */
export async function generateProcessPlan(
  goal: GoalInput,
  batch: BatchSummary,
  config: DeepSeekConfig,
): Promise<ProcessPlan> {
  // 1. 检索相关场景知识
  const knowledge = retrieveKnowledge(goal.text);

  // 2. 构建 User Message
  const userMessage = buildUserMessage(goal, batch, knowledge);

  // 3. 创建 LangChain Chain：Prompt → ChatModel → 结构化输出
  const chatModel = createChatModel(config);

  // 使用 withStructuredOutput 将 Zod Schema 绑定到模型输出
  // DeepSeek v4 不支持 function calling (tool_choice)，需使用 JSON Mode
  const structuredModel = chatModel.withStructuredOutput(processPlanSchema, {
    name: "ProcessPlan",
    method: "jsonMode",
  });

  // 构建完整的 Chain：Prompt Template → Structured Model
  const plannerChain = plannerPrompt.pipe(structuredModel);

  // 调用 Chain 生成计划（LangChain 自动完成 Prompt 渲染 → API 调用 → Schema 校验）
  // 注意：不在此处重试，重试逻辑由外层 LangGraph 状态图统一编排
  const plan = await plannerChain.invoke({
    userMessage,
  });

  // 4. Action 级二次参数校验（LangChain 的 withStructuredOutput 不包含这层业务校验）
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
