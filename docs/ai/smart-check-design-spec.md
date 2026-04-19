# 📐 PixelSwift Workflow Copilot — Stitch UI 设计规格文档

> **用途**: 该文档用于驱动 Stitch 生成高保真 UI 图与页面结构方案。  
> **版本**: v1.0  
> **对应 PRD**: `smart-check-prd.md`  
> **设计目标**: 生成一套“AI 先做规划、用户再确认执行”的图片工作流界面，而不是聊天机器人界面，也不是传统参数表单工具界面。  
> **文档说明**: 保留 `smart-check-design-spec.md` 文件名以延续原有文档链路，但当前设计目标已升级为 `Workflow Copilot`。

---

## 1. 给 Stitch 的总指令

请生成一个 **桌面优先的 AI 工作流工具页面**，产品名为 **PixelSwift Workflow Copilot**。  
页面核心体验是：

- 用户先上传图片
- 再用一句自然语言描述目标
- AI 生成结构化处理计划
- 用户确认后执行
- 最后下载结果

请注意以下原则：

- **不要设计成聊天机器人**
- **不要设计成满屏表单参数面板**
- **不要设计成审计报告日志面板**
- **要设计成“AI 任务规划器 + 执行控制台”的产品**

页面气质应同时具备：

- 专业工具感
- AI Copilot 感
- 可执行工作流感
- 对非技术用户友好

关键词：

- `workflow`
- `command center`
- `AI planner`
- `structured execution`
- `batch image processing`

---

## 2. 产品背景说明

PixelSwift 已经有图片压缩、格式转换、尺寸调整、批量下载等能力，但当前用户仍然要自己配置参数。  
Workflow Copilot 的新价值是：

> 用户不需要自己决定“压缩多少、转什么格式、改多大尺寸”，只要说出目标，AI 就会生成一套可执行计划。

这是一个 **目标驱动型图片工作流产品**，而不是单一图片工具。

---

## 3. 目标用户

| 用户类型 | 描述 | 设计重点 |
| --- | --- | --- |
| 电商卖家 | Amazon / Shopify / 独立站用户 | 不懂复杂参数，需要明确结果导向 |
| 内容运营 | 博客、SEO、落地页运营 | 关心质量、体积、元数据和交付效率 |
| 代运营团队 | 批量处理不同客户素材 | 需要方案清晰、步骤可信、可批量导出 |

用户共性：

- 不想研究参数
- 希望“告诉系统目标后自动搞定”
- 需要看懂 AI 为什么这么建议
- 需要对最终执行步骤有掌控感

---

## 4. 页面设计目标

页面必须让用户一眼看懂三件事：

1. 我只要上传图片并描述目标
2. AI 会先给我一个计划，不会直接乱处理
3. 我确认后才执行，最后可以直接下载结果

因此页面层级要突出：

- `Upload`
- `Describe Goal`
- `Review Plan`
- `Run`
- `Download`

---

## 5. 总体页面结构

请生成一个 **单页面工作流工具页**，推荐路径为 `/workflow-copilot`。

页面自上而下由 8 个主要区块组成：

1. 顶部 Hero 区
2. 顶部账号状态入口
3. 图片上传区
4. AI 目标输入区
5. 任务计划预览区
6. 执行进度区
7. 结果导出区
8. FAQ / 说明区

页面布局建议：

- 页面宽度：`1200px - 1360px` 内容容器
- 桌面端两栏布局为主
- 移动端为垂直堆叠

---

## 6. 视觉方向

### 6.1 整体气质

请采用以下视觉风格：

- 偏现代 SaaS
- 带 AI 产品质感，但不要赛博浮夸
- 比传统后台更有产品感
- 比普通工具页更有流程感

### 6.2 参考方向

可参考这些产品的感觉，但不要照搬：

- Linear：布局克制、信息清晰
- Vercel：AI / workflow 产品感
- Notion AI：输入区与建议区的协作感
- GitHub Actions：步骤执行感
- Raycast：命令式交互感

### 6.3 颜色建议

不要沿用旧版紫色导向。推荐使用：

- 主色：深青蓝 / 石墨蓝
- 强调色：青绿色或电蓝色
- 成功：绿色
- 警告：琥珀色
- 错误：红色
- 中性色：灰白 + 深炭色

