# PixelSwift 面试准备（一）：项目全景与系统架构

> 本文档基于项目真实源码梳理，帮助你在面试中清晰、深入地阐述项目的整体架构与技术选型。

---

## 1. 项目一句话定位

**PixelSwift** 是一个浏览器端零上传的智能图片处理平台，核心卖点：
- 图片压缩/转换/缩放 **全部在浏览器完成**，不经过服务器 → **隐私安全 + 零带宽成本**
- 内置 AI Copilot，用户用自然语言描述需求，后端 AI 自动规划多步骤处理指令，前端自动执行

---

## 2. 整体架构总览

```mermaid
graph TB
    subgraph "用户浏览器 (Client)"
        A["Vue 3 SPA<br/>Nuxt 4 SSR"]
        B["Web Worker<br/>(图像处理线程)"]
        C["WASM 编码器<br/>(MozJPEG / UPNG / WebP / AVIF)"]
        D["Composables<br/>(状态管理层)"]
        A --> D
        D --> B
        B --> C
    end

    subgraph "Cloudflare Workers (Server)"
        E["Nitro API Layer<br/>(plan.post.ts / quota.get.ts)"]
        F["LangGraph 状态图<br/>(CRAG 6节点管线)"]
        G["DeepSeek LLM<br/>(规划 + 审计)"]
        H["Supabase pgvector<br/>(知识库向量检索)"]
        I["Supabase Auth<br/>(JWT 鉴权)"]
        J["Rate Limiter<br/>(防刷限流)"]
        E --> J
        J --> F
        F --> G
        F --> H
        E --> I
    end

    subgraph "外部服务"
        K["DeepSeek API"]
        L["OpenAI Embedding API<br/>(BGE-M3)"]
        M["Supabase<br/>(PostgreSQL + pgvector)"]
    end

    A -- "SSE 流式通信" --> E
    G --> K
    H --> L
    H --> M
    I --> M
```

### 架构核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 图片处理位置 | 浏览器端 | 零带宽成本 + 隐私安全，服务端不接触原图 |
| 重计算隔离 | Web Worker | 像素级操作全部 off-thread，主线程零卡顿 |
| 编码器选型 | WASM (@jsquash) | MozJPEG 比 Canvas API 压缩率高 30%+，跨浏览器一致 |
| AI 通信协议 | SSE (Server-Sent Events) | 单向推流，比 WebSocket 轻量，天然适配进度推送 |
| AI 编排框架 | LangGraph | 支持条件边+回环，天然适配 CRAG 自纠错管线 |
| 部署平台 | Cloudflare Pages/Workers | 全球边缘节点，冷启动 <50ms，Serverless 免运维 |
| 数据库 | Supabase (PostgreSQL) | 自带 Auth + pgvector 扩展，一套服务覆盖鉴权+向量检索 |

---

## 3. 前端分层架构

```mermaid
graph LR
    subgraph "Pages 页面层"
        P1["compress-image.vue"]
        P2["converter.vue"]
        P3["resize-image.vue"]
        P4["ai-workflow/"]
    end

    subgraph "Components 组件层"
        C1["FileUploader"]
        C2["CompareSlider"]
        C3["FileList"]
        C4["ExecutionCore"]
    end

    subgraph "Composables 逻辑层"
        D1["useImageProcessor"]
        D2["useFileUpload"]
        D3["useBatchProcess"]
        D4["useDownload"]
        D5["useWorkflowCopilot"]
        D6["useTrialQuota"]
    end

    subgraph "Workers 计算层"
        W1["imageProcessor.worker.ts"]
    end

    subgraph "WASM 编码层"
        WA["@jsquash/jpeg (MozJPEG)"]
        WB["upng-js (量化压缩)"]
        WC["@jsquash/webp"]
        WD["@jsquash/avif"]
    end

    P1 --> C1 & C2 & C3
    P1 --> D1 & D2 & D4
    P4 --> D5
    D1 --> W1
    D5 --> D1
    W1 --> WA & WB & WC & WD
```

### 关键分层原则（面试要点）

1. **页面只做组装**：compress-image.vue 只负责 UI 布局和用户交互，不直接操作 ArrayBuffer
2. **逻辑下沉到 Composable**：`useImageProcessor` 封装 Worker 通信，`useBatchProcess` 封装并发调度
3. **计算隔离到 Worker**：所有像素级操作都在 `imageProcessor.worker.ts` 中执行
4. **编码器按需懒加载**：WASM 模块通过 `dynamic import` 按需加载，首屏不加载编码器

---

## 4. 后端分层架构

```mermaid
graph TD
    subgraph "API 路由层 (server/api/)"
        A1["plan.post.ts<br/>AI 规划入口"]
        A2["quota.get.ts<br/>配额查询"]
    end

    subgraph "业务逻辑层 (server/lib/)"
        B1["graph.ts<br/>LangGraph 状态图编排"]
        B2["planner.ts<br/>计划生成器"]
        B3["reviewer.ts<br/>计划审计器"]
        B4["knowledge.ts<br/>知识检索"]
        B5["retrieval-grader.ts<br/>检索质量评估"]
        B6["query-rewriter.ts<br/>查询重写"]
        B7["prompts.ts<br/>Prompt 模板"]
        B8["schemas.ts<br/>Zod 校验"]
        B9["embeddings.ts<br/>向量化"]
    end

    subgraph "基础设施层"
        C1["Supabase Auth"]
        C2["Rate Limiter"]
        C3["response utils"]
    end

    A1 --> C1 --> C2 --> B1
    B1 --> B4 --> B9
    B1 --> B5
    B1 --> B6
    B1 --> B2 --> B7 & B8
    B1 --> B3 --> B7
    A2 --> C1
```

