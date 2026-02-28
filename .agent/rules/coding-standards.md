---
description: PixelSwift 编码规范 — TypeScript / Vue / Nuxt / 质量标准
globs: "**/*.{ts,vue,js}"
alwaysApply: true
---

# 编码规范

---

## 一、TypeScript 类型安全

### 1.1 禁止 `any`（零容忍）

```ts
// ❌ 禁止（项目已知问题：FileUploader.vue）
(file: any) => { ... }

// ✅ 使用具体类型
import type { UploadFile } from 'element-plus'
(file: UploadFile) => { if (file?.raw) emit('files', [file.raw]) }
```

- 类型不明时使用 `unknown` + 类型守卫（Type Guard）。
- Element Plus 事件回调从 `element-plus` 导入对应类型。

### 1.2 禁止非空断言 `!`

```ts
// ❌ 禁止（项目已知问题：useImageProcessor.ts）
const ctx = canvas.getContext("2d")!;

// ✅ 显式检查
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");
```

### 1.3 显式类型标注

- 函数参数：必须标注类型。
- 导出函数返回值：推荐显式标注。
- `ref` 初始值无法推断时使用泛型：`ref<File | null>(null)`。

### 1.4 类型导入

- 必须使用 `import type { ... }` 语法（Tree-shaking 友好）。
- 复杂数据结构先定义 `interface`，再使用。

### 1.5 禁止 `@ts-ignore`

- 遇到类型错误必须修复根因，不得绕过检查。
- 唯一例外：第三方库已知 Bug（必须附带 Issue 链接）。

---

## 二、Vue 3 组件规范

### 2.1 SFC 结构顺序

```vue
<script setup lang="ts">
// 1. import type（类型导入）
// 2. composable 调用（useI18n、useHead 等）
// 3. defineProps / defineEmits
// 4. 响应式状态（ref / computed）
// 5. 方法
// 6. 生命周期钩子
</script>

<template>...</template>

<style scoped lang="scss">
...
</style>
```

### 2.2 Props & Emits

```ts
// ✅ Props：泛型 + withDefaults
const props = withDefaults(
  defineProps<{
    accept?: string;
    maxSize?: number;
  }>(),
  { accept: "image/jpeg,image/png", maxSize: 50 },
);

// ✅ Emits：泛型语法
const emit = defineEmits<{
  files: [files: File[]];
}>();
```

### 2.3 Composable 返回值

- 暴露的 `ref` 用 `readonly()` 包裹，防止外部意外修改。

```ts
// ✅ 项目标准（useImageProcessor.ts）
return {
  isProcessing: readonly(isProcessing),
  progress: readonly(progress),
  processImage,
};
```

### 2.4 禁止 Options API

- 不使用 `data()`、`methods`、`computed: {}`、`watch: {}` 等旧语法。
- 状态管理优先 `ref`（解构安全）而非 `reactive`。

---

## 三、代码质量

### 3.1 错误处理（必须完善）

```ts
// ✅ 标准模式
try {
  const result = await processImage(file, options);
} catch (err) {
  const message = err instanceof Error ? err.message : "处理失败";
  error.value = message; // 更新 UI
  console.error("[模块名]", err); // 开发日志
} finally {
  isProcessing.value = false; // 重置状态
}
```

- 所有 `async` 函数必须 `try/catch`。
- `finally` 中重置加载状态。

### 3.2 注释风格

- **语言**：中文。
- **内容**：解释"为什么"（Why），而非"在做什么"（What）。
- **分区注释**：使用项目已有风格：

```ts
// ─── 设置项 ────────────────────────────────
// ─── 文件状态 ───────────────────────────────
```

### 3.3 性能优化

- 大型库使用动态导入 `await import()`（如 JSZip）。
- 复杂逻辑用 `computed` 缓存，禁止在 template 中运算。
- 不需要响应式的大对象使用 `shallowRef`。
- `onUnmounted` 中释放 ObjectURL、移除事件监听器。

### 3.4 常量管理

- 魔法数字提取到 `utils/constants.ts`，使用 `as const`。

