# ⚙️ PixelSwift Smart Check — 技术规格文档

> **版本**: v4.0 AI-First  
> **最后更新**: 2026-04-17  
> **对应 PRD**: smart-check-prd.md

---

## 1. 架构总览

### 设计哲学：沙漏模型

```
        ┌─────────────┐
        │  用户拖入图片 │   ← 宽口：零摩擦
        └──────┬──────┘
               ↓
    ┌──────────────────┐
    │  浏览器特征提取    │   ← 沙漏窄腰：50ms 提取特征
    │  (纯数据层)       │      不做任何判断
    │  输出 Feature JSON │
    └──────────┬───────┘
               ↓
    ┌──────────────────┐
    │  LangChain Agent  │   ← 大脑：所有智能在此
    │  + RAG 知识库     │      分析、判断、建议、编排
    │  + Function Call  │      流式输出诊断报告
    └──────────┬───────┘
               ↓
    ┌──────────────────┐
    │  浏览器本地修复    │   ← 执行层：WASM 压缩/resize/转换
    │  (复用现有引擎)    │      图片始终不离开浏览器
    └──────────┬───────┘
               ↓
        ┌─────────────┐
        │  ZIP 一键下载 │   ← 宽口：满意离开
        └─────────────┘
```

### 系统架构图

```
┌─ 前端(Nuxt 3) ──────────────────────────────────────┐
│                                                       │
│  pages/smart-check.vue                                │
│  ├── PlatformSelector.vue                             │
│  ├── ImageDropZone.vue                                │
│  ├── AIReportPanel.vue    ← Streaming 流式输出面板    │
│  ├── FixPlanPanel.vue     ← 修复方案 + 一键执行       │
│  └── LoginModal.vue       ← Google One-tap            │
│                                                       │
│  composables/                                         │
│  ├── useFeatureExtract.ts  ← Worker 提取特征 JSON     │
│  ├── useSmartCheckAI.ts    ← Vercel AI SDK useChat    │
│  └── useAutoFixer.ts       ← 解析 AI 指令执行修复     │
│                                                       │
│  workers/                                             │
│  └── feature-extract.worker.ts                        │
│                                                       │
└───────────────────── ↕ HTTP/SSE ──────────────────────┘

┌─ 后端(Nuxt Server Routes) ────────────────────────────┐
│                                                       │
│  server/api/smart-check.post.ts  ← 主入口 API        │
│                                                       │
│  server/lib/                                          │
│  ├── agent.ts        ← LangChain ReAct Agent          │
│  ├── tools.ts        ← 4 个 Function Calling Tools    │
│  ├── rag.ts          ← Supabase pgvector 检索         │
│  ├── prompts.ts      ← System Prompt                  │
│  └── guardrails.ts   ← 参数断言防呆层                │
│                                                       │
│  server/middleware/                                    │
│  └── auth.ts         ← Supabase 鉴权 + 配额          │
│                                                       │
└───────────────────────────────────────────────────────┘

┌─ 基础设施 ────────────────────────────────────────────┐
│  Supabase:  Auth + pgvector + Database                │
│  LLM:      gpt-4o-mini (首选) / DeepSeek (备选)      │
│  部署:     Cloudflare Pages + Nuxt Nitro              │
└───────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

### 已有（直接复用）

```
Nuxt 3 + Vue 3 + TypeScript         ← 框架
Web Workers + Transferable Objects   ← 并发处理
WASM (MozJPEG / UPNG / WebP编码器)  ← 图像压缩/转换
Canvas API                           ← 图像操作
vite-plugin-wasm                     ← WASM 打包
jszip                                ← ZIP 打包
@vite-pwa/nuxt                       ← PWA 离线
@nuxtjs/i18n (8 语言)                ← 国际化
Cloudflare Pages                     ← 部署
```

### 新增

```
@langchain/core                      ← Agent 编排框架
@langchain/openai                    ← LLM Provider
@langchain/community                 ← DeepSeek 等备选 Provider
ai (Vercel AI SDK)                   ← Streaming UI
@nuxtjs/supabase                     ← Auth + Database
Supabase pgvector                    ← RAG 向量检索
zod                                  ← Function Calling 参数校验
exif-js                              ← EXIF 解析（~10KB）
```

---

## 3. 数据结构

### ImageFeatures（特征提取结果）

```typescript
interface ImageFeatures {
  id: string; // 前端 nanoid 生成
  fileName: string;
  fileSize: number; // bytes
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif" | "bmp" | "tiff" | "avif";
  hasAlpha: boolean; // 透明通道
  dpi: number | null;
  colorSpace: string | null;
  hasExif: boolean;
  hasGps: boolean;
  blurScore: number; // 0-100, 拉普拉斯方差归一化, 越高越模糊
  bgWhiteness: number; // 0-1, 四边缘像素白色占比
  dominantColor: string; // 主色调 hex
}
```

### FixAction（AI 返回的修复指令）

```typescript
interface FixAction {
  action: "compress" | "resize" | "convert" | "strip_exif";
  imageId: string;
  params: CompressParams | ResizeParams | ConvertParams | {};
  status: "pending" | "running" | "done" | "failed";
}

