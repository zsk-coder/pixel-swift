# ⚙️ PixelSwift Workflow Copilot — 技术规格文档

> **版本**: v1.0  
> **最后更新**: 2026-04-19  
> **对应 PRD**: `smart-check-prd.md`  
> **对应设计规格**: `smart-check-design-spec.md`  
> **文档说明**: 保留 `smart-check-tech-spec.md` 文件名以延续现有链路，但技术主线已升级为 `Workflow Copilot`。

---

## 1. 技术目标

Workflow Copilot 的技术目标不是做一个聊天接口，而是构建一个 **单轮目标输入 -> AI 结构化规划 -> 本地执行 -> 导出结果** 的完整系统。

系统必须满足：

- 用户只输入一句目标
- 服务端 AI 返回严格结构化的 `ProcessPlan`
- 前端只执行白名单动作
- 处理优先在浏览器本地完成
- 登录后才允许调用 AI
- 每个账号只有 3 次免费完整体验
- 免费额度用尽后必须进入订阅路径

---

## 2. 架构总览

### 2.1 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│                        Client (Nuxt)                       │
│                                                            │
│  Upload Images                                             │
│  Input Goal                                                │
│  Review AI Plan                                            │
│  Execute Local Pipeline                                    │
│  Download ZIP / CSV                                        │
└───────────────────────┬────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌────────────────────────────────────────────────────────────┐
│                     Server API (Nitro)                     │
│                                                            │
│  Auth / Trial Check                                        │
│  Build Planning Context                                    │
│  LangChain Planning Flow                                   │
│  Schema Validation                                         │
│  Return ProcessPlan JSON                                   │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│                     AI Orchestration                       │
│                                                            │
│  LangChain                                                 │
│  RAG Context Retrieval                                     │
│  Structured Output                                         │
│  Goal -> Plan Conversion                                   │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│                  Existing Processing Engine                │
│                                                            │
│  convert / compress / resize / download / zip             │
│  Worker / OffscreenCanvas / WASM                          │
└────────────────────────────────────────────────────────────┘
```

### 2.2 核心分层

| 层级 | 责任 |
| --- | --- |
| `UI Layer` | 上传、目标输入、计划预览、进度展示、导出 |
| `Planning API Layer` | 鉴权、额度检查、拼装规划上下文、调用 LangChain |
| `AI Planning Layer` | 理解目标、检索知识、生成结构化计划 |
| `Execution Layer` | 将 `ProcessPlan` 映射为本地图片处理动作 |
| `Persistence Layer` | 用户、免费额度、订阅状态、计划历史 |

---

## 3. 现有能力复用策略

### 3.1 直接复用

当前 PixelSwift 已有能力：

- 图片上传
- 压缩
- 格式转换
- 尺寸调整
- 批量处理
- ZIP 下载
- Worker / OffscreenCanvas / WASM

Workflow Copilot 不重写这些能力，而是在其上增加：

- 目标输入
- AI 规划
- 计划预览
- 订阅拦截
- 历史记录（后续）

### 3.2 新能力增加位置

| 新能力 | 建议位置 |
| --- | --- |
| `ProcessPlan` 生成 | `server/lib/copilot/planner.ts` |
| RAG 检索 | `server/lib/copilot/rag.ts` |
| Prompt 构造 | `server/lib/copilot/prompts.ts` |
| Plan 校验 | `server/lib/copilot/validators.ts` |
| 免费额度校验 | `server/lib/billing/trial.ts` |
| 前端计划执行器 | `app/composables/useWorkflowExecution.ts` |

---

## 4. 技术栈

### 4.1 现有栈

```text
Nuxt 3 / Vue 3 / TypeScript
Web Workers / OffscreenCanvas
WASM image encoders
JSZip
Element Plus
i18n
```

### 4.2 新增推荐依赖

```text
@langchain/core
@langchain/openai
@langchain/community
zod
@nuxtjs/supabase
ai (可选，仅当需要流式展示规划过程时)
```

### 4.3 后端基础设施

推荐继续使用：

- Supabase Auth：Google 登录
- Supabase Postgres：用户试用额度、订阅状态、历史计划
- 可选 pgvector：后续 RAG 检索

---

## 5. 核心流程

### 5.1 主流程

```text
用户上传图片
  -> 前端提取批次摘要
  -> 用户输入目标
  -> 点击 Generate AI Plan
  -> 检查登录
  -> 检查试用额度 / 订阅状态
  -> 服务端构建 PlanningContext
  -> LangChain 生成 ProcessPlan
  -> 服务端校验 ProcessPlan
  -> 前端展示计划
  -> 用户确认执行
  -> 前端逐步执行本地处理
  -> 生成导出文件
