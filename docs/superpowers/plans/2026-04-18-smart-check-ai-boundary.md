# Smart Check AI Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不牺牲产品定位清晰度的前提下，为 Smart Check 定义一条可执行的 MVP 落地路径，明确哪些能力必须用 AI，哪些能力先用规则引擎和现有图像处理能力完成。

**Architecture:** Smart Check 采用“双层判断”架构：浏览器端先做确定性特征提取和可自动修复动作，服务端再用 AI 对平台规则、批量结果和用户可读报告做解释与编排。第一阶段优先完成 Amazon 主图与基础多平台规则检查，后续再扩展到更多平台与更强 AI 能力。

**Tech Stack:** Nuxt 3、Vue 3、TypeScript、Web Worker、Canvas/WASM、Supabase Auth、LangChain/LangGraph、Vercel AI SDK、Supabase pgvector

---

### Task 1: 收紧产品定位

**Files:**
- Modify: `docs/ai/smart-check-prd.md`
- Modify: `docs/ai/smart-check-design-spec.md`
- Reference: `docs/ai/smart-check-tech-spec.md`

- [ ] 把一句话定位从“AI 驱动的电商商品图合规审计”收紧为“上架前检查并修复商品图，避免被平台拒图”。
- [ ] 把主要用户收紧为“跨境电商运营 / Amazon 与多平台卖家”，把独立站与社媒运营降级为次级受众。
- [ ] 把 MVP 的核心价值统一成四件事：`检查`、`解释`、`修复`、`下载`。
- [ ] 把 AI 从“对外第一卖点”调整为“内部核心能力”，对外优先强调：`避免拒图`、`减少返工`、`不上传原图`。
- [ ] 把“SEO 着陆页”从 MVP 主叙事中降级为获客策略，不和主工具定位混写。

**完成标准：**
- PRD 首页 30 秒内能回答三个问题：给谁用、解决什么问题、为什么值得现在做。
- 设计稿标题、副标题、登录文案、分析面板文案与 PRD 表达一致。

### Task 2: 明确 AI 与非 AI 的边界

**Files:**
- Modify: `docs/ai/smart-check-tech-spec.md`
- Modify: `docs/ai/smart-check-design-spec.md`

- [ ] 把“无需 AI 的能力”单独列出来：尺寸、大小、格式、EXIF、GPS、透明通道、背景白度、基础模糊度、批量压缩、尺寸调整、格式转换、ZIP 下载。
- [ ] 把“必须用 AI 的能力”单独列出来：多平台规则解释、用户可读诊断报告、修复动作编排、不可自动修复项建议、后续规则扩展。
- [ ] 把“以后可选 AI”列出来：主体检测、违规元素检测、商品占比检测、文本/水印检测、白底自动生成。
- [ ] 在技术方案中明确：MVP 不依赖 AI 才能完成基本校验，AI 负责提升可理解性和扩展性。

**完成标准：**
- 团队成员能一眼看出哪些模块可以先本地完成，哪些模块必须等后端 AI 通路。
- 即使 AI 接口暂时不可用，产品仍可做“规则检查版 Smart Check”。

### Task 3: 重新定义 MVP 范围

**Files:**
- Modify: `docs/ai/smart-check-prd.md`
- Modify: `docs/ai/smart-check-tech-spec.md`

- [ ] Phase 1 只聚焦 `Amazon 主图`，作为最硬规则、最强痛点、最容易验证价值的切入口。
- [ ] Phase 2 再扩 `Amazon 副图 + Shopify + Etsy + eBay`，但保持同一套工作流。
- [ ] 把“登录、配额、AI 流式分析、自动修复、下载”保留在 MVP。
- [ ] 把“32 个 SEO 着陆页”从主开发关键路径移出，放到上线后或并行获客阶段。

**推荐分期：**
- P0：Amazon 主图检查 + 自动修复
- P1：登录 + 配额 + 流式报告
- P2：多平台扩展
- P3：SEO 页与增长

**完成标准：**
- 任意一个阶段单独上线都能形成完整价值闭环。

### Task 4: 第一阶段交付计划

