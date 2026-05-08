# PixelSwift 面试准备（三）：AI Workflow Copilot 深度解析

> 本文档深度拆解 AI Copilot 的完整实现：CRAG 管线、LangGraph 编排、SSE 流式通信、前端执行引擎。

---

## 1. AI Copilot 整体流程

```mermaid
graph TB
    subgraph "前端 (浏览器)"
        A1["用户上传图片"] --> A2["提取图片特征<br/>extractBatch()"]
        A2 --> A3["发送 SSE 请求<br/>POST /api/ai-workflow/plan"]
        A3 --> A4["实时解析 SSE 事件<br/>更新日志 + 进度条"]
        A4 --> A5["解析 ProcessPlan"]
        A5 --> A6["executePlan()<br/>逐步执行处理步骤"]
        A6 --> A7["结果打包下载"]
    end

    subgraph "后端 (Cloudflare Workers)"
        B1["Auth 鉴权"] --> B2["Rate Limit 限流"]
        B2 --> B3["配额检查 + 乐观扣减"]
        B3 --> B4["LangGraph CRAG 管线"]
        B4 --> B5["SSE 逐节点推流"]
    end

    A3 -- "HTTP POST" --> B1
    B5 -- "SSE 事件流" --> A4
```

---

## 2. 前端特征提取（不上传原图）

这是架构的核心隐私设计：**原图永远不离开浏览器**，只把元数据发给后端。

```mermaid
flowchart LR
    A["File[]"] --> B["extractDescriptor()"]
    B --> C["createImageBitmap()<br/>获取 width/height"]
    B --> D["OffscreenCanvas 64x64<br/>采样检测 alpha 通道"]
    C & D --> E["ImageDescriptor"]
    E --> F["BatchSummary<br/>{fileCount, totalSize, formats, images[]}"]

    style E fill:#e1f5fe
    style F fill:#e1f5fe
```

### 发送给后端的数据结构（注意：没有图片二进制）

```typescript
interface ImageDescriptor {
  id: string;           // "img-0-1715150400000"
  fileName: string;     // "photo.jpg"
  width: number;        // 4032
  height: number;       // 3024
  sizeBytes: number;    // 5242880
  format: string;       // "jpeg"
  hasAlpha: boolean;    // false
}

interface BatchSummary {
  fileCount: number;    // 5
  totalSizeBytes: number; // 26214400
  formats: string[];    // ["jpeg", "png"]
  images: ImageDescriptor[];
}
```

### Alpha 检测算法

```typescript
// 只对可能有透明度的格式 (png/webp/avif) 做像素级检测
// 缩小到 64x64 采样，避免大图内存爆炸
const canvas = new OffscreenCanvas(Math.min(width, 64), Math.min(height, 64));
const ctx = canvas.getContext('2d');
ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

// 每 4 字节 = RGBA，检查第 4 个字节（Alpha）是否全为 255
for (let i = 3; i < pixels.length; i += 4) {
  if (pixels[i] < 255) { hasAlpha = true; break; }
}
```

**面试话术：为什么要检测 Alpha？**
> 因为 AI 生成计划时需要知道图片是否有透明度。如果用户的 PNG 有透明背景，AI 就不应该建议转成 JPG（会丢失透明度）。我们不是靠文件扩展名判断，而是真正做了像素级采样——因为有些 PNG 虽然格式支持透明，但实际上每个像素的 alpha 都是 255（纯不透明），这种情况转 JPG 是安全的。

---

## 3. 后端 API 层：plan.post.ts

```mermaid
flowchart TD
    A["POST /api/ai-workflow/plan"] --> B["环境检查<br/>Supabase 是否可用"]
    B --> C["JWT 鉴权<br/>serverSupabaseUser()"]
    C --> D{用户已登录?}
    D -- "否" --> E["return fail(1001, UNAUTHORIZED)"]
    D -- "是" --> F["Rate Limit 检查<br/>enforceRateLimit()"]
    F --> G{被限流?}
    G -- "是" --> H["return fail(5000, RATE_LIMITED)"]
    G -- "否" --> I["查询配额<br/>getEntitlement()"]
    I --> J{有余额?}
    J -- "否" --> K["return fail(1003, QUOTA_EXHAUSTED)"]
    J -- "是" --> L["Zod 校验请求体<br/>generatePlanRequestSchema"]
    L --> M["乐观扣减配额<br/>trial_used + 1"]
    M --> N["创建 SSE EventStream"]
    N --> O["启动 LangGraph 流"]
    O --> P{成功?}
    P -- "是" --> Q["推送 complete 事件"]
    P -- "否" --> R["回退配额<br/>trial_used - 1"]
    R --> S["推送 error 事件"]
```

### 乐观扣减 + 失败回退（面试重点）