```

### 5.2 免费体验扣减时机

必须在以下条件同时满足时扣减 1 次：

- 用户已登录
- AI 成功返回合法 `ProcessPlan`

不在以下情况扣减：

- 用户未点生成计划
- 计划生成失败
- 计划 schema 校验失败
- 用户登录失败

---

## 6. 前端模块设计

## 6.1 页面结构

建议页面路径：

- `app/pages/workflow-copilot/index.vue`

页面核心组件：

```text
WorkflowCopilotPage
├── HeroSection
├── AccountStatusMenu
├── ImageUploadZone
├── BatchSummaryCard
├── GoalInputBar
├── QuickTaskChips
├── LoginModal
├── PlanSummaryCard
├── PlanStepList
├── PlanAdjustPanel
├── ExecutionProgressPanel
├── ResultDownloadPanel
└── UpgradeModal
```

## 6.2 关键 composables

### `useWorkflowCopilot.ts`

职责：

- 管理输入目标
- 请求生成计划
- 管理计划状态
- 管理计划错误和额度错误

接口建议：

```typescript
interface UseWorkflowCopilot {
  goal: Ref<string>
  status: Ref<CopilotStatus>
  plan: Ref<ProcessPlan | null>
  error: Ref<string | null>
  generatePlan: (payload: GeneratePlanInput) => Promise<void>
  resetPlan: () => void
}
```

### `useWorkflowExecution.ts`

职责：

- 将 `ProcessPlan.steps` 映射为现有处理能力
- 管理执行进度
- 记录每个文件的执行状态

接口建议：

```typescript
interface UseWorkflowExecution {
  executionStatus: Ref<ExecutionStatus>
  fileProgress: Ref<FileExecutionState[]>
  runPlan: (plan: ProcessPlan, files: UploadFile[]) => Promise<ExecutionResult>
  cancelRun: () => void
}
```

### `useTrialQuota.ts`

职责：

- 读取当前用户剩余免费次数
- 判断是否需要显示升级弹窗

### `useAccountStatus.ts`

职责：

- 管理当前登录用户基本资料
- 管理计划类型与剩余免费次数展示
- 为顶部账号菜单提供展示数据

接口建议：

```typescript
interface UseAccountStatus {
  user: Ref<AuthUser | null>
  planType: Ref<"free" | "pro" | null>
  remainingTrialCount: Ref<number | null>
  signOut: () => Promise<void>
  refreshStatus: () => Promise<void>
}
```

---

## 7. 数据模型

## 7.1 图片批次摘要 `BatchSummary`

前端不会把原图直接发给规划模型，而是先整理为摘要：

```typescript
interface BatchSummary {
  fileCount: number
  totalSizeBytes: number
  formats: string[]
  images: ImageDescriptor[]
}

interface ImageDescriptor {
  id: string
  fileName: string
  width: number
  height: number
  sizeBytes: number
  format: string
  hasAlpha?: boolean
}
```

## 7.2 目标输入 `GoalInput`

```typescript
interface GoalInput {
  text: string
  locale: string
  source: "manual" | "preset_chip"
  presetKey?: string
}
```

## 7.3 规划上下文 `PlanningContext`

这是服务端传给 LangChain 的核心上下文：

```typescript
interface PlanningContext {
  goal: GoalInput
  batch: BatchSummary
  templates: TaskTemplate[]
  retrievedKnowledge: RetrievedKnowledge[]
  limits: PlanLimits
}

