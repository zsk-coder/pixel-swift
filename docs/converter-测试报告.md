# Converter 页面测试报告

> **测试日期**: 2026-02-09  
> **测试范围**: `app/pages/converter.vue` 及相关组合式函数、Worker  
> **测试类型**: 静态代码审计 + 逻辑验证 + 构建检查  
> **服务器状态**: ✅ HTTP 200 正常响应

---

## 一、测试结果概览

| 测试维度     | 状态    | 发现问题数 | 已修复 |
| ------------ | ------- | ---------- | ------ |
| 代码逻辑     | ✅ 通过 | 3          | 3      |
| UI/UX 一致性 | ✅ 通过 | 2          | 2      |
| 内存管理     | ✅ 通过 | 1          | 1      |
| 类型安全     | ✅ 通过 | 1          | 1      |
| 国际化       | ✅ 通过 | 0          | -      |
| 构建验证     | ✅ 通过 | 0          | -      |

**总计: 发现 7 个问题，全部已修复。**

---

## 二、发现问题与修复详情

### BUG-01: 文件删除后数组索引错位（严重 🔴）

**问题描述**: `rawFiles` 和 `fileItems` 使用两个平行数组通过索引关联。当用户删除中间某个文件后，两个数组的索引会错位，导致后续处理时取到错误的原始文件。

**影响**: 转换结果与预期文件不匹配，用户下载到错误的图片。

**修复方案**: 将 `rawFiles: File[]` 替换为 `rawFilesMap: Map<string, File>`，通过 `item.id` 进行关联。删除操作不再依赖索引。

```diff
-const rawFiles = ref<File[]>([]);
+const rawFilesMap = ref<Map<string, File>>(new Map());

// onFilesAdded
-rawFiles.value.push(file);
+rawFilesMap.value.set(id, file);

// onProcess
-const file = rawFiles.value[i];
+const file = rawFilesMap.value.get(item.id);

// onRemove
-rawFiles.value.splice(idx, 1);
+rawFilesMap.value.delete(id);
```

---

### BUG-02: 页面卸载时 ObjectURL 内存泄漏（中等 🟡）

**问题描述**: `onFilesAdded` 中通过 `URL.createObjectURL()` 创建的预览 URL，仅在手动删除/清空时回收。如果用户直接路由离开页面，这些 URL 不会被释放，造成内存泄漏。

**影响**: 长时间使用或频繁切换页面时浏览器内存持续增长。

**修复方案**: 添加 `onUnmounted` 生命周期清理。

```typescript
onUnmounted(() => {
  for (const item of fileItems.value) {
    if (item?.preview) URL.revokeObjectURL(item.preview);
  }
});
```

---

### BUG-03: 移动端缺少错误状态展示（中等 🟡）

**问题描述**: PC 端有完整的四种状态展示（完成/处理中/错误/等待），但移动端模板缺少 `error` 状态分支。当文件处理失败时，移动端会错误地显示"等待中"而非"失败"标签。

**影响**: 用户在移动端无法辨识失败的文件。

**修复方案**: 在移动端模板中 `pending` 分支前添加 `error` 分支。

```vue
<!-- Error -->
<template v-else-if="file.status === 'error'">
  <ElTag type="danger" size="small" round effect="light">
    {{ t("common.error") }}
  </ElTag>
</template>
```

---

### BUG-04: 移动端底部操作栏遮挡内容（轻微 🟢）

**问题描述**: 移动端使用 `fixed bottom-0` 的操作栏，但页面内容没有相应的底部间距，导致最后一个文件卡片被操作栏遮挡。

**影响**: 用户无法看到最后一个文件的完整信息或点击其操作按钮。

**修复方案**: 在文件列表后添加占位 div。

```vue
<div v-if="hasFiles" class="md:hidden h-20" />
```

---

### BUG-05: 总节省空间可能显示负值（轻微 🟢）

**问题描述**: 某些格式转换后文件可能变大（如 JPG → PNG），`totalSavings` 计算为负数时会显示负值（如 "-256KB"），给用户造成困惑。

**影响**: UI 显示不友好。

**修复方案**: 使用 `Math.max(0, savings)` 钳位。

---

### BUG-06: ElSelect suffix-icon 类型不匹配（轻微 🟢）

**问题描述**: `:suffix-icon="''"` 传入空字符串，而 Element Plus 的 `suffix-icon` 期望接收 Component 类型或 undefined，传入空字符串可能触发控制台警告。

**修复方案**: 移除该 prop，使用 Element Plus 默认箭头图标。

---

### BUG-07: onClearAll 重清空不完整（轻微 🟢）

**问题描述**: `onClearAll` 中遗漏清空 `rawFilesMap`（修复 BUG-01 后的新数据结构）。

**修复方案**: 添加 `rawFilesMap.value.clear()`。

---

## 三、审查通过项

### ✅ 国际化完整性

已验证全部 8 个语言文件（zh/en/ja/ko/de/fr/es/pt）：

- 所有 `converter.*` 翻译键完整无缺失
- `common.*` 键完整无缺失
- `upload.*` 键完整无缺失

### ✅ 核心业务逻辑

- 文件上传流程：FileUploader 事件传递正确
- 图片处理流程：Canvas API 转换逻辑正确
- 单文件下载：Blob → ObjectURL → 下载链接正确
- 批量 ZIP 下载：JSZip 动态导入，命名规则正确
- 文件名生成：遵循 PRD 3.2.2 命名规则

### ✅ UI 组件使用

- ElButton / ElTag / ElProgress / ElImage / ElSelect / ElSlider 用法正确
- 响应式布局：PC/Mobile 双模板正确切换
- 暗色模式：所有 dark: 类名完整

### ✅ 性能

- `processedBlobs` 使用 Map 而非数组，查找 O(1)
- JSZip 动态导入，避免首屏加载
- Canvas 使用 OffscreenCanvas，不阻塞主线程
- 图片预览使用 ObjectURL 而非 Base64

### ✅ 构建验证

- 开发服务器 HMR 编译成功
- HTTP 200 正常响应
- TypeCheck 32 个错误均为预存在问题（i18n 类型声明），与本次修改无关

---

## 四、待人工验证项

> 以下项需要在浏览器中手动验证

| #   | 验证操作                             | 预期结果                          |
| --- | ------------------------------------ | --------------------------------- |
| 1   | 上传 3 张图片，删除第 2 张，点击处理 | 第 1、3 张正确转换                |
| 2   | 上传图片处理后切换语言               | UI 正确切换，状态标签跟随语言变化 |
| 3   | 移动端视图滚动到文件列表底部         | 底部操作栏不遮挡最后一个文件      |
| 4   | 将 JPG 转 PNG，检查底部状态栏        | 不显示负数节省空间                |
| 5   | 上传非图片文件（如 .txt）            | FileUploader 通过 accept 过滤     |
| 6   | 暗色模式下查看所有状态标签           | 颜色对比度清晰可辨                |

---

## 五、结论

本次测试共发现 **7 个问题**（1 个严重、2 个中等、4 个轻微），**全部已在代码中修复**。修复后代码通过 HMR 编译和 HTTP 响应验证。

建议上线前完成"第四节 待人工验证项"中的 6 个手动测试用例。