```typescript
// 先扣后用：乐观扣减
await deductTrialUsage(event, userId);  // trial_used + 1

try {
  // 运行 LangGraph ...
  // 成功：配额已扣，不需要额外操作
} catch (err) {
  // 失败：回退配额
  await refundTrialUsage(event, userId);  // trial_used - 1
}
```

> **为什么不用事务？** 因为 Supabase 的 REST API 不支持跨表事务。我们用 Rate Limiter 保证单用户不会高并发，所以 read-then-update 的竞态窗口极小，配合乐观扣减足够可靠。

---

## 4. LangGraph CRAG 管线（核心中的核心）

### 4.1 完整状态图

```mermaid
stateDiagram-v2
    [*] --> retrieve : START

    retrieve --> gradeKnowledge : 检索完成

    gradeKnowledge --> planner : 知识相关 ✅
    gradeKnowledge --> rewriteQuery : 知识不相关 ❌ (且未达上限)
    gradeKnowledge --> planner : 知识不相关 ❌ (已达上限，降级)

    rewriteQuery --> retrieve : 重写后重新检索

    planner --> reviewer : 计划生成完毕

    reviewer --> output : 审计通过 ✅
    reviewer --> planner : 审计未通过 ❌ (且未达上限)
    reviewer --> output : 审计未通过 ❌ (已达上限，降级输出)

    output --> [*] : END
```

### 4.2 六个节点详解

```mermaid
graph TD
    subgraph "节点 1: retrieve 向量语义检索"
        R1["接收 queryText"] --> R2["OpenAI Embedding 向量化<br/>(BGE-M3 模型)"]
        R2 --> R3["Supabase pgvector<br/>match_knowledge_documents()"]
        R3 --> R4["余弦相似度过滤<br/>阈值 = 0.58"]
        R4 --> R5["RetrievedKnowledge[]"]
    end

    subgraph "节点 2: gradeKnowledge 相关性评估"
        G1["接收 knowledge[] + goalText"] --> G2["LLM 评估<br/>(temperature=0.1)"]
        G2 --> G3["输出: {relevant, confidence, reason}"]
    end

    subgraph "节点 3: rewriteQuery 查询重写"
        Q1["接收原始 queryText"] --> Q2["LLM 重写查询<br/>提取核心意图 + 平台关键词"]
        Q2 --> Q3["输出: rewrittenQuery"]
    end

    subgraph "节点 4: planner 计划生成"
        P1["接收 goal + batch + knowledge"] --> P2["构建 Prompt<br/>(System + User Message)"]
        P2 --> P3["ChatDeepSeek<br/>withStructuredOutput(zodSchema)"]
        P3 --> P4["Zod 二次校验<br/>validateStepParams()"]
        P4 --> P5["ProcessPlan"]
    end

    subgraph "节点 5: reviewer 计划审计"
        V1["接收 goalText + plan"] --> V2["独立 LLM 审计<br/>(temperature=0.1)"]
        V2 --> V3["PlanReviewResult<br/>{approved, overallScore, issues[]}"]
    end

    subgraph "节点 6: output 输出"
        O1["确定 finalPlan"] --> O2["写入状态"]
    end

    R5 --> G1
    G3 -- "relevant=false" --> Q1
    G3 -- "relevant=true" --> P1
    Q3 --> R1
    P5 --> V1
    V3 -- "approved=true" --> O1
    V3 -- "approved=false" --> P1
```

### 4.3 两条自纠错回环

#### 回环 1：检索质量纠错

```mermaid
flowchart LR
    A["用户输入: '把图片优化成淘宝主图'"] --> B["retrieve<br/>向量检索"]
    B --> C["gradeKnowledge"]
    C -- "❌ 不相关<br/>(知识库没有淘宝数据)" --> D["rewriteQuery<br/>LLM 重写"]
    D -- "'taobao product image<br/>optimization e-commerce'" --> B
    B --> C
    C -- "✅ 匹配到 'Amazon/Shopify<br/>电商平台指南'" --> E["planner"]

    style D fill:#fff3e0
```

**关键参数：**
- 最大检索重试 `MAX_RETRIEVAL_ATTEMPTS = 2`
- 超过上限 → 降级（不带知识直接进 planner）

#### 回环 2：计划质量纠错

```mermaid
flowchart LR
    A["planner 生成计划"] --> B["reviewer 审计"]
    B -- "❌ approved=false<br/>score=45<br/>issue: quality=5 太激进" --> A
    A -- "根据 review feedback<br/>调整参数" --> B
    B -- "✅ approved=true<br/>score=85" --> C["output"]

    style A fill:#e8f5e9
```

**关键参数：**
- 最大规划重试 `MAX_ATTEMPTS = 2`
- 超过上限 → 降级输出（使用最后一次计划）

### 4.4 双模型隔离