interface CompressParams {
  maxSizeKB: number; // 50 ~ 10240
  quality?: number; // 0.1 ~ 1.0
}

interface ResizeParams {
  width: number; // 100 ~ 8000
  height: number; // 100 ~ 8000
  mode?: "contain" | "cover" | "fill";
}

interface ConvertParams {
  format: "jpeg" | "png" | "webp";
  reason?: string;
}
```

---

## 4. 浏览器端特征提取

### Worker 实现

特征提取在 Web Worker 中执行，不阻塞 UI。

**模糊检测算法（拉普拉斯方差）：**

1. Canvas 加载图片 → 缩放到 512×512（降低计算量）
2. 灰度化
3. 3×3 拉普拉斯核卷积：`[0,-1,0], [-1,4,-1], [0,-1,0]`
4. 计算卷积结果方差 → 归一化到 0-100
5. 阈值：> 30 判定为"可能模糊"

**背景纯白度检测：**

1. 提取四边各 5% 宽度的像素带
2. 统计 RGB 三通道均 > 250 的像素占比
3. 占比 > 0.95 → 判定为"纯白背景"

**批量处理策略：**

- 并发 Worker 数：`Math.min(4, navigator.hardwareConcurrency)`
- 队列 FIFO
- 每张图处理完立即释放 Canvas / ArrayBuffer
- Transferable Objects 零拷贝传输

---

## 5. LangChain Agent

### Agent 定义

```typescript
// server/lib/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tools } from "./tools";
import { buildSystemPrompt } from "./prompts";
import { retrievePlatformRules } from "./rag";

export async function createSmartCheckAgent(platform: string) {
  const platformRules = await retrievePlatformRules(platform);
  const systemPrompt = buildSystemPrompt(platform, platformRules);

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    streaming: true,
  });

  return createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  });
}
```

### Function Calling Tools

4 个工具，均带 Zod Schema 参数校验（防呆层）：

```typescript
// server/lib/tools.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const compressTool = tool(
  async ({ imageId, targetSizeKB, quality }) => {
    return JSON.stringify({
      action: "compress",
      imageId,
      params: {
        maxSizeKB: Math.max(50, Math.min(targetSizeKB, 10240)),
        quality: quality ?? 0.85,
      },
    });
  },
  {
    name: "compress_image",
    description: "压缩图片到目标大小。用于文件超过平台限制或优化加载速度。",
    schema: z.object({
      imageId: z.string().describe("图片唯一标识"),
      targetSizeKB: z.number().min(50).max(10240).describe("目标大小(KB)"),
      quality: z.number().min(0.1).max(1.0).optional().describe("压缩质量"),
    }),
  },
);

export const resizeTool = tool(
  async ({ imageId, width, height, mode }) => {
    return JSON.stringify({
      action: "resize",
      imageId,
      params: {
        width: Math.max(100, Math.min(width, 8000)),
        height: Math.max(100, Math.min(height, 8000)),
        mode: mode ?? "contain",
      },
    });
  },
  {
    name: "resize_image",
    description: "调整图片尺寸到平台要求。",
    schema: z.object({
      imageId: z.string(),
      width: z.number().min(100).max(8000),
      height: z.number().min(100).max(8000),
      mode: z.enum(["contain", "cover", "fill"]).optional(),
    }),
  },
);

export const convertTool = tool(
  async ({ imageId, targetFormat, reason }) => {
    return JSON.stringify({
      action: "convert",
      imageId,
      params: { format: targetFormat, reason },
    });
  },
  {
    name: "convert_format",
    description: "转换图片格式。用于平台不支持当前格式，或有更优选择时。",
    schema: z.object({
      imageId: z.string(),
      targetFormat: z.enum(["jpeg", "png", "webp"]),
      reason: z.string().optional(),
    }),
  },
);