推荐 token：

| 角色 | 建议色值 |
| --- | --- |
| Primary | `#0F4C81` |
| Primary Hover | `#0B3C66` |
| Accent | `#14B8A6` |
| Surface | `#F7F8FA` |
| Border | `#E5E7EB` |
| Text Primary | `#111827` |
| Text Secondary | `#6B7280` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Error | `#DC2626` |

### 6.4 字体建议

避免默认的 Inter-only 普通工具味。推荐：

- 英文标题：`Manrope` / `Space Grotesk`
- 正文：`Inter` / `IBM Plex Sans`
- 数字与步骤：可使用等宽感更强的 `JetBrains Mono` 局部点缀

---

## 7. 页面详细规格

## 7.1 Hero 区

### 目标

在首屏 5 秒内让用户明白产品模式：

> 上传图片，用一句话描述目标，AI 自动生成执行计划。

### 必须包含

- 产品标题
- 副标题
- 主 CTA
- 次级说明
- 三步式价值说明

### 文案建议

| 要素 | 文案 |
| --- | --- |
| 标题 | `Turn image tasks into an AI-generated workflow.` |
| 副标题 | `Upload your images, describe the outcome you want, and let Workflow Copilot generate a structured processing plan.` |
| 主按钮 | `Try AI Planning` |
| 次按钮 | `See Example Tasks` |
| 辅助文案 | `No chat. No complex setup. Review the plan before execution.` |

### 视觉建议

- 左侧文字，右侧流程示意图或产品预览
- 右侧可用简洁步骤卡表达：
  - Upload
  - Describe
  - Plan
  - Run
  - Download

---

## 7.2 上传区

### 目标

让用户快速进入批次处理状态。

### 必须包含

- 大型拖拽上传区域
- 支持点击上传
- 批量文件说明
- 支持格式说明
- 已上传缩略图概览

### 文案建议

| 要素 | 文案 |
| --- | --- |
| 区域标题 | `Upload your images` |
| 主提示 | `Drag and drop images here, or click to browse` |
| 副提示 | `JPG, PNG, WebP, BMP, TIFF · Up to 20 files on free plan` |

### 交互状态

- 默认：虚线边框 + 上传图标
- Hover：背景浅色高亮
- Dragging：边框变主色实线
- Uploaded：展示缩略图网格和统计信息

### 上传后附加信息

显示一个批次摘要卡：

- `12 images uploaded`
- `Total size: 24.3 MB`
- `Formats: PNG, JPG`
- `Ready for AI planning`

---

## 7.3 顶部账号状态入口

### 目标

当前阶段不做独立个人中心页，但用户必须能在页面内快速看到账号状态与免费次数。

### 设计形式

推荐放在页面右上角，采用以下两种形式之一：

- 头像下拉菜单
- 轻量账号抽屉

### 必须展示的信息

- 用户头像
- 用户邮箱或昵称
- 当前计划：`Free` / `Pro`
- 剩余免费次数：如 `2 / 3`
- 升级入口
- 退出登录

### 视觉要求

- 尺寸轻量，不抢主工作流视觉焦点
- 但要足够清晰，让用户知道“我还剩多少次”
- 计划标签可做成 Badge，例如：
  - `Free`
  - `Pro`

### 文案建议

| 要素 | 文案 |
| --- | --- |
| 模块标题 | `Account` |
| 免费次数 | `2 of 3 free AI experiences left` |
| 升级按钮 | `Upgrade to Pro` |
| 退出按钮 | `Sign out` |

### 明确不做

- 不单独设计 Profile 页面
- 不设计复杂个人中心导航
- 不设计账单历史页面

---

## 7.4 AI 目标输入区

### 目标

这是页面核心交互区，必须让用户自然地输入目标，而不是像聊天窗口。

### 形式要求

- 一个大尺寸输入框或 command bar
- 上方有短标题
- 下方有快捷任务 chips
- 右侧或底部有主按钮：`Generate AI Plan`

### 绝对不要

- 聊天气泡
- 多轮消息列表
- 聊天头像
- “Assistant is typing...” 聊天式设计

### 推荐文案

| 要素 | 文案 |
| --- | --- |
| 标题 | `Describe what you want to do` |
| 占位符 | `Example: Prepare these images for Shopify product pages and keep them under 500KB.` |
| 主按钮 | `Generate AI Plan` |

