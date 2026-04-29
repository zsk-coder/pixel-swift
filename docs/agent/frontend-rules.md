# PixelSwift 前端开发规则

## 1. UI 组件选型优先级
- 先查 `Element Plus` 是否已有现成控件。
- 上传、按钮、下拉、分页、弹层、消息、标签、进度、图片、滑块等场景，默认优先使用 `Element Plus`。
- 只有在 El Plus 无对应能力，或当前交互/视觉明显无法通过其定制满足时，才允许自实现。

## 2. 样式优先级
1. `tailwind.config.ts` 中的 token
2. `assets/scss/main.scss` 的全局主题类
3. `assets/scss/element-overrides.scss` 的 Element 变量覆盖
4. 组件内 `scoped` 自定义样式

## 3. 颜色与主题
- 禁止优先写死品牌主色 hex。
- 首选使用：
  - `text-primary` / `bg-primary`
  - `text-brand` / `bg-brand`
  - `surface` / `text` 相关 token
- 如必须新增颜色，先补到 `tailwind.config.ts`，再使用。
- Element Plus 的主题色优先通过 `assets/scss/element-overrides.scss` 覆盖，不要在单个组件里硬改全局主色。

## 4. 响应式
- 默认移动端优先。
- 新页面和新卡片必须考虑窄屏堆叠、按钮高度、滚动与无横向溢出。
- 不要只对桌面图还原；至少同步检查移动端结构与间距。

## 5. 中文注释（强制）
- 新增复杂逻辑、条件分支、边界处理、异步流程、状态切换必须写中文注释。
- 注释重点写：
  - 为什么这样做
  - 约束是什么
  - 失败时会怎样
- 简单模板结构和纯样式类名不要求逐行注释，但关键区块必须有中文分段注释。

## 6. 复用优先
- 公共头部、页脚、账号状态、上传、下载、额度、认证逻辑优先扩展现有组件/composable。
- 避免“为了一个页面重新写一套”。
