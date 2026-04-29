# 前端规则速记

## 组件
- 上传、按钮、下拉、分页、弹层、消息、标签、进度、图片、滑块等优先使用 `Element Plus`
- 只有 El Plus 明显不适合时才自实现

## 样式优先级
1. `tailwind.config.ts` token
2. `assets/scss/main.scss` 全局类
3. `assets/scss/element-overrides.scss`
4. `scoped` 自定义样式

## 颜色
- 不优先硬编码品牌主色 hex
- 先用 `primary / brand / surface / text` 等 token

## 注释
- 新增复杂逻辑、边界分支、状态切换必须写中文注释

更完整说明见：`docs/agent/frontend-rules.md`
