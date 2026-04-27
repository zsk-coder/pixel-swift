import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbeddingModel, type EmbeddingConfig } from "./embeddings";

// ────────────────────────────────────────────────────────
// 知识检索模块（Corrective RAG 检索层）
//
// 升级路径：
//   旧版：硬编码关键词匹配（同步，无语义理解）
//   新版：向量语义检索 + 关键词 Fallback（异步，支持跨语言语义匹配）
//
// 接口 RetrievedKnowledge[] 保持不变，上下游零影响
// ────────────────────────────────────────────────────────

export interface RetrievedKnowledge {
  id: string;
  scene: string;
  source: string;
  title: string;
  content: string;
}

/**
 * 通过向量语义检索获取相关知识
 *
 * 使用 LangChain SupabaseVectorStore 做余弦相似度检索：
 * 1. 将用户查询文本通过 OpenAI Embedding 向量化
 * 2. 在 Supabase pgvector 中检索 Top-K 最相似的知识片段
 * 3. 过滤低于阈值的弱相关结果
 * 4. 映射为 RetrievedKnowledge[] 格式
 *
 * @param queryText 检索查询文本（可以是原始用户目标，也可以是重写后的查询）
 * @param embeddingConfig Embedding 模型配置
 * @param supabaseClient Supabase 客户端（需 service_role 权限）
 * @param maxResults 最大返回条数
 * @param scoreThreshold 最低相似度阈值（0-1），低于此值的结果将被丢弃
 * @returns 语义匹配的知识片段列表
 */
export async function retrieveKnowledgeByVector(
  queryText: string,
  embeddingConfig: EmbeddingConfig,
  supabaseClient: SupabaseClient,
  maxResults = 5,
  scoreThreshold = 0.5,
): Promise<RetrievedKnowledge[]> {
  const embeddings = createEmbeddingModel(embeddingConfig);

  // 使用 LangChain SupabaseVectorStore 做检索
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "knowledge_documents",
    queryName: "match_knowledge_documents", // 对应 migration 中的 RPC 函数
  });

  // 使用 similaritySearchWithScore 获取匹配分，在应用层做二次阈值过滤
  const resultsWithScore = await vectorStore.similaritySearchWithScore(
    queryText,
    maxResults,
  );

  // 过滤低于阈值的弱相关结果，避免无关知识污染 Planner prompt
  const filtered = resultsWithScore.filter(
    ([_doc, score]) => score >= scoreThreshold,
  );

  console.info(
    `[Knowledge] 向量检索 Top-${maxResults}: ${resultsWithScore.map(([, s]) => s.toFixed(3)).join(", ")} → 阈值 ${scoreThreshold} 过滤后保留 ${filtered.length} 条`,
  );

  // 映射为 RetrievedKnowledge[] 格式，保持接口兼容
  return filtered.map(([doc]) => ({
    id: String(doc.metadata?.id ?? "unknown"),
    scene: String(doc.metadata?.scene ?? "general"),
    source: String(doc.metadata?.source ?? "vector-search"),
    title: String(doc.metadata?.title ?? ""),
    content: doc.pageContent,
  }));
}

/**
 * 统一检索入口：仅使用向量语义检索
 *
 * @param queryText 用户目标或重写后的查询
 * @param embeddingConfig Embedding 配置
 * @param supabaseClient Supabase 客户端
 * @param maxResults 最大返回条数
 * @returns 检索到的知识片段列表
 */
export async function retrieveKnowledge(
  queryText: string,
  embeddingConfig: EmbeddingConfig | null,
  supabaseClient: SupabaseClient | null,
  maxResults = 3,
): Promise<RetrievedKnowledge[]> {
  // 如果缺少向量检索所需的配置，直接返回空，相信大模型原生能力
  if (!embeddingConfig?.apiKey || !supabaseClient) {
    console.info("[Knowledge] Embedding 未配置，跳过知识检索");
    return [];
  }

  try {
    const results = await retrieveKnowledgeByVector(
      queryText,
      embeddingConfig,
      supabaseClient,
      maxResults,
    );

    if (results.length === 0) {
      console.info("[Knowledge] 向量检索无结果");
    }

    return results;
  } catch (err) {
    console.warn(
      "[Knowledge] 向量检索异常:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