interface PlanLimits {
  maxFilesPerBatch: number
  allowedActions: PlanAction[]
  allowedFormats: string[]
  allowAltTextGeneration: boolean
}
```

## 7.4 计划输出 `ProcessPlan`

这是本系统最核心的 schema，必须稳定且可校验：

```typescript
type PlanAction =
  | "resize"
  | "compress"
  | "convert_format"
  | "rename_files"
  | "generate_alt_text"
  | "strip_metadata"

interface ProcessPlan {
  taskSummary: string
  taskType: string
  confidence: number
  scene: string
  steps: PlanStep[]
  risks: PlanRisk[]
  exportPlan: ExportPlan
}

interface PlanStep {
  id: string
  action: PlanAction
  enabled: boolean
  reason: string
  params: Record<string, unknown>
}

interface PlanRisk {
  type: string
  message: string
  severity: "info" | "warning"
}

interface ExportPlan {
  zipName: string
  includeMetadataCsv: boolean
  filenamePattern?: string
}
```

## 7.5 执行结果 `ExecutionResult`

```typescript
interface ExecutionResult {
  successCount: number
  failureCount: number
  totalSavedBytes: number
  generatedFiles: ProcessedAsset[]
  metadataRows?: MetadataRow[]
}
```

---

## 8. LangChain 规划层

## 8.1 LangChain 的角色

LangChain 在该产品中负责：

- 任务理解
- 任务分类
- 场景知识检索
- 结构化计划生成
- 理由和风险说明

LangChain 不负责：

- 图片二进制处理
- 真实压缩、转换、缩放
- ZIP 导出

## 8.2 推荐规划链路

### Step 1：任务理解

输入：

- 用户自然语言目标
- 图片批次摘要

输出：

- 场景判断
- 任务类型
- 关键词提取

### Step 2：RAG 检索

按任务类型检索知识片段，例如：

- Shopify product images
- Amazon listing images
- Blog image performance
- SEO image metadata

### Step 3：计划生成

将：

- 用户目标
- 图片摘要
- 检索结果
- 平台限制

输入到结构化输出 prompt 中，生成合法 `ProcessPlan`

### Step 4：Schema 校验

服务端必须再次验证：

- `action` 必须在白名单中
- `confidence` 必须在 `0~1`
- `params` 必须符合具体 action 的约束
- 不允许出现未定义的步骤

---

## 9. RAG 设计

## 9.1 RAG 的用途

RAG 不用于聊天问答，而用于让规划更接近场景知识。

例如：

- Shopify 商品图推荐尺寸和格式
- Amazon 主图/辅图基础要求
- 博客配图与页面性能建议
- SEO 与 alt text 建议

## 9.2 知识组织方式

推荐按场景切分知识片段：

```typescript
interface RetrievedKnowledge {
  id: string
  scene: string
  source: string
  title: string
  content: string
}
```

场景标签示例：

- `shopify_product`
- `amazon_listing`
- `blog_image`
- `seo_metadata`

## 9.3 MVP RAG 方案

MVP 不一定要一开始上 pgvector，也可以先用：

- 本地结构化知识 JSON
- 关键词路由 + 场景过滤

如果要把 LangChain / RAG 明确写进简历，建议直接落一版：

- Supabase pgvector
- 场景 metadata 过滤
- top-k 检索

---

## 10. Prompt 设计

## 10.1 Prompt 目标

Prompt 必须逼模型做一件事：

> 将用户目标变成可执行的白名单动作计划，而不是输出散乱建议。

## 10.2 System Prompt 核心约束

必须明确告诉模型：

- 你不是聊天助手
- 你是图片工作流规划器
- 你只能输出 `ProcessPlan`
- 你不能输出未定义 action
- 你不能假设系统支持不存在的能力
- 你必须给每一步一个清晰理由
- 你必须输出潜在风险

## 10.3 示例 Prompt 结构

```typescript
export function buildPlannerPrompt(context: PlanningContext) {
  return `
You are PixelSwift Workflow Copilot.

Your job is to convert a user's image-processing goal into a valid ProcessPlan JSON.

Rules:
- Only use allowed actions.
- Do not output natural-language paragraphs outside JSON.
- Prefer minimal, effective plans.
- Respect batch limits.
- Include reasons and risks.

User goal:
${context.goal.text}

Batch summary:
${JSON.stringify(context.batch, null, 2)}

Allowed actions:
${JSON.stringify(context.limits.allowedActions)}

Knowledge:
${context.retrievedKnowledge.map((k) => k.content).join("\n\n")}
`;
}
```

---

## 11. Schema 校验与 Guardrails

## 11.1 Zod Schema

服务端必须对 `ProcessPlan` 做强校验。

```typescript
const planStepSchema = z.object({
  id: z.string(),
  action: z.enum([
    "resize",
    "compress",
    "convert_format",
    "rename_files",
    "generate_alt_text",
    "strip_metadata",
  ]),
  enabled: z.boolean(),
  reason: z.string().min(1),
  params: z.record(z.unknown()),
})