```mermaid
graph LR
    subgraph "规划模型 (Planner)"
        M1["ChatDeepSeek<br/>temperature = 0.3<br/>maxTokens = 4096<br/>适度创造性"]
    end

    subgraph "审计模型 (Reviewer/Grader)"
        M2["ChatDeepSeek<br/>temperature = 0.1<br/>maxTokens = 2048<br/>极度严谨"]
    end

    M1 -- "生成计划" --> P["ProcessPlan"]
    P -- "审计" --> M2
    M2 -- "打回重做" --> M1
```

**面试话术：为什么用两个不同温度的模型？**
> 这是"任务规划层 + 安全审计层"的双模型隔离设计。Planner 用 temperature=0.3，需要适度的创造性来理解模糊的用户意图（比如"优化成电商主图"）；Reviewer 用 temperature=0.1，极低温度保证审计结果稳定、严谨，不会"宽容地"放过有参数错误的计划。两个模型互相制衡，确保 AI 幻觉不会穿透到前端执行。

---

## 5. Prompt 工程

### 5.1 Planner System Prompt 核心设计

```mermaid
graph TD
    SP["System Prompt"] --> R1["角色约束: 你是工作流规划器，不是聊天助手"]
    SP --> R2["白名单限制: 只允许 resize/compress/convert_format"]
    SP --> R3["输出格式: 纯 JSON，不允许 markdown"]
    SP --> R4["不支持操作的处理: 仍输出合法计划，降低 confidence"]
    SP --> R5["平台目标处理: 用已有能力尽力满足"]
    SP --> R6["本地化要求: taskSummary/reason/risks 使用用户语言"]
    SP --> R7["格式保护: 除非用户明确要求，不使用 convert_format"]
```

### 5.2 User Message 构建

```mermaid
flowchart TD
    A["buildUserMessage()"] --> B["## User Goal<br/>用户的自然语言目标"]
    A --> C["## Image Batch Summary<br/>图片特征摘要 (最多20张采样)"]
    A --> D["## Platform Knowledge<br/>RAG 检索到的平台指南"]

    B --> E["拼接为完整 User Message"]
    C --> E
    D --> E
```

### 5.3 结构化输出保障

```typescript
// 使用 Zod Schema 约束 AI 输出
const structuredModel = chatModel.withStructuredOutput(processPlanSchema, {
  name: 'ProcessPlan',
  method: 'jsonMode',  // 强制 JSON 模式
});

// 即使 AI 输出合法 JSON，仍做二次校验
const paramErrors = validateStepParams(plan);
// 校验每个 step 的 params 是否在合理范围
// resize: width/height ∈ [1, 10000]
// compress: quality ∈ [1, 100]
// convert_format: targetFormat ∈ {webp, jpeg, png, avif}
```

---

## 6. SSE 流式通信

### 6.1 后端推流

```mermaid
sequenceDiagram
    participant Client as 前端
    participant Server as 后端
    participant LG as LangGraph

    Server->>Client: HTTP 200 (Content-Type: text/event-stream)

    LG->>Server: yield {retrieve: {lastNodeMeta}}
    Server->>Client: event: message<br/>data: {"type":"progress","chunk":{"retrieve":{...}}}

    LG->>Server: yield {gradeKnowledge: {lastNodeMeta}}
    Server->>Client: event: message<br/>data: {"type":"progress","chunk":{"gradeKnowledge":{...}}}

    LG->>Server: yield {planner: {plan, attempts}}
    Server->>Client: event: message<br/>data: {"type":"progress","chunk":{"planner":{...}}}

    LG->>Server: yield {reviewer: {review}}
    Server->>Client: event: message<br/>data: {"type":"progress","chunk":{"reviewer":{...}}}

    LG->>Server: yield {output: {finalPlan}}
    Server->>Client: event: message<br/>data: {"type":"progress","chunk":{"output":{"finalPlan":{...}}}}

    Server->>Client: event: message<br/>data: {"type":"complete","remainingTrialCount":4}
```

### 6.2 前端 SSE 解析

```typescript
// 读取 SSE 流
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');  // SSE 事件以双换行分隔
  buffer = parts.pop() || '';          // 最后一个可能不完整，保留

  for (const part of parts) {
    // 解析 event: 和 data: 行
    const parsed = parseSSEPart(part);
    handleSSEEvent(parsed.eventType, parsed.dataStr);
  }
}
```

### 6.3 进度条策略（假进度 + 真进度混合）

```mermaid
gantt
    title 进度条时间线
    dateFormat X
    axisFormat %s%%

    section Planning 阶段 (0-40%)
    特征提取 5%           :done, 0, 5
    假进度 5→15% (8s)     :active, 5, 15
    retrieve 命中 +4%     :done, 15, 19
    假进度 19→35% (12s)   :active, 19, 35
    planner 完成 +8%      :done, 35, 38

    section Executing 阶段 (40-100%)
    step1: resize 40→60%  :done, 40, 60
    step2: compress 60→80%:done, 60, 80
    step3: convert 80→100%:done, 80, 100
```