### 后端关键设计

- **所有 LangChain 依赖使用 `dynamic import`**：Cloudflare Workers 禁止在全局作用域执行副作用，所以 ChatDeepSeek、SupabaseVectorStore、ChatPromptTemplate 全部延迟加载
- **模型实例缓存**：通过 `Map<fingerprint, model>` 避免每次请求重建 LLM 实例
- **乐观扣减 + 失败回退**：先扣配额再调 AI，AI 失败则回退配额，保证用户体验

---

## 5. 数据流全景

```mermaid
sequenceDiagram
    participant U as 用户
    participant P as 页面 (Vue)
    participant C as Composable
    participant W as Web Worker
    participant WA as WASM 编码器
    participant S as Server API
    participant LG as LangGraph
    participant LLM as DeepSeek
    participant VDB as pgvector

    Note over U,VDB: ===== 普通工具流程（压缩/转换/缩放）=====
    U->>P: 上传图片 + 设置参数
    P->>C: useImageProcessor.processImage()
    C->>W: postMessage(buffer, [buffer])<br/>零拷贝 Transferable
    W->>W: createImageBitmap → OffscreenCanvas
    W->>WA: 懒加载 WASM → encode(ImageData)
    WA-->>W: ArrayBuffer (压缩后)
    W-->>C: postMessage(result, [buffer])<br/>零拷贝返回
    C-->>P: ProcessResult {blob, size, duration}
    P->>U: 显示对比 + 下载

    Note over U,VDB: ===== AI Copilot 流程 =====
    U->>P: 上传图片 + 输入自然语言目标
    P->>C: useWorkflowCopilot.run()
    C->>C: extractBatch() 提取图片特征
    C->>S: POST /api/ai-workflow/plan (SSE)
    S->>S: Auth + Rate Limit + 配额检查
    S->>LG: streamCopilotGraph()
    LG->>VDB: 向量语义检索知识
    VDB-->>LG: RetrievedKnowledge[]
    LG->>LLM: gradeKnowledge (评估相关性)
    LG->>LLM: planner (生成 ProcessPlan)
    LG->>LLM: reviewer (审计计划质量)
    LG-->>S: yield chunk (逐节点推送)
    S-->>C: SSE event stream
    C->>C: 解析 ProcessPlan
    C->>W: 逐步执行 plan.steps
    W->>WA: 实际图像处理
    WA-->>W: 处理结果
    W-->>C: 结果 Blob[]
    C-->>P: resultFiles + logs
    P->>U: 显示执行日志 + 批量下载
```

---

## 6. 部署架构

```mermaid
graph LR
    subgraph "Cloudflare 边缘网络"
        CF["Cloudflare Pages<br/>(静态资源 + SSR)"]
        CW["Cloudflare Workers<br/>(Nitro 服务端)"]
        D1["D1 数据库<br/>(@nuxt/content 博客)"]
    end

    subgraph "第三方服务"
        SB["Supabase<br/>(Auth + PostgreSQL + pgvector)"]
        DS["DeepSeek API<br/>(LLM 推理)"]
        OA["OpenAI API<br/>(Embedding 向量化)"]
        GA["Google Analytics"]
    end

    User["全球用户"] --> CF
    CF --> CW
    CW --> SB
    CW --> DS
    CW --> OA
    CF --> D1
    CF --> GA
```

### 部署配置要点

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `nitro.preset` | `cloudflare-pages` | Nuxt 构建产物适配 CF Pages |
| `compatibility_flags` | `["nodejs_compat"]` | LangChain 依赖 Node.js 原生模块 |
| D1 绑定 | `pixelswift-content` | 博客 Markdown 内容存储 |
| WASM 插件 | `vite-plugin-wasm` + `top-level-await` | Worker 内 WASM 模块加载 |

---

## 7. 面试话术：如何介绍项目架构

> **面试官问："介绍一下你这个项目的架构？"**

参考回答：

> PixelSwift 采用 **"后端重推理 + 前端轻执行"** 的协作架构。
>
> **前端**基于 Nuxt 4 + Vue 3，图片处理全部在浏览器端完成——用户上传的图片不经过服务器，通过 Web Worker + WebAssembly 编码器在独立线程中进行像素级操作，主线程完全不卡顿。这样设计有两个好处：一是零带宽成本，服务端不处理图片二进制；二是用户隐私有保障，图片从不离开浏览器。
>
> **后端**部署在 Cloudflare Workers 上，是纯 Serverless 架构。核心功能是 AI Copilot 模块——使用 LangGraph 编排了一个 6 节点的 CRAG（Corrective RAG）自纠错管线。用户用自然语言描述需求，后端会先做向量语义检索获取平台知识，然后 LLM 生成结构化的处理计划，再由另一个 LLM 审计计划质量，审计不通过会回环重新生成。最终通过 SSE 实时推流到前端执行。
>
> **数据层**用 Supabase 一套打通鉴权和向量检索——PostgreSQL + pgvector 扩展，既存用户配额数据，也做知识库的语义相似度搜索。
