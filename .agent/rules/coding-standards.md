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

<template> ... </template>

<style scoped lang="scss"> ... </style>
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
  error.value = message;         // 更新 UI
  console.error("[模块名]", err); // 开发日志
} finally {
  isProcessing.value = false;    // 重置状态
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

| 类别 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `FileUploader.vue` |
| 页面文件 | kebab-case | `compress-image.vue` |
| Composable | use 前缀 + camelCase | `useImageProcessor.ts` |
| 工具函数 | camelCase | `formatDetector.ts` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 接口 / 类型 | PascalCase | `ProcessOptions` |

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
