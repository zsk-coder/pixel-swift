---
name: pixelswift-development
description: 在 PixelSwift 仓库内进行任何功能开发、UI 调整、Bug 修复、重构、认证改动或用户可见文案修改时使用。强制先读项目架构，要求同步 8 个语言文件，优先使用 Element Plus 和项目主题 token，复杂逻辑必须写中文注释，并且先用 `npm run dev` 验证，再跑 `npm run build`。
---

# PixelSwift 开发规范

在 PixelSwift 仓库内进行任何功能开发、UI 调整、Bug 修复、重构、认证接入、试用额度改动、用户可见文案修改时，都必须使用本 skill。

## 使用顺序
1. 先读 `references/architecture.md`
2. 根据任务类型继续读：
   - UI / 样式任务：`references/frontend-rules.md`
   - 文案 / i18n 任务：`references/i18n-checklist.md`
   - 完成验证：`references/verification-flow.md`
3. 再开始实现

## 强制规则
- **文案改动必须同步 8 个 locale 文件**
- **能用 Element Plus 就不要自己重造控件**
- **样式优先使用 Tailwind token、全局主题类、Element 主题覆盖**
- **复杂逻辑必须写中文注释**
- **优先用 `npm run dev` 做首轮验证，最后再跑 `npm run build`**

## 快速检查表
- 我是否先读了架构与相关规则？
- 我是否检查了现有组件/composable 是否可复用？
- 我是否同步更新了 8 个语言文件？
- 我是否优先使用了 Element Plus？
- 我是否避免了硬编码品牌主色？
- 我是否给新增复杂逻辑加了中文注释？
- 我是否先用 `npm run dev` + 真实页面做验证？

## 历史资料
- `.agents/rules/coding-standards.md`
- `.agents/rules/project.md`
- `.agents/workflows/ui-restore.md`

这些文件仍可参考，但以本 skill 与 `docs/agent/` 为当前主规范。
