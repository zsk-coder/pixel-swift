import { z } from "zod";

// ────────────────────────────────────────────────────────
// Query Rewriter（查询重写器）
//
// Corrective RAG 的自纠错核心：
// 当 Retrieval Grader 判定检索结果不相关时，
// LLM 会重写用户的原始查询，使其更匹配知识库中的内容，
// 然后用重写后的查询再次检索
// ────────────────────────────────────────────────────────

// ── Rewriter 输出 Schema ──
export const rewriteResultSchema = z.object({
  rewrittenQuery: z.string().describe("重写后的查询，面向图片处理知识库优化"),
  reasoning: z.string().describe("重写理由，解释为什么原查询检索效果不佳"),
});

export type RewriteResult = z.infer<typeof rewriteResultSchema>;

// ── Rewriter Prompt（延迟初始化） ──
let _rewriterPrompt: unknown = null;

async function getRewriterPrompt() {
  if (!_rewriterPrompt) {
    const { ChatPromptTemplate } = await import("@langchain/core/prompts");
    _rewriterPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a query rewriter for an image processing knowledge base.
The original user query did not retrieve relevant knowledge documents.
Your job is to rewrite the query to better match platform-specific image processing guidelines.

## Rewriting Strategy
1. If the query is in a non-English language, translate key terms to English
2. Extract the core image processing intent (resize, compress, convert, optimize)
3. Identify if there's a target platform (Shopify, Amazon, Instagram, etc.)
4. Add specific technical terms that knowledge documents likely contain
5. Keep the rewritten query concise (1-2 sentences max)

You must respond in json format with two fields: "rewrittenQuery" (the improved query text) and "reasoning" (why the original query needed rewriting).`,
      ],
      [
        "human",
        `Original query that failed to retrieve relevant results:
"{query}"

Rewrite this query for better knowledge retrieval:`,
      ],
    ]);
  }
  return _rewriterPrompt as any;
}

/**
 * 重写用户查询以提升知识库检索命中率
 */
export async function rewriteQuery(
  originalQuery: string,
  model: any,
): Promise<RewriteResult> {
  const structuredModel = model.withStructuredOutput(rewriteResultSchema, {
    name: "RewriteResult",
    method: "jsonMode",
  });

  const rewriterPrompt = await getRewriterPrompt();
  const chain = rewriterPrompt.pipe(structuredModel);

  try {
    const result = await chain.invoke({ query: originalQuery });
    console.info(
      `[Query Rewriter] "${originalQuery}" → "${result.rewrittenQuery}" (${result.reasoning})`,
    );
    return result as RewriteResult;
  } catch (err) {
    // 重写失败时返回原始查询，保证流程继续
    console.warn(
      "[Query Rewriter] 重写失败，使用原始查询:",
      err instanceof Error ? err.message : err,
    );
    return {
      rewrittenQuery: originalQuery,
      reasoning: "Rewriter unavailable, using original query",
    };
  }
}