const processPlanSchema = z.object({
  taskSummary: z.string(),
  taskType: z.string(),
  confidence: z.number().min(0).max(1),
  scene: z.string(),
  steps: z.array(planStepSchema),
  risks: z.array(
    z.object({
      type: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning"]),
    }),
  ),
  exportPlan: z.object({
    zipName: z.string(),
    includeMetadataCsv: z.boolean(),
    filenamePattern: z.string().optional(),
  }),
})
```

## 11.2 Action 级参数校验

不同 action 必须有二次参数校验：

### `resize`

- width / height 允许范围
- mode 是否在支持列表中

### `compress`

- quality 范围 `1~100` 或 `0~1`
- targetMaxKB 不能小于底线

### `convert_format`

- 目标格式必须受支持

### `generate_alt_text`

- language 必须在系统支持语言列表内

---

## 12. API 设计

## 12.1 生成计划接口

### `POST /api/workflow-copilot/plan`

请求体：

```typescript
interface GeneratePlanRequest {
  goal: GoalInput
  batch: BatchSummary
}
```

响应：

```typescript
interface GeneratePlanResponse {
  remainingTrialCount: number
  plan: ProcessPlan
}
```

错误：

- `401` 未登录
- `402` 需要订阅
- `422` 计划生成失败 / schema 不合法
- `429` 频率限制

## 12.2 查询额度接口

### `GET /api/workflow-copilot/quota`

返回：

```typescript
interface TrialQuotaResponse {
  isAuthenticated: boolean
  remainingTrialCount: number
  hasSubscription: boolean
}
```

---

## 13. 登录、试用与订阅实现

## 13.1 登录

MVP 使用：

- Supabase Auth
- Google Provider

## 13.2 免费体验计数

推荐数据库字段：

```sql
users
- id
- email
- plan_type
- trial_total default 3
- trial_used default 0
- trial_remaining computed or synced
```

扣减逻辑：

- 成功返回合法 `ProcessPlan` 后 `trial_used + 1`

## 13.3 订阅状态

推荐字段：

```sql
subscriptions
- user_id
- status
- current_period_end
- provider
```

MVP 可以先只做状态占位，不一定接入完整支付，也可以：

- 第一版文档完整
- 实装时先做订阅占位弹窗

如果用户要求“继续使用就需要订阅付费”，那技术上应预留：

- `plan_type: free | pro`
- `hasSubscription: boolean`

## 13.4 轻量账号面板而非个人中心

MVP 阶段不实现独立个人中心页面，只实现顶部账号状态入口。

该入口必须能读取并展示：

- 用户头像
- 邮箱
- `plan_type`
- `remainingTrialCount`
- 升级入口
- 退出登录

推荐实现形态：

- 顶部 `AccountStatusMenu` 下拉菜单
- 或轻量 `AccountDrawer`

当前阶段明确不做：

- 独立 `/account` 页面
- 账单历史页
- 用户偏好设置页
- 团队成员管理页

---

## 14. 前端执行映射

## 14.1 映射策略

前端执行器必须将每个 `PlanStep.action` 映射到现有能力：

| action | 映射能力 |
| --- | --- |
| `resize` | `useImageProcessor.processImage(... action=resize)` |
| `compress` | `useImageProcessor.processImage(... action=compress)` |
| `convert_format` | `useImageProcessor.processImage(... action=convert)` |
| `rename_files` | `useDownload.generateFileName` 或新增命名工具 |
| `generate_alt_text` | 生成 metadata 行，不改二进制 |
| `strip_metadata` | 在输出时移除 EXIF / GPS |

## 14.2 执行顺序

推荐默认顺序：

1. `resize`
2. `convert_format`
3. `compress`
4. `strip_metadata`
5. `rename_files`
6. `generate_alt_text`

这样能减少中间状态复杂度。

---

## 15. 错误处理

## 15.1 计划阶段错误

| 错误 | 处理 |
| --- | --- |
| 未登录 | 弹登录框 |
| 试用已用完 | 弹升级弹窗 |
| 模型超时 | 提示“Plan generation timed out” |
| Schema 无效 | 记录日志 + 给用户通用错误 |

## 15.2 执行阶段错误

| 错误 | 处理 |
| --- | --- |
| 单图执行失败 | 标记单图失败，不影响整批继续 |
| 浏览器内存压力过大 | 中断并提示拆分批次 |
| ZIP 失败 | 允许重新导出 |

---

## 16. 目录结构建议

```text
app/
├── pages/
│   └── workflow-copilot/
│       └── index.vue
├── components/workflow-copilot/
│   ├── HeroSection.vue
│   ├── AccountStatusMenu.vue
│   ├── ImageUploadZone.vue
│   ├── BatchSummaryCard.vue
│   ├── GoalInputBar.vue
│   ├── QuickTaskChips.vue
│   ├── LoginModal.vue
│   ├── PlanSummaryCard.vue
│   ├── PlanStepList.vue
│   ├── PlanAdjustPanel.vue
│   ├── ExecutionProgressPanel.vue
│   ├── ResultDownloadPanel.vue
│   └── UpgradeModal.vue
├── composables/
│   ├── useWorkflowCopilot.ts
│   ├── useWorkflowExecution.ts
│   ├── useTrialQuota.ts
│   └── useAccountStatus.ts
└── types/
    └── workflow-copilot.ts

