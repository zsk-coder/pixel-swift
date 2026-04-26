# LangChain 使用现状分析与演进方向

> 最后更新：2026-04-26

## 1. 当前使用现状

### 依赖清单

| 包名 | 版本 | 项目中的实际用途 |
|---|---|---|
| `@langchain/core` | ^1.1.40 | `ChatPromptTemplate` — 拼装 system/human 消息模板 |
| `@langchain/deepseek` | ^1.0.24 | `ChatDeepSeek` + `withStructuredOutput` — 调用 DeepSeek API |
| `@langchain/langgraph` | ^1.2.9 | `StateGraph` — 编排 Planner → Reviewer 重试流程 |

### 涉及文件（仅 4 个，全部在 `server/lib/copilot/`）

| 文件 | LangChain 用途 |
|---|---|
| `prompts.ts` | `ChatPromptTemplate.fromMessages()` 构建 prompt |
| `planner.ts` | `ChatDeepSeek` 实例化 + `withStructuredOutput(zodSchema, { method: "jsonMode" })` |
| `reviewer.ts` | 同 planner，独立模型实例做计划审计 |
| `graph.ts` | `StateGraph` + `Annotation` + `addConditionalEdges` 编排状态图 |

### 功能利用率评估

| LangChain 核心能力 | 是否使用 | 说明 |
|---|---|---|
| Agent（自主工具选择） | ❌ | 无 |
| Memory（对话记忆） | ❌ | Copilot 是单次规划，无多轮对话 |
| RAG（检索增强生成） | ❌ | `knowledge.ts` 是手写关键词匹配，未使用 LangChain 的 Retriever |
| Tool Calling | ❌ | DeepSeek v4 不支持 function calling，已退化为 JSON Mode |
| Streaming 回调 | ❌ | SSE 通过 H3 `createEventStream` 自行实现 |
| Prompt Template | ✅ | 仅 `{variable}` 占位符替换，等价于模板字面量 |
| Structured Output | ✅ | 本质 = `response_format: { type: "json_object" }` + `zod.parse()` |
| StateGraph（LangGraph） | ✅ | 本质 = 一个最多 2 次迭代的 for 循环 |

### 当前结论

> 项目仅使用了 LangChain 最表层的 API 封装，核心功能（Agent、RAG、Memory、Tool Calling）均未涉及。
> 当前 LangChain 的所有用途均可用 `fetch` + `zod`（已有依赖）在 ~80 行内替代。

### 副作用

- `wrangler.toml` 中 `nodejs_compat` flag 是专门为 LangChain 配置的，增加部署复杂性
- 引入大量传递依赖（`@langchain/openai`、`@langchain/langgraph-sdk`、`@langchain/langgraph-checkpoint` 等）

---

## 2. 演进方向：RAG 知识检索升级

如果保留 LangChain，最有价值的方向是**将 `knowledge.ts` 从硬编码关键词匹配升级为基于向量检索的真正 RAG 系统**。

### 2.1 当前痛点

`knowledge.ts` 使用硬编码关键词映射，存在明显局限：

- **不可扩展**：每新增一个平台（Etsy、Pinterest、TikTok Shop）都需手动添加关键词和知识条目
- **无语义理解**："产品图优化" 无法匹配到 "电商图片规范"
- **多语言支持差**：需要为每种语言手动枚举关键词
- **知识容量有限**：目前仅 5 个场景，无法承载深度的平台规范差异

### 2.2 目标架构

```
用户输入 "帮我把产品图优化成适合 Etsy 的尺寸"
        ↓
  Embedding Model → 向量化查询
        ↓
  Supabase pgvector → 语义相似度检索 Top-K 知识片段
        ↓
  注入到 Planner Prompt 上下文
        ↓
  DeepSeek 生成更精准的处理计划
```

### 2.3 技术选型

| 环节 | 组件 | 说明 |
|---|---|---|
| 文档分块 | `RecursiveCharacterTextSplitter` | 将平台指南拆分为语义连贯的知识片段 |
| 向量化 | Embedding API（OpenAI / 本地模型） | 将知识片段和用户查询向量化 |
| 向量存储 | Supabase `pgvector` 扩展 | 复用现有 Supabase 基础设施，零额外成本 |
| 语义检索 | `SupabaseVectorStore` / 自定义 Retriever | 基于余弦相似度检索 Top-K 相关知识 |

### 2.4 改造范围

```
server/lib/copilot/
├── knowledge.ts          ← 改造：retrieveKnowledge() 内部改用向量检索
├── knowledge-seed.ts     ← [NEW] 知识灌入脚本（平台指南 → 分块 → 向量化 → 写入 pgvector）
├── planner.ts            ← 不变（已通过参数接收 knowledge）
├── prompts.ts            ← 不变
├── reviewer.ts           ← 不变
└── graph.ts              ← 不变
```

> **改造最小化**：只替换 `retrieveKnowledge()` 函数的内部实现，函数签名和返回类型 `RetrievedKnowledge[]` 不变，上下游零影响。

### 2.5 知识库扩展路线

| 阶段 | 内容 | 预期效果 |
|---|---|---|
| Phase 1 | 主流电商平台指南（Shopify、Amazon、Etsy、eBay） | 电商场景规划精准度提升 |
| Phase 2 | 社交媒体平台规范（Instagram、Pinterest、TikTok、Twitter/X） | 覆盖社媒内容创作场景 |
| Phase 3 | 技术规范文档（Google Web Vitals、Core Web Vitals 指标） | SEO/性能优化场景增强 |
| Phase 4 | 用户历史数据（匿名化的高频使用模式） | 个性化推荐 |

### 2.6 为什么不选其他方向

| 备选方案 | 否决原因 |
|---|---|
| 多模型 Agent | 仅 3 个 action（resize/compress/convert），决策空间太小 |
| Memory 对话记忆 | Copilot 是单次规划，无多轮对话需求 |
| 更复杂的 LangGraph 编排 | 增加延迟和 token 消耗，收益不明确 |
| Tool Calling | DeepSeek v4 不支持 function calling |

---

## 3. 备选路径：移除 LangChain

如果决定不走 RAG 方向，建议直接移除 LangChain，用原生 `fetch` + `zod` 替代：

- 删除 3 个 `@langchain/*` 依赖
- `planner.ts` / `reviewer.ts` 改为直接 `fetch` 调用 DeepSeek API + `zod.parse()`
- `graph.ts` 的 StateGraph 替换为简单的 for 循环重试逻辑
- `prompts.ts` 的 `ChatPromptTemplate` 替换为模板字面量
- 评估移除 `wrangler.toml` 中的 `nodejs_compat` flag
