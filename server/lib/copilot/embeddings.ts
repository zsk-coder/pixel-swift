import { OpenAIEmbeddings } from "@langchain/openai";

// ────────────────────────────────────────────────────────
// Embedding 模型配置
// 封装 OpenAI Embedding 实例化，支持代理 / 兼容 API
// 用于知识检索的查询向量化
// ────────────────────────────────────────────────────────

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl?: string; // 支持代理或兼容 API（如 Azure OpenAI）
  model?: string; // 默认 text-embedding-3-small
}

// ── 单例缓存，避免每次请求重建 ──
const _embeddingCache = new Map<string, OpenAIEmbeddings>();

function getEmbeddingFingerprint(config: EmbeddingConfig): string {
  return `${config.apiKey}::${config.model || "default"}::${config.baseUrl || "default"}`;
}

/**
 * 创建或复用 OpenAI Embedding 模型实例
 * 使用 text-embedding-3-small 平衡成本与质量（1536 维度）
 */
export function createEmbeddingModel(
  config: EmbeddingConfig,
): OpenAIEmbeddings {
  const key = getEmbeddingFingerprint(config);
  const cached = _embeddingCache.get(key);
  if (cached) return cached;

  const model = new OpenAIEmbeddings({
    openAIApiKey: config.apiKey,
    modelName: config.model || "text-embedding-3-small",
    ...(config.baseUrl && {
      configuration: {
        baseURL: config.baseUrl,
      },
    }),
  });

  _embeddingCache.set(key, model);
  return model;
}