server/
├── api/workflow-copilot/
│   ├── plan.post.ts
│   └── quota.get.ts
├── lib/copilot/
│   ├── planner.ts
│   ├── prompts.ts
│   ├── rag.ts
│   ├── templates.ts
│   └── validators.ts
└── lib/billing/
    └── trial.ts
```

---

## 17. 非功能要求

## 17.1 性能

- 计划生成目标：`< 5s`
- 首屏加载：`< 3s`
- 批量执行优先复用现有性能策略

## 17.2 安全

- AI 规划阶段默认不上传原图
- 前后端都必须限制 action 白名单
- 免费次数扣减必须服务端执行

## 17.3 可观测性

建议埋点：

- 上传图片
- 输入目标
- 点击生成计划
- 登录成功
- 计划生成成功
- 计划确认执行
- 导出完成
- 点击升级

---

## 18. 简历表述建议

技术上这条线可以这样总结：

```text
Built an AI workflow planner for batch image processing.
Used LangChain + structured output + RAG to convert natural-language goals
into executable image-processing pipelines, then mapped the plans to a
browser-side processing engine (resize / compress / convert / export).
```

中文可表述为：

```text
构建面向图片处理场景的 AI Workflow Copilot，
通过 LangChain、RAG 和结构化输出将自然语言目标转为可执行工作流，
并映射到浏览器端图片处理引擎完成批量执行与导出。
```

---

## 19. 最终技术结论

这套方案的关键不是“让 AI 给建议”，而是：

> **让 AI 成为参数配置之前的决策层，把用户目标转成可执行计划。**

技术上必须坚持两个边界：

- AI 负责规划，不负责实际图片二进制处理
- 前端负责执行，不信任任何未校验的 AI 输出

只要这两个边界守住，Workflow Copilot 就能同时做到：

- AI 足够核心
- 成本可控
- 执行稳定
- 与现有 PixelSwift 能力高度复用
