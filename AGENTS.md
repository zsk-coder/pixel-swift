# PixelSwift AGENTS Guide

## 项目概览
- 这是一个 `Nuxt 4 + Vue 3 + TypeScript` 的图片工具与 AI Workflow Copilot 项目。
- 当前核心能力包括图片压缩、转换、缩放、博客/i18n 页面，以及基于 Supabase 的登录与试用额度骨架。
- 本文件只做入口地图；更深规则请继续读 `docs/agent/` 与 `.agents/skills/pixelswift-development/`。

## 技术栈
- 框架：`Nuxt 4`、`Vue 3`、`TypeScript`
- UI：`Element Plus`、`TailwindCSS`、`SCSS`
- 国际化：`@nuxtjs/i18n`，当前固定 **8 个语言文件**
- 认证：`@nuxtjs/supabase`
- 构建与测试：`npm run dev`、`npm run build`、`npm test`

## 开发前必须先读
- 架构地图：`docs/agent/architecture.md`
- 前端规范：`docs/agent/frontend-rules.md`
- 多语言清单：`docs/agent/i18n-checklist.md`
- 验证顺序：`docs/agent/verification-flow.md`
- 历史参考：`.agents/rules/` 与 `.agents/workflows/`

## 开发铁律
- 任何用户可见文案变更，**必须同步更新 `locales/` 下 8 个语言文件**：`en / zh / es / ja / de / fr / pt / ko`。
- 新功能、UI 调整、Bug 修复、重构、文案修改时，优先使用仓库 skill：`.agents/skills/pixelswift-development/`。
- UI 开发先查 `Element Plus` 是否已有合适控件；有就优先复用，不重复造轮子。
- 样式优先级固定为：**Tailwind token / 全局主题类 > Element Plus 主题覆盖 > scoped 自定义样式**。
- 新写逻辑和关键分支必须补**中文注释**，解释“为什么这样做、限制是什么、失败时会怎样”。

## 验证顺序
- 默认流程是：阅读相关代码与 locale -> 实现改动 -> **先跑 `npm run dev`** -> 访问真实页面/路由手动验证 -> 再跑相关测试 -> 最后才跑 `npm run build`。
- 不要把 `npm run build` 当成每次小改动的首选验证；它是最终回归和部署前检查。

## OpenAI / Codex 文档
- 如果任务涉及 OpenAI、Codex、模型、API、Agents、Docs MCP 或官方最佳实践，优先使用 OpenAI 官方文档与 Docs MCP。
- 推荐提示语：
  - `Use Docs MCP to look up the latest OpenAI/Codex documentation before answering.`
  - `Use Docs MCP to verify the newest official guidance instead of relying on memory.`