```ts
export const OUTPUT_FORMATS = ["jpg", "png", "webp", "pdf"] as const;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

---

## 四、命名规范

| 类别        | 规范                 | 示例                   |
| ----------- | -------------------- | ---------------------- |
| 组件文件    | PascalCase           | `FileUploader.vue`     |
| 页面文件    | kebab-case           | `compress-image.vue`   |
| Composable  | use 前缀 + camelCase | `useImageProcessor.ts` |
| 工具函数    | camelCase            | `formatDetector.ts`    |
| 常量        | UPPER_SNAKE_CASE     | `MAX_FILE_SIZE`        |
| 接口 / 类型 | PascalCase           | `ProcessOptions`       |

---

## 五、国际化（i18n）

- 所有用户可见文案使用 `t()` 函数，禁止硬编码。
- key 层级结构：`模块.分组.key`（如 `compressor.presets.extreme`）。
- 修改任何语言文件时，必须同步更新 **全部 8 种语言**。

## 六、SEO

每个页面必须配置 SEO：

```ts
useHead({
  title: t("seo.xxx.title"),
  meta: [
    { name: "description", content: t("seo.xxx.description") },
    { property: "og:title", content: t("seo.xxx.title") },
    { property: "og:description", content: t("seo.xxx.description") },
    { property: "og:type", content: "website" },
  ],
});
```

## 七、Git 提交规范

- **提交信息必须使用中文**。
- 格式：`类型: 描述`
- 常用类型：`修复`、`功能`、`优化`、`样式`、`重构`、`文档`

```bash
# ✅ 正确
git commit -m "修复: 批量模式下对比预览不显示的问题"
git commit -m "功能: 添加 GA4 隐私政策披露"

# ❌ 错误（禁止使用英文）
git commit -m "fix: batch mode preview not showing"
```

## 八、UI 一致性规范

### 8.1 修改 UI 前必须全面排查

修改任何 UI 样式、文案或功能时，**必须同时排查以下维度的一致性**：

- **移动端 vs 桌面端**：同一功能在不同视口下的**文案、样式、间距、功能**必须统一（例如移动端和桌面端必须使用相同的翻译 Key、展示相同的信息）。
- **单张模式 vs 批量模式**：共用的功能区域（设置面板、按钮、预设等）必须使用完全相同的样式代码和文案。
- **跨页面一致性**：相同功能的组件（如下载按钮、上传按钮）在不同页面间的样式、文案和交互行为必须统一。

### 8.2 禁止同一组件写两套样式

```vue
<!-- ❌ 禁止：同一个预设按钮在不同模式下使用不同的样式 -->
<!-- 单张模式 -->
<button class="rounded-xl border-2 ...">
<!-- 批量模式 -->
<button class="rounded-lg border ...">

<!-- ✅ 正确：复用完全相同的样式，或抽取为组件 -->
<button class="rounded-xl border-2 ...">
```

### 8.3 多语言同步检查清单

修改文案时，按以下清单逐一确认：

1. 确认涉及的所有翻译 Key（包括移动端/桌面端可能使用不同 Key 的情况）。
2. 全部 **8 种语言**（zh / en / ja / ko / es / de / fr / pt）都已更新。
3. 同一功能在不同页面使用的 Key 保持一致。

### 8.4 新增 UI 元素必须逐属性对照

新增按钮、卡片等 UI 元素时，必须**逐项复制参照元素的完整 class 列表**（高度、圆角、字号、字重、图标大小、间距等），然后仅修改差异部分（如文字内容、颜色）。禁止凭记忆手写样式。

```vue
<!-- ❌ 禁止：参照按钮是 !h-12 !text-base !font-bold text-[20px]，新按钮随手写 -->
<ElButton class="!w-full !h-12 !rounded-xl !ml-0 mt-2">
  <span class="material-symbols-outlined text-sm mr-1">restart_alt</span>
  重置
</ElButton>

<!-- ✅ 正确：完整复制参照按钮的所有属性，仅改文案和颜色 -->
<ElButton class="!w-full !h-12 !rounded-xl !ml-0 !text-base mt-2">
  <span class="material-symbols-outlined text-[20px] mr-1">restart_alt</span>
  重置
</ElButton>
```