export const stripExifTool = tool(
  async ({ imageId }) => {
    return JSON.stringify({
      action: "strip_exif",
      imageId,
      params: {},
    });
  },
  {
    name: "strip_exif_data",
    description: "清除 EXIF 元数据（GPS/设备信息），保护用户隐私。",
    schema: z.object({
      imageId: z.string(),
    }),
  },
);

export const tools = [compressTool, resizeTool, convertTool, stripExifTool];
```

### System Prompt

```typescript
// server/lib/prompts.ts
export function buildSystemPrompt(platform: string, ragRules: string) {
  return `你是 PixelSwift Smart Check AI，专业的电商产品图合规审计专家。

## 角色
分析用户上传的产品图片特征数据，根据 ${platform} 平台的图片规范，
逐张诊断问题并给出修复建议。

## 平台合规规则（来自知识库）
${ragRules}

## 工作流程
1. 接收图片特征 JSON 数组
2. 逐张对比平台规则
3. 不合规项调用对应修复工具 (compress/resize/convert/strip_exif)
4. 无法自动修复的（如白底问题）给出文字建议
5. 输出完整诊断报告

## 输出格式
对每张图片：
- 文件名 + 基本信息
- 每个检查项的通过/不通过
- 不通过项：原因 + 建议 + 调用修复工具
- 语气专业友好

## 安全边界
- 只能看到数字特征，看不到原图
- resize: 100px ~ 8000px
- compress: 50KB ~ 10MB
- 参数超界使用边界值并说明
- 不要编造规则，严格依据知识库`;
}
```

---

## 6. RAG 知识库

### 存储方案

```
数据库:     Supabase pgvector
嵌入模型:   text-embedding-3-small (OpenAI)
分片策略:   按 平台 + 规则类型 分 chunk（不做 PDF 自动切片）
Metadata:   { platform, rule_type, last_updated, source }
检索策略:   Metadata 过滤(platform) → 语义相似度 Top 6
```

### 检索实现

```typescript
// server/lib/rag.ts
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const vectorStore = new SupabaseVectorStore(
  new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
  {
    client: supabase,
    tableName: "platform_rules",
    queryName: "match_platform_rules",
  },
);

export async function retrievePlatformRules(platform: string): Promise<string> {
  const results = await vectorStore.similaritySearch(
    `${platform} product image requirements specifications`,
    6,
    { platform },
  );
  return results.map((doc) => doc.pageContent).join("\n\n");
}
```

### 知识库数据示例

```markdown
## Amazon 主图规范 (Main Image)

- 格式：JPEG, PNG, GIF, TIFF
- 最小尺寸：1000×1000 像素（推荐 2000×2000）
- 最大文件大小：10MB
- 背景：纯白 (RGB 255,255,255)
- 产品占比：≥ 85%
- 禁止元素：水印、Logo、促销文字、边框

## Shopify 产品图最佳实践

- 推荐尺寸：2048×2048（正方形最佳）
- 最大文件大小：20MB
- 格式：JPEG 或 PNG
- 建议统一宽高比
```

---

## 7. API 主入口

```typescript
// server/api/smart-check.post.ts
import { createSmartCheckAgent } from "../lib/agent";
import { LangChainAdapter } from "ai";
import { serverSupabaseUser } from "#supabase/server";

export default defineEventHandler(async (event) => {
  // 1. 鉴权
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, message: "请先登录" });

  // 2. 配额
  const quota = await checkDailyQuota(user.id);
  if (quota.remaining <= 0) {
    throw createError({
      statusCode: 429,
      message: `今日额度已用完 (${quota.used}/${quota.limit})`,
    });
  }

  // 3. 解析
  const { platform, images } = await readBody(event);

  // 4. Agent 分析
  const agent = await createSmartCheckAgent(platform);
  const stream = await agent.stream({
    messages: [
      {
        role: "user",
        content: `分析 ${images.length} 张产品图。平台：${platform}\n\n${JSON.stringify(images, null, 2)}`,
      },
    ],
  });

  // 5. 扣减配额
  await deductQuota(user.id);

  // 6. 流式返回
  return LangChainAdapter.toDataStreamResponse(stream);
});
```

---

## 8. 前端 Streaming 集成

```typescript
// composables/useSmartCheckAI.ts
import { useChat } from "@ai-sdk/vue";