**Files:**
- Create: `app/pages/smart-check/index.vue`
- Create: `app/components/smart-check/PlatformSelector.vue`
- Create: `app/components/smart-check/ImageDropZone.vue`
- Create: `app/components/smart-check/ImageGrid.vue`
- Create: `app/components/smart-check/AIReportPanel.vue`
- Create: `app/components/smart-check/FixPlanList.vue`
- Create: `app/components/smart-check/FixProgress.vue`
- Create: `app/components/smart-check/DownloadPanel.vue`
- Create: `app/components/smart-check/LoginModal.vue`
- Create: `app/composables/useFeatureExtract.ts`
- Create: `app/composables/useSmartCheckAI.ts`
- Create: `app/composables/useAutoFixer.ts`
- Create: `app/workers/feature-extract.worker.ts`
- Create: `server/api/smart-check.post.ts`
- Create: `server/lib/agent.ts`
- Create: `server/lib/tools.ts`
- Create: `server/lib/rag.ts`
- Create: `server/lib/prompts.ts`
- Create: `server/lib/guardrails.ts`

- [ ] 先完成空状态、平台选择、图片拖拽、预览列表。
- [ ] 再完成浏览器端特征提取和结果缓存。
- [ ] 再接入登录弹窗与配额门槛。
- [ ] 再接 AI 流式报告。
- [ ] 最后接本地自动修复与 ZIP 下载。

**完成标准：**
- 用户可以从“上传图片”一路走到“下载修复结果”。

### Task 5: Amazon 主图的最小可用检查集

**Files:**
- Modify: `docs/ai/smart-check-prd.md`
- Modify: `docs/ai/smart-check-tech-spec.md`
- Implement later in: `app/composables/useFeatureExtract.ts`, `server/lib/tools.ts`

- [ ] 检查项保留为：
  - 文件大小
  - 宽高尺寸
  - 文件格式
  - EXIF / GPS
  - 背景白度
  - 基础模糊提示
- [ ] 自动修复项保留为：
  - 压缩
  - 尺寸调整
  - 格式转换
  - EXIF 清除
- [ ] 仅提示不自动修复：
  - 背景不够白
  - 图像疑似模糊
  - 商品占比不够
  - 文字/水印/多主体

**完成标准：**
- 检查项和修复项一一对应，用户能理解为什么能修、为什么不能修。

### Task 6: AI 模块的职责约束

**Files:**
- Modify: `docs/ai/smart-check-tech-spec.md`
- Modify: `server/lib/prompts.ts`
- Modify: `server/lib/tools.ts`
- Modify: `server/lib/guardrails.ts`

- [ ] 约束 AI 只接收 `ImageFeatures[]`，不接原图。
- [ ] 约束 AI 只能输出平台诊断与 `FixAction[]`，不能直接处理二进制文件。
- [ ] 所有可执行动作都必须再经过前后端参数校验。
- [ ] 对超边界或无法修复的情况，AI 统一改为“解释 + 建议”，不能瞎编修复方案。

**完成标准：**
- AI 负责“判断与编排”，浏览器负责“实际执行”。
- 安全边界和隐私卖点与 PRD 保持一致。

### Task 7: 增长与获客的独立计划

**Files:**
- Modify: `docs/ai/smart-check-prd.md`
- Later create: `app/pages/smart-check/amazon.vue`
- Later create: `app/pages/smart-check/shopify.vue`
- Later create: `app/pages/smart-check/etsy.vue`
- Later create: `app/pages/smart-check/ebay.vue`

- [ ] 把工具主链路和 SEO 获客链路拆开管理。
- [ ] 工具先验证产品价值：上传率、分析率、修复率。
- [ ] SEO 后验证获客价值：页面收录、关键词排名、自然流量。
- [ ] 每个着陆页都要围绕“平台规则解释 + 工具入口”，而不是做成泛博客。

**完成标准：**
- SEO 不阻塞核心工具交付。
- 主产品定位不会被内容站稀释。

### Task 8: 决策门槛与下一阶段扩展

**Files:**
- Modify: `docs/ai/smart-check-prd.md`

- [ ] 当 Amazon 主图版证明有价值后，再扩展多平台。
- [ ] 当修复转化率和回访率足够高后，再考虑订阅。
- [ ] 当规则型检查无法覆盖主要用户投诉时，再引入更重的视觉 AI。

**建议门槛：**
- 30 天内：
  - 分析启动率 > 25%
  - 分析到修复执行率 > 40%
  - 修复后下载率 > 30%
- 满足以上指标后，进入下一阶段：
  - 扩 Shopify / Etsy / eBay
  - 扩更多视觉检测项
  - 扩付费版

---

## 计划结论

1. Smart Check 继续用 AI，但 AI 不再作为产品对外第一定位。
2. MVP 应该优先交付“Amazon 主图检查 + 一键修复”。
3. 技术上采用“本地确定性规则 + 服务端 AI 编排”的双层方案最稳。
4. SEO、更多平台、重视觉模型都应排在核心闭环之后。