### 快捷任务 chips

- `For Shopify`
- `For Amazon`
- `Compress for blog`
- `Prepare for SEO`
- `Convert to WebP`
- `Optimize for landing page`

### 附加提示

输入框下方加入一行说明：

`Workflow Copilot generates a plan first. Nothing runs until you confirm.`

---

## 7.5 登录弹窗

### 触发时机

用户已上传图片并输入目标，点击 `Generate AI Plan` 时触发。

### 目标

不要一开始就要求登录，而是在用户已经表达意图时再拦截。

### 弹窗必须包含

- 标题
- 免费试用说明
- Google 登录按钮
- 订阅说明简述

### 文案建议

| 要素 | 文案 |
| --- | --- |
| 标题 | `Sign in to generate your AI plan` |
| 说明 | `Every new account gets 3 free full experiences.` |
| 解释 | `Each experience includes AI planning, execution, and export for one batch.` |
| 按钮 | `Continue with Google` |
| 底部文案 | `After the 3 free experiences, a Pro subscription is required.` |

### 视觉风格

- 居中模态
- 白底或浅灰卡片
- 顶部有简洁锁 / spark 图标

---

## 7.6 计划预览区

### 目标

这是本产品最重要的界面。用户需要看到：

- AI 理解了什么目标
- AI 计划做哪些步骤
- 为什么这样做
- 有什么风险
- 哪些步骤可调

### 视觉形式

推荐采用 **结构化步骤卡片列表**，不是纯日志。

区块结构：

1. 计划摘要头部
2. 步骤卡片列表
3. 风险提示卡
4. 参数微调区域
5. 确认执行按钮

### 计划摘要头部

必须展示：

- 任务标题
- AI confidence
- 场景标签
- 图片数量

示例：

`Plan: Prepare images for Shopify product pages`

`Confidence: 91% · 12 images · E-commerce / Product`

### 步骤卡片列表

每个步骤卡必须包含：

- 步骤编号
- 动作名称
- 一句理由
- 主要参数
- 是否开启

示例卡：

```text
Step 1 · Resize
Set all images to 2048 × 2048 using fit mode
Reason: Shopify product pages benefit from consistent square layouts
[Enabled toggle]
```

卡片动作类型可能包括：

- Resize
- Convert Format
- Compress
- Generate Alt Text
- Rename Files
- Export CSV Metadata

### 风险提示卡

计划区底部必须有一个风险区块，用于显示 AI 识别到的潜在风险。

比如：

- `Some PNG files may lose detail after conversion`
- `Transparent backgrounds may not be preserved if converted to JPEG`
- `Aggressive compression may reduce visual fidelity on large hero images`

### 可调参数区域

MVP 只允许有限调整：

- 输出格式
- 压缩强度
- 是否生成 alt text
- 是否重命名
- 是否导出 metadata CSV

这部分应设计成轻量可调，不要回退成复杂设置页。

### 底部操作

- 主按钮：`Confirm and Run`
- 次按钮：`Regenerate Plan`
- 次次按钮：`Edit Goal`

---

## 7.7 执行进度区

### 目标

当用户点击确认后，页面切换到执行态。这里必须体现：

- 正在执行哪些步骤
- 进度推进
- 哪些文件已经完成
- 是否有警告或失败

### 推荐结构

- 顶部总进度条
- 当前步骤执行状态
- 文件级进度列表

### 文案示例

- `Running Step 2/4 · Convert Format`
- `8 of 12 files processed`
- `Estimated time remaining: 12s`

### 文件列表项

每个文件显示：

- 缩略图
- 文件名
- 当前状态
- 体积变化
- 成功 / 警告 / 失败图标

---

## 7.8 结果导出区

### 目标

让用户在完成后明确看到收益和导出入口。

### 必须包含

- 完成状态
- 处理收益概览
- 下载按钮
- 继续处理按钮

### 建议文案

| 要素 | 文案 |
| --- | --- |
| 标题 | `Your workflow is complete` |
| 说明 | `12 images processed · 8.4MB saved · metadata ready` |
| 主按钮 | `Download ZIP` |
| 次按钮 | `Download metadata CSV` |
| 辅助按钮 | `Start another workflow` |