export function useSmartCheckAI() {
  const fixPlan = ref<FixAction[]>([]);
  const analysisComplete = ref(false);

  const { messages, append, isLoading, error } = useChat({
    api: "/api/smart-check",

    onToolCall({ toolCall }) {
      fixPlan.value.push({
        action: toolCall.toolName,
        params: JSON.parse(toolCall.args),
        status: "pending",
      });
    },

    onFinish() {
      analysisComplete.value = true;
    },

    onError(err) {
      if (err.message.includes("401")) showLoginModal.value = true;
      else if (err.message.includes("429")) showQuotaExhausted.value = true;
    },
  });

  async function analyze(platform: string, features: ImageFeatures[]) {
    fixPlan.value = [];
    analysisComplete.value = false;
    await append({
      role: "user",
      content: JSON.stringify({ platform, images: features }),
    });
  }

  async function executeFixPlan() {
    for (const fix of fixPlan.value) {
      fix.status = "running";
      await executeLocalFix(fix); // 调用现有 WASM compress/resize/convert
      fix.status = "done";
    }
  }

  return {
    messages,
    analyze,
    fixPlan,
    executeFixPlan,
    isLoading,
    analysisComplete,
  };
}
```

---

## 9. 目录结构（新增/修改部分）

```
app/
├── pages/
│   └── smart-check/
│       ├── index.vue              # 主工具页
│       ├── amazon.vue             # SEO 着陆页
│       ├── shopify.vue
│       ├── etsy.vue
│       └── ebay.vue
├── components/smart-check/
│   ├── PlatformSelector.vue
│   ├── ImageDropZone.vue
│   ├── ImageGrid.vue
│   ├── AIReportPanel.vue
│   ├── ReportItem.vue
│   ├── FixPlanList.vue
│   ├── FixProgress.vue
│   ├── DownloadPanel.vue
│   └── LoginModal.vue
├── composables/
│   ├── useFeatureExtract.ts
│   ├── useSmartCheckAI.ts
│   └── useAutoFixer.ts
└── workers/
    └── feature-extract.worker.ts

server/
├── api/
│   └── smart-check.post.ts
├── lib/
│   ├── agent.ts
│   ├── tools.ts
│   ├── rag.ts
│   ├── prompts.ts
│   └── guardrails.ts
└── middleware/
    └── auth.ts
```

---

## 10. 成本估算

### 单次 AI 分析 Token 消耗

```
System Prompt:     ~300 tokens
RAG Context:       ~500 tokens
Feature JSON:      ~200 tokens (20张图)
Agent 推理+输出:   ~600 tokens
总计:              ~1,600 tokens
```

### 月成本

| 项目                    | 成本        |
| ----------------------- | ----------- |
| gpt-4o-mini（500次/天） | ~$15-30/月  |
| Supabase Free Tier      | $0          |
| Cloudflare Pages        | $0          |
| Embedding（一次性入库） | ~$0.5       |
| **月总成本**            | **~$15-30** |

---

## 11. 参数安全边界（Guardrails）

```typescript
// server/lib/guardrails.ts
export function validateFixAction(action: any): boolean {
  switch (action.action) {
    case "resize":
      return (
        action.params.width >= 100 &&
        action.params.width <= 8000 &&
        action.params.height >= 100 &&
        action.params.height <= 8000
      );
    case "compress":
      return action.params.maxSizeKB >= 50 && action.params.maxSizeKB <= 10240;
    case "convert":
      return ["jpeg", "png", "webp"].includes(action.params.format);
    case "strip_exif":
      return true;
    default:
      return false;
  }
}
```

前端在接收 Agent 返回的 Tool Call 结果后，**必须再做一层校验**，不合法的指令直接丢弃并提示"AI 参数异常，跳过该修复"。

---

## 12. 简历技术栈

```
Smart Check — AI 电商产品图合规审计引擎
技术栈：Nuxt 3 / LangChain.js / LangGraph / RAG / Supabase pgvector /
       Function Calling / Vercel AI SDK / Web Workers / WASM

• LangChain ReAct Agent 驱动合规审计，4 个 Function Calling Tool 自主编排修复

• "特征 JSON" 隐私架构：仅发送数字参数（不传原图），Token 成本降低 95%

• Supabase pgvector RAG：Metadata 过滤 + 语义检索

• Vercel AI SDK SSE 流式诊断报告

• 程序化 SEO：4 平台 × 8 语言 = 32 着陆页
```
