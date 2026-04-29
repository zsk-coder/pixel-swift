import { z } from "zod";

// ────────────────────────────────────────────────────────
// Retrieval Grader（检索相关性评估器）
//
// Corrective RAG 的核心节点之一：
// 让 LLM 判断向量检索到的知识片段是否与用户的图片处理目标相关
// 如果不相关，会触发 Query Rewriter 重写查询后重新检索
// ────────────────────────────────────────────────────────

// ── Grader 输出 Schema ──
export const gradeResultSchema = z.object({
  relevant: z.boolean().describe("检索到的知识是否与用户目标相关"),
  confidence: z.number().min(0).max(1).describe("判断置信度 0-1"),
  reason: z.string().describe("判断理由，用于调试日志"),
});

export type GradeResult = z.infer<typeof gradeResultSchema>;

// ── Grader Prompt 模板（延迟初始化，避免 CF Workers 全局作用域副作用） ──
let _graderPrompt: unknown = null;

async function getGraderPrompt() {
  if (!_graderPrompt) {
    const { ChatPromptTemplate } = await import("@langchain/core/prompts");
    _graderPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a relevance grader for an image processing knowledge base.
Your job is to assess whether the retrieved knowledge documents are relevant to the user's image processing goal.

## Grading Criteria
- "relevant": true if the knowledge contains platform-specific guidelines, format/size recommendations, or optimization tips that could improve the image processing plan
- "relevant": false if the knowledge is about a completely different platform or topic that would not help generate a better plan
- Be GENEROUS with relevance — if the knowledge is even partially applicable, mark it as relevant

## Output Format
You MUST output a single JSON object:
{{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "one-line explanation"
}}`,
      ],
      [
        "human",
        `## User's Image Processing Goal
{goal}

## Retrieved Knowledge
{knowledge}

Assess the relevance of this knowledge to the user's goal:`,
      ],
    ]);
  }
  return _graderPrompt as any;
}

/**
 * 评估检索到的知识片段是否与用户目标相关
 *
 * @param goalText 用户的原始自然语言目标
 * @param knowledgeContent 检索到的知识片段文本（拼接）
 * @param model ChatDeepSeek 模型实例（复用 reviewer 的低温度模型）
 * @returns GradeResult 包含 relevant/confidence/reason
 */
export async function gradeRetrievedKnowledge(
  goalText: string,
  knowledgeContent: string,
  model: any,
): Promise<GradeResult> {
  const structuredModel = model.withStructuredOutput(gradeResultSchema, {
    name: "GradeResult",
    method: "jsonMode",
  });

  const graderPrompt = await getGraderPrompt();
  const chain = graderPrompt.pipe(structuredModel);

  try {
    const result = await chain.invoke({
      goal: goalText,
      knowledge: knowledgeContent,
    });
    return result as GradeResult;
  } catch (err) {
    // 评估失败时降级为"视为相关"，不阻塞主流程
    console.warn(
      "[Retrieval Grader] 评估失败，降级为视为相关:",
      err instanceof Error ? err.message : err,
    );
    return {
      relevant: true,
      confidence: 0.5,
      reason: "Grader unavailable, defaulting to relevant",
    };
  }
}
