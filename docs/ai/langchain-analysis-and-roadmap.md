# LangChain 使用现状分析与演进方向

> 最后更新：2026-04-27

## 1. 当前架构：Corrective RAG + LangGraph

### 依赖清单

| 包名                       | 版本    | 项目中的实际用途                                            |
| -------------------------- | ------- | ----------------------------------------------------------- |
| `@langchain/core`          | ^1.1.40 | `ChatPromptTemplate` — 拼装 system/human 消息模板           |
| `@langchain/deepseek`      | ^1.0.24 | `ChatDeepSeek` + `withStructuredOutput` — 调用 DeepSeek API |
| `@langchain/langgraph`     | ^1.2.9  | `StateGraph` — 编排 6 节点 CRAG 管道（含 2 条件回环）       |
| `@langchain/openai`        | latest  | `OpenAIEmbeddings` — 知识片段和查询向量化                   |
| `@langchain/community`     | latest  | `SupabaseVectorStore` — pgvector 语义检索                   |
| `@langchain/textsplitters` | latest  | `RecursiveCharacterTextSplitter` — 知识文档分块             |

### 涉及文件（`server/lib/copilot/`）

| 文件                  | LangChain 用途                                                                    |
| --------------------- | --------------------------------------------------------------------------------- |
| `prompts.ts`          | `ChatPromptTemplate.fromMessages()` 构建 Planner / Reviewer prompt                |
| `planner.ts`          | `ChatDeepSeek` 实例化 + `withStructuredOutput(zodSchema, { method: "jsonMode" })` |
| `reviewer.ts`         | 同 planner，独立模型实例做计划审计                                                |
| `embeddings.ts`       | `OpenAIEmbeddings` 封装，用于查询向量化                                           |
| `knowledge.ts`        | `SupabaseVectorStore` 语义检索 + 关键词 Fallback                                  |
| `retrieval-grader.ts` | `ChatPromptTemplate` + `withStructuredOutput` 评估检索相关性                      |
| `query-rewriter.ts`   | `ChatPromptTemplate` + `withStructuredOutput` 重写查询                            |
| `graph.ts`            | `StateGraph` + `Annotation` + `addConditionalEdges` 编排 6 节点状态图             |
| `knowledge-seed.ts`   | `RecursiveCharacterTextSplitter` + `OpenAIEmbeddings` 知识灌入                    |

### 功能利用率评估

| LangChain 核心能力          | 是否使用 | 说明                                                                      |
| --------------------------- | -------- | ------------------------------------------------------------------------- |
| **RAG（检索增强生成）**     | ✅       | Corrective RAG 模式：向量检索 + 相关性评估 + 查询重写                     |
| **VectorStore**             | ✅       | `SupabaseVectorStore` + pgvector 语义相似度检索                           |
| **Embeddings**              | ✅       | `OpenAIEmbeddings (text-embedding-3-small)` 向量化                        |
| **TextSplitter**            | ✅       | `RecursiveCharacterTextSplitter` 知识文档分块                             |
| **StateGraph（LangGraph）** | ✅       | 6 节点状态图，2 条件回环边（检索回环 + 计划回环）                         |
| **Prompt Template**         | ✅       | 4 个独立的 `ChatPromptTemplate`（Planner / Reviewer / Grader / Rewriter） |
| **Structured Output**       | ✅       | 4 处 `withStructuredOutput(zodSchema)` 类型安全输出                       |
| Agent（自主工具选择）       | ❌       | 仅 3 个 action，决策空间太小                                              |
| Memory（对话记忆）          | ❌       | Copilot 是单次规划，无多轮对话                                            |
| Tool Calling                | ❌       | DeepSeek v4 不支持 function calling                                       |
| Streaming 回调              | ❌       | SSE 通过 H3 `createEventStream` 自行实现                                  |

### 当前结论

> 项目深度使用了 LangChain 的 **RAG 全链路能力**（VectorStore → Embeddings → TextSplitter → Retriever）和 **LangGraph 状态图编排**，实现了 Corrective RAG 自纠错管道。LangChain 在项目中是不可替代的核心架构。

---

## 2. LangGraph 状态图架构

### 6 节点 CRAG 管道

```
START
  → retrieve          （SupabaseVectorStore 语义检索）
  → gradeKnowledge    （LLM 评估检索相关性）
  → [条件边: shouldRewriteQuery]
      ├── 相关 → planner（生成处理计划）
      ├── 不相关 + 未达上限 → rewriteQuery → retrieve（回环）
      └── 不相关 + 达上限 → planner（降级继续）
  → planner            （LangChain Chain 生成结构化 ProcessPlan）
  → reviewer           （独立 Chain 审计计划质量）
  → [条件边: shouldRetry]
      ├── 通过 → output
      └── 未通过 → planner（回环修正，最多 1 轮）
  → output → END
```

### 知识库覆盖

| 平台         | 场景                  |
| ------------ | --------------------- |
| Shopify      | 商品图规范            |
| Amazon       | Listing 图片要求      |
| Etsy         | 手工商品图指南        |
| Instagram    | 帖子/Story 尺寸规范   |
| TikTok Shop  | 商品图要求            |
| Blog/Content | 博客配图性能优化      |
| SEO          | 搜索引擎图片优化      |
| General      | 通用 Web 图片最佳实践 |

---

## 3. 知识库扩展路线

| 阶段       | 内容                                               | 预期效果             |
| ---------- | -------------------------------------------------- | -------------------- |
| Phase 1 ✅ | 主流电商 + 社媒平台指南（8 个平台）                | 覆盖核心使用场景     |
| Phase 2    | 技术规范文档（Google Web Vitals、Core Web Vitals） | SEO/性能优化场景增强 |
| Phase 3    | 用户历史数据（匿名化的高频使用模式）               | 个性化推荐           |