### 完成页可加亮点

- 节省体积数字
- 处理步骤摘要
- 免费额度剩余提示 / 订阅提示

例如：

`You have 2 free AI experiences remaining`

或

`Free experiences used up. Upgrade to Pro to continue.`

---

## 7.9 订阅拦截状态

### 触发时机

用户已登录，但 3 次免费体验已全部用完。

### 目标

要让用户感受到：

- 产品已经有价值
- 只是试用额度用完
- 升级后可以继续工作流

### 设计形式

在点击 `Generate AI Plan` 后出现升级弹层或半页抽屉。

### 文案建议

| 要素 | 文案 |
| --- | --- |
| 标题 | `Your 3 free AI experiences are complete` |
| 说明 | `Upgrade to Pro to keep generating AI workflows for your image batches.` |
| 价值点 1 | `Continue using AI planning` |
| 价值点 2 | `Process up to 100 images per batch` |
| 价值点 3 | `Unlock more templates and plan history` |
| 主按钮 | `Upgrade to Pro` |
| 次按钮 | `Back to manual tools` |

---

## 8. 页面状态总表

页面至少要输出以下 9 个 UI 状态图：

1. 初始空状态
2. 顶部账号状态菜单展开态
3. 上传后待输入目标状态
4. 登录弹窗状态
5. AI 规划中状态
6. 计划预览状态
7. 执行中状态
8. 完成可下载状态
9. 免费额度耗尽订阅状态

如果 Stitch 支持多画板，请全部生成。

---

## 9. 组件清单

请在 UI 图中体现以下组件：

| 组件名 | 用途 |
| --- | --- |
| `HeroSection` | 首屏价值说明 |
| `ImageUploadZone` | 图片拖拽上传 |
| `BatchSummaryCard` | 上传后的批次摘要 |
| `AccountStatusMenu` | 账号状态入口 |
| `GoalInputBar` | AI 目标输入框 |
| `QuickTaskChips` | 快捷任务入口 |
| `LoginModal` | Google 登录弹窗 |
| `PlanSummaryCard` | AI 计划摘要 |
| `PlanStepCard` | 单个步骤卡片 |
| `RiskNoticeCard` | 风险说明 |
| `PlanAdjustPanel` | 轻量参数调整 |
| `ExecutionProgressPanel` | 执行进度 |
| `FileProgressList` | 文件级进度 |
| `ResultDownloadPanel` | 下载结果区 |
| `UpgradeModal` | 订阅弹窗 |

---

## 10. 文案语气规范

### 语气要求

- 专业但不冰冷
- 清楚解释，不堆术语
- 强调“计划先于执行”
- 强调“用户有最终确认权”

### 文案风格

- 按钮：动词开头
- 风险：清晰但不制造恐惧
- AI 理由：简洁、可信、偏操作建议

### 避免

- “魔法式”夸张 AI 文案
- “我来帮你全部搞定”这类过度承诺
- 聊天机器人口吻

---

## 11. 响应式要求

### 桌面端

- 主要设计宽度：`1440px`
- 内容容器：`1200-1360px`
- 计划预览区可采用左右布局：
  - 左：步骤列表
  - 右：风险与参数调整

### 平板端

- 区块堆叠
- 保留卡片感

### 移动端

- 上传区全宽
- 输入框放大触控区域
- 步骤卡垂直堆叠
- 执行进度与下载区简化

---

## 12. 输出要求

请至少生成以下 UI 图：

1. Workflow Copilot 首屏空状态
2. 顶部账号状态菜单展开态
3. 上传图片并输入目标后的状态
4. 登录弹窗
5. AI 计划生成后的计划预览态
6. 执行进度态
7. 完成下载态
8. 免费次数耗尽后的订阅弹窗

请确保所有设计图都满足以下核心认知：

- 这是 AI 工作流规划工具
- 用户输入的是目标，不是参数
- AI 给的是计划，不是聊天回复
- 执行前必须确认
- 免费 3 次后进入订阅转化

---

## 13. 最终设计结论

这个产品页面必须让用户感觉：

> “我不需要懂图片处理参数，我只要说目标，AI 会先给我一个靠谱计划，我确认后它再帮我执行。”

如果 UI 最终看起来像聊天机器人、日志终端，或传统参数工具页，就说明方向错了。
