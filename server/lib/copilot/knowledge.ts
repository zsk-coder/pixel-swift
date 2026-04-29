import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbeddingModel, type EmbeddingConfig } from "./embeddings";

// ────────────────────────────────────────────────────────
// 知识检索模块（Corrective RAG 检索层）
//
// 使用动态 import 延迟加载 SupabaseVectorStore，兼容 CF Workers
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
 */
export async function retrieveKnowledgeByVector(
  queryText: string,
  embeddingConfig: EmbeddingConfig,
  supabaseClient: SupabaseClient,
  maxResults = 5,
  scoreThreshold = 0.58, // BGE-M3 余弦相似度分布偏低，0.6 即为强匹配；0.58 平衡召回与精度
): Promise<RetrievedKnowledge[]> {
  const embeddings = await createEmbeddingModel(embeddingConfig);

  // 动态 import SupabaseVectorStore，避免全局作用域副作用
  const { SupabaseVectorStore } =
    await import("@langchain/community/vectorstores/supabase");

  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "knowledge_documents",
    queryName: "match_knowledge_documents",
  });

  const resultsWithScore = await vectorStore.similaritySearchWithScore(
    queryText,
    maxResults,
  );

  const filtered = resultsWithScore.filter(
    ([_doc, score]) => score >= scoreThreshold,
  );

  console.info(
    `[Knowledge] 查询: "${queryText}" → ${resultsWithScore.length} 条候选, 阈值 ${scoreThreshold} 保留 ${filtered.length} 条` +
      (filtered.length > 0
        ? ` (最高分: ${resultsWithScore[0]?.[1]?.toFixed(3)})`
        : ` (最高分: ${resultsWithScore[0]?.[1]?.toFixed(3) ?? 'N/A'})`),
  );

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
 */
export async function retrieveKnowledge(
  queryText: string,
  embeddingConfig: EmbeddingConfig | null,
  supabaseClient: SupabaseClient | null,
  maxResults = 3,
): Promise<RetrievedKnowledge[]> {
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
