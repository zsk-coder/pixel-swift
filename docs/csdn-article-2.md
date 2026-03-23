# CSDN 发帖文章（格式转换篇）

> **发布说明**：复制分隔线以后的内容到 CSDN 编辑器。标签：`前端` `WebAssembly` `Canvas` `图片格式转换` `浏览器端处理`
> **系列**：本文是 PixelSwift 技术实现系列第二篇（[第一篇：图片压缩](https://blog.csdn.net/qq_43318990/article/details/159354547)），讲图片格式转换的实现。

---

# Nuxt 4 实战：纯浏览器端图片格式转换——Canvas API 与 WASM 双路径策略

> 浏览器能不能直接把 PNG 转成 WebP？Canvas API 够用吗？Safari 不支持 WebP 编码怎么办？本文用完整代码讲清楚纯前端图片格式转换的实现，包括 Canvas 快速路径、WASM 兜底、Safari 兼容性检测、批量打包下载等细节。

> **📚 PixelSwift 技术实现系列**
> - 第一篇：[图片压缩 — MozJPEG/upng-js/libwebp WASM 编码器实战](https://blog.csdn.net/qq_43318990/article/details/159354547)
> - **第二篇：图片格式转换 — Canvas API 与 WASM 双路径策略**（本文）

## 前言

[上一篇](https://blog.csdn.net/qq_43318990/article/details/159354547)讲了怎么用 WASM 在浏览器端实现媲美 TinyPNG 的图片压缩。压缩的核心诉求是**减小体积**，需要专业编码器榨干每一个字节。

但格式转换不一样——核心诉求是**换个容器**，用户只关心**转得快不快**。浏览器自带的 Canvas API 就能做格式转换，速度比 WASM 快 3-5 倍。只有一种情况需要 WASM 兜底：**Safari 不支持 Canvas 编码 WebP**。

本文完整走一遍 [PixelSwift](https://pixelswift.site/) 格式转换功能的实现，核心是一个 **Canvas 优先 + WASM 兜底** 的双路径策略。

## 一、压缩 vs 转换：为什么架构不同

压缩和转换虽然都是「输入一张图片、输出一张图片」，但处理路径完全不同：

```
┌─────────────────────────────────────────────────────────────┐
│                   图片处理双路径架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  输入图片 → createImageBitmap 解码 → OffscreenCanvas 绘制   │
│                         │                                   │
│              ┌──────────┴──────────┐                        │
│              │                     │                        │
│         action=compress       action=convert                │
│              │                     │                        │
│              ▼                     ▼                        │
│    ┌──────────────────┐  ┌──────────────────────┐           │
│    │  getImageData()  │  │ canvas.convertToBlob()│           │
│    │  提取像素到 JS 堆 │  │  浏览器内置编码器     │           │
│    └────────┬─────────┘  └──────────┬───────────┘           │
│             │                       │                       │
│             ▼                       ▼                       │
│    ┌──────────────────┐  ┌──────────────────────┐           │
│    │  WASM 编码器     │  │  输出 Blob            │           │
│    │  (MozJPEG/       │  │  ~80ms ⚡             │           │
│    │   upng-js/       │  └──────────────────────┘           │
│    │   libwebp)       │                                     │
│    │  ~400ms          │  ⚠️ Safari WebP 不支持时             │
│    └──────────────────┘     降级到 WASM 路径                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 压缩模式（上一篇的方案）

WASM 编码器接收原始像素数据（ImageData），自己控制量化表、色彩空间转换、熵编码等每一个环节。好处是压缩率极高，缺点是慢——`getImageData()` 本身就是一次全像素拷贝，再加上 WASM 编码，一张 3MB 的图处理时间约 300-500ms。

### 1.2 转换模式（本文的方案）

关键区别：**跳过了 `getImageData()`，直接用 `convertToBlob()`**。

`convertToBlob()` 是 OffscreenCanvas 的原生方法，它让浏览器用内置编码器（C++ 实现）直接从 GPU 纹理或内存位图生成目标格式的二进制数据。不需要先把像素数据拷贝到 JS 堆内存，也不需要 WASM 再编码一遍。

**性能对比：**

| 操作 | 3MB JPEG → WebP | 说明 |
|------|-----------------|------|
| WASM 路径（getImageData + encode） | ~400ms | 两次拷贝 + WASM 编码 |
| Canvas 路径（convertToBlob） | ~80ms | 浏览器内置编码，快 5 倍 |

**结论**：格式转换追求速度，用 Canvas API；压缩追求极致体积，用 WASM。这就是双路径策略的由来。

## 二、Worker 内的双路径实现

格式转换和压缩复用同一个 Worker 文件（`imageProcessor.worker.ts`），通过 `action` 字段区分走哪条路径。

### 2.1 核心逻辑

```typescript
// imageProcessor.worker.ts - 编码阶段

const outputFormat = options.outputFormat || "jpg";
const qualityPercent = options.quality ?? 85;
let resultBuffer: ArrayBuffer;

if (action === "compress") {
  // ── 压缩模式：WASM 编码器 ──
  // 需要先提取像素数据给 WASM
  const imageData = ctx.getImageData(0, 0, outWidth, outHeight);

  if (outputFormat === "jpg") {
    resultBuffer = await wasmEncodeJPEG(imageData, qualityPercent);
  } else if (outputFormat === "png") {
    resultBuffer = await wasmEncodePNG(imageData, qualityPercent);
  } else if (outputFormat === "webp") {
    resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
  }
} else {
  // ── 转换/缩放模式：Canvas API（快速路径）──
  // 直接从 Canvas 输出，不经过 getImageData
  if (outputFormat === "webp" && !(await canCanvasEncodeWebP())) {
    // Safari 不支持 Canvas 编码 WebP，降级到 WASM
    const imageData = ctx.getImageData(0, 0, outWidth, outHeight);
    resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
  } else {
    // 快速路径：浏览器内置编码
    const mimeType = getMimeType(outputFormat);
    const quality = qualityPercent / 100;
    const resultBlob = await canvas.convertToBlob({
      type: mimeType,
      quality,
    });
    resultBuffer = await resultBlob.arrayBuffer();
  }
}
```

这段代码展示了双路径策略的核心：

1. **compress 模式**：无条件走 WASM，因为要最优压缩率
2. **convert / resize 模式**：默认走 Canvas API（快），只有 Safari + WebP 这一种组合走 WASM（兜底）

### 2.2 为什么只有 WebP 需要兜底

Canvas API 的 `convertToBlob()` 支持什么格式，取决于浏览器实现：

| 格式 | Chrome/Edge | Firefox | Safari |
|------|------------|---------|--------|
| image/jpeg | ✅ | ✅ | ✅ |
| image/png | ✅ | ✅ | ✅ |
| image/webp | ✅ | ✅ | ❌（Safari 16.3 以下）|

Safari 直到 16.4 版本（2023 年 3 月）才支持 Canvas WebP 编码。考虑到还有大量旧版 Safari 用户（尤其是 macOS Monterey 及以下的用户，系统锁定了 Safari 版本），WebP 编码必须做兼容处理。

**JPEG 和 PNG 不需要兜底**——所有现代浏览器都支持 Canvas 编码这两种格式。

## 三、Safari WebP 兼容性检测

检测方法很巧妙：创建一个 1×1 的 OffscreenCanvas，尝试编码成 WebP，检查输出的 MIME type 是否正确。

```typescript
let _canvasWebPSupport: boolean | null = null;

async function canCanvasEncodeWebP(): Promise<boolean> {
  if (_canvasWebPSupport !== null) return _canvasWebPSupport;
  try {
    const c = new OffscreenCanvas(1, 1);
    const blob = await c.convertToBlob({ type: "image/webp" });
    // 如果浏览器不支持 WebP 编码，它会静默降级为 PNG
    // 所以要检查输出的 MIME type 是否真的是 WebP
    _canvasWebPSupport = blob.type === "image/webp";
  } catch {
    _canvasWebPSupport = false;
  }
  return _canvasWebPSupport;
}
```

**几个细节：**

1. **结果缓存**：用闭包变量 `_canvasWebPSupport` 缓存检测结果，同一 Worker 生命周期内只检测一次
2. **静默降级陷阱**：Canvas API 不会在不支持某格式时报错，而是静默输出 PNG。这意味着你不能用 try-catch 来判断是否支持，**必须检查 `blob.type`**
3. **1×1 像素**：用最小的 Canvas 做检测，开销可忽略

> **踩坑**：我最初直接用 try-catch 来判断 WebP 支持，结果 Safari 用户上传 PNG 转 WebP，输出文件居然还是 PNG（只是扩展名变了）。查了半天才发现 `convertToBlob` 在不支持的格式下不抛异常。

## 四、透明通道处理——PNG 转 JPG 的经典坑

格式转换中最常见的 bug 就是透明背景变黑色。原因很简单：PNG 支持 alpha 通道，JPG 不支持。

```typescript
// Worker 内，绘制阶段
const canvas = new OffscreenCanvas(outWidth, outHeight);
const ctx = canvas.getContext("2d")!;

const formatLower = (options.outputFormat || "jpg").toLowerCase();
if (formatLower === "jpg" || formatLower === "jpeg") {
  // ⚠️ 关键：先填白底
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outWidth, outHeight);
}

ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);
```

**原理**：

Canvas 默认背景是透明的（RGBA 全 0）。PNG 图片的透明区域画上去后，这些像素的 RGBA 值是 `(0, 0, 0, 0)`。转 JPG 时丢弃 alpha 通道，变成 `(0, 0, 0)` = 纯黑色。

解决方案：**在画图之前先用白色填满整个 Canvas**。这样透明区域 = 白色，符合绝大多数用户的预期。

这个处理在压缩模式和转换模式中都需要做，是共用逻辑，放在了 Canvas 绘制步骤中。

## 五、批量处理与 JSZip 动态加载

### 5.1 串行处理队列

上一篇讲过，批量处理要串行，避免 WASM 内存溢出。格式转换虽然主要走 Canvas API（内存压力小得多），但为了统一架构、代码复用，仍然用串行方式：

```typescript
// converter.vue
async function onProcess() {
  if (!hasFiles.value || isBusy.value) return;
  isBusy.value = true;

  for (let i = 0; i < fileItems.value.length; i++) {
    const item = fileItems.value[i];
    if (!item || item.status === "done") continue;

    item.status = "processing";
    item.progress = 0;

    try {
      const file = rawFiles.value[i];
      if (!file) continue;

      const result = await processImage(file, {
        action: "convert",
        outputFormat: selectedFormat.value,
        quality: selectedFormat.value === "png" ? 100 : 92,
      });

      item.status = "done";
      item.progress = 100;
      item.processedSize = result.processedSize;
      item.outputFormat = selectedFormat.value;

      // 将转换结果存入 Map，等用户下载
      processedBlobs.value.set(item.id, result.blob);
    } catch {
      item.status = "error";
    }
  }

  isBusy.value = false;
}
```

**一个容易忽略的细节**：已完成（`status === "done"`）的文件会被跳过。这意味着用户可以中途添加新文件再点转换，不会重复处理已完成的文件。

### 5.2 批量下载：JSZip 动态导入

转换完多张图片后，用户可以一键下载为 ZIP 包。JSZip（压缩库）用动态 import 加载，不会增加首屏体积：

```typescript
// useDownload.ts
async function downloadAsZip(
  files: Array<{ blob: Blob; name: string }>,
  zipName: string,
): Promise<void> {
  // 动态导入 JSZip，只在用户点"下载全部"时才加载（约 40KB gzip）
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  downloadFile(content, zipName);
}
```

**文件命名规则**：

```typescript
function generateFileName(
  original: string,
  action: "convert" | "compress" | "resize",
  meta?: { format?: string },
): string {
  const baseName = original.replace(/\.[^.]+$/, "");
  const ext = meta?.format || "jpg";

  switch (action) {
    case "convert":
      // 转换：保留原名，改扩展名
      // photo.png → photo.webp
      return `${baseName}.${ext}`;

    case "compress":
      // 压缩：加 _compressed 后缀
      // photo.jpg → photo_compressed.jpg
      return `${baseName}_compressed.${ext}`;
  }
}
```

ZIP 包命名带日期戳：`pixelswift_convert_20260323.zip`，方便用户区分不同批次。

## 六、7 种输入 × 3 种输出：解码靠浏览器

格式转换支持 7 种以上输入格式（JPEG、PNG、WebP、BMP、GIF、AVIF、TIFF），但输出只有 3 种（JPG、PNG、WebP）。

你可能好奇：支持这么多输入格式，是不是每种都要装一个解码器？

**不需要。** 上一篇讲过，`createImageBitmap()` 是浏览器内置的高性能解码器，支持几乎所有主流图片格式：

```typescript
// 这一行代码就搞定了所有输入格式的解码
const blob = new Blob([buffer]);
const bitmap = await createImageBitmap(blob);
```

浏览器会自动识别文件的 magic bytes（文件头标识），调用对应的底层解码器（C++ 实现）。我们不需要做格式检测，不需要装任何解码库。

**输入格式 = 浏览器能力，输出格式 = 我们的编码器。** 这是架构设计的核心原则。

| 方向 | 技术 | 我们的工作量 |
|------|------|-------------|
| 输入解码 | `createImageBitmap()`（浏览器内置） | 零代码 |
| 输出编码 | Canvas API + WASM 兜底 | 本文的内容 |

所以 PixelSwift 格式转换页面的 `accept` 属性直接设成 `image/*`，让浏览器自己判断能不能解码：

```vue
<FileUploader accept="image/*" @files="onFilesAdded" />
```

## 七、性能数据

测试环境：Ryzen 5 笔记本，Chrome 130，16GB 内存

| 操作 | 文件大小 | 耗时 | 说明 |
|------|---------|------|------|
| PNG → JPG | 5MB | ~80ms | Canvas API 快速路径 |
| JPG → WebP (Chrome) | 3MB | ~90ms | Canvas API 快速路径 |
| JPG → WebP (Safari旧版) | 3MB | ~400ms | WASM 兜底路径 |
| BMP → PNG | 8MB | ~120ms | 大文件解码+编码 |
| AVIF → JPG | 2MB | ~60ms | AVIF 解码靠浏览器 |
| 10 张批量 PNG → WebP | 总 30MB | ~1.2s | 串行处理 |
| JSZip 打包 10 张 | - | ~200ms | 动态加载 + 打包 |

**对比在线工具（如 CloudConvert）：**

| 指标 | PixelSwift | CloudConvert |
|------|-----------|-------------|
| PNG → WebP 3MB | ~90ms | 3-8s（含上传下载） |
| 隐私 | 图片不离开浏览器 | 上传到服务器 |
| 费用 | 免费无限量 | 免费额度有限 |
| 批量限制 | 无限制 | 免费版每天 25 次 |

## 八、踩坑备忘

1. **Canvas WebP 静默降级**：`convertToBlob({ type: "image/webp" })` 在不支持的浏览器上不报错，输出 PNG。必须检查 `blob.type`
2. **PNG 转 JPG 黑底**：Canvas 透明区域在转 JPG 时变黑，解决方案是先 `fillRect` 白色
3. **quality 单位不统一**：Canvas `convertToBlob` 的 quality 范围是 0-1，WASM 编码器是 1-100。需要做 `/ 100` 换算
4. **Safari OffscreenCanvas**：Safari 16.4+ 才完整支持 OffscreenCanvas。更早版本需要检测或降级到主线程 Canvas
5. **JSZip 构建体积**：JSZip 约 40KB gzip，用 `await import("jszip")` 动态导入，不进首屏 bundle
6. **Transferable 后 buffer 失效**：transfer 后原始 buffer 归零，如果用户想重新转换，需要从 File 对象重新 `arrayBuffer()`

## 九、总结

格式转换的核心设计决策：

- **Canvas 优先**：`convertToBlob()` 比 WASM 快 3-5 倍，格式转换不需要极致压缩率，速度更重要
- **WASM 兜底**：仅在 Safari 不支持 Canvas WebP 编码时启用
- **解码免费**：`createImageBitmap()` 支持 7+ 种输入格式，不需要任何解码库
- **质量固定**：JPG/WebP 用 92%（视觉无损），PNG 用 100%（无损），用户不需要操心
- **动态加载**：JSZip 按需加载，不影响首屏性能

和上一篇（压缩篇）的对比：

| 维度 | 压缩模式 | 转换模式 |
|------|---------|---------|
| 核心诉求 | 体积最小 | 速度最快 |
| 编码路径 | WASM（MozJPEG/upng-js/libwebp） | Canvas API + WASM 兜底 |
| quality 控制 | 用户自定义（1-100） | 固定值（92/100） |
| 性能 | 300-500ms/张 | 60-120ms/张 |

下一篇讲图片缩放（resize）的实现，会涉及等比例计算、预设尺寸、以及缩放后的锐化处理。

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 图片压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

欢迎体验和评论区交流，上一篇：[Nuxt 4 + WebAssembly 实战：从零搭建媲美 TinyPNG 的浏览器端图片压缩工具](https://blog.csdn.net/qq_43318990/article/details/159354547)