- **Planning 阶段（0-40%）**：LLM 推理耗时不确定，用 ease-out 假进度条填补空白期
- **Executing 阶段（40-100%）**：按实际完成的文件数 / 总数映射真实进度
- **单调递增保护**：`progress = Math.max(progress, newValue)`，永远不倒退

---

## 7. 前端执行引擎

```mermaid
flowchart TD
    A["收到 ProcessPlan"] --> B["过滤步骤"]
    B --> C["imageSteps: 需要图像处理的步骤<br/>(resize/compress/convert_format)"]
    B --> D["metaSteps: 仅元数据操作<br/>(rename_files 等，直接跳过)"]

    C --> E["按步骤顺序执行"]
    E --> F["步骤 1: resize"]
    F --> G["对所有文件并发处理<br/>(并发上限 4)"]
    G --> H["processImage(file, mapStepToProcessOptions(step))"]
    H --> I["更新 currentBlobs[]<br/>链式传递给下一步骤"]

    I --> J["步骤 2: compress"]
    J --> K["对上一步输出的 Blob 继续处理"]
    K --> L["步骤 3: convert_format"]
    L --> M["最终 resultFiles[]"]

    D --> N["标记完成（无实际处理）"]

    M --> O["下载结果 ZIP"]
```

### 关键设计：步骤链式传递

```typescript
// 当前文件数据：每个步骤产生新的 Blob，链式传递给下一个步骤
let currentBlobs = files.map(f => ({ blob: f, name: f.name }));

for (const step of imageSteps) {
  const nextBlobs = new Array(currentBlobs.length);

  await processWithConcurrency(currentBlobs, async (item, i) => {
    const inputFile = new File([item.blob], item.name);
    const result = await processImage(inputFile, mapStepToProcessOptions(step));
    nextBlobs[i] = { blob: result.blob, name: buildOutputFileName(...) };
  });

  currentBlobs = nextBlobs;  // 上一步的输出 = 下一步的输入
}
```

### AI 参数防御（clamp）

```typescript
// 前端对 AI 生成的参数做防御性 clamp
// 防止 AI 幻觉产生的异常参数导致处理器崩溃

case 'resize': {
  // 尺寸 clamp 到 [1, 10000]
  const w = Math.max(1, Math.min(10000, Math.round(p.width)));
  const h = Math.max(1, Math.min(10000, Math.round(p.height)));
}

case 'compress': {
  // 质量 clamp 到 [1, 100]
  const quality = Math.max(1, Math.min(100, Math.round(p.quality)));
}
```

---

## 8. 知识库 RAG 系统

### 8.1 知识灌入流程

```mermaid
flowchart TD
    A["knowledge-seed.ts<br/>灌入脚本"] --> B["加载知识条目<br/>(Shopify/Amazon/Etsy/Instagram/TikTok)"]
    B --> C["RecursiveCharacterTextSplitter<br/>chunkSize=500, overlap=50"]
    C --> D["OpenAI Embedding<br/>BGE-M3 向量化"]
    D --> E["Supabase pgvector<br/>upsert (scene+title 去重)"]
```

### 8.2 知识检索流程

```mermaid
flowchart LR
    A["用户查询文本"] --> B["OpenAI Embedding<br/>向量化"]
    B --> C["Supabase pgvector<br/>match_knowledge_documents()"]
    C --> D["余弦相似度过滤<br/>阈值 0.58"]
    D --> E["Top-3 知识片段"]
```

### 8.3 面试话术

> **问："你的 RAG 系统是怎么做的？为什么选择 CRAG？"**

> 我们的 RAG 不是简单的 "检索 → 拼接 → 生成"。普通 RAG 最大的问题是检索到了不相关的噪音知识，反而会误导 LLM 生成错误的计划。
>
> 所以我们实现了 Corrective RAG（自纠错检索增强生成）。流程是这样的：
>
> 1. 先做**向量语义检索**（BGE-M3 Embedding + pgvector 余弦相似度，阈值 0.58）
> 2. 检索到的知识不是直接喂给 Planner，而是先过一道 **GradeKnowledge 节点**——用 LLM 评估这些知识片段是否真的和用户目标相关
> 3. 如果不相关（比如用户问"优化淘宝主图"，但检索到了 Instagram 的指南），会触发 **Query Rewriter** 重写查询（翻译关键词、提取核心意图），然后用重写后的查询重新检索
> 4. 最多重试 2 次，如果还是不相关就降级——不带知识直接让 Planner 生成计划
>
> 这个设计的好处是：**根除了"检索噪音污染生成质量"的问题**，同时保证了系统的鲁棒性——任何环节失败都有降级路径，不会卡死。
