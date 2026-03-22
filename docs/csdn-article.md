# CSDN 发帖文章（压缩篇）

> **发布说明**：复制分隔线以后的内容到 CSDN 编辑器。标签：`前端` `WebAssembly` `Nuxt` `Vue.js` `图片压缩`
> **系列**：本文是 PixelSwift 技术实现系列第一篇，后续还有格式转换篇和图片缩放篇。

---

# Nuxt 4 + WebAssembly 实战：从零搭建媲美 TinyPNG 的浏览器端图片压缩工具

> TinyPNG 的核心原理是什么？MozJPEG 的 WASM 版怎么在 Nuxt 4 里跑起来？Web Worker + OffscreenCanvas 怎么配合做图片处理？本文用完整代码走一遍纯前端图片压缩工具的实现全流程。

## 前言

你有没有想过，TinyPNG 把你的图片压小了 70%，它到底做了什么？答案是：JPEG 用的 MozJPEG 编码器，PNG 用的是有损量化（把 1600 万色降到 256 色）。这些算法本身是开源的，而且都已经有了 WebAssembly 移植版。

换句话说，**你完全可以在浏览器里跑跟 TinyPNG 一样的压缩算法，不需要任何服务端**。

我最近在做 [PixelSwift](https://pixelswift.site/)，就是基于这个思路实现的纯前端图片工具。本文是系列第一篇，完整走一遍图片压缩功能的技术实现，从 Vite 配置 WASM 到 Web Worker 通信到三种格式的编码引擎。

## 一、整体架构设计

### 1.1 技术栈

| 层 | 技术 | 选型理由 |
|---|------|---------|
| 框架 | Nuxt 4 + Vue 3 | SSR 做 SEO 页面，CSR 做交互 |
| 构建 | Vite + vite-plugin-wasm | 处理 .wasm 文件导入 |
| JPEG 压缩 | @jsquash/jpeg (MozJPEG WASM) | Mozilla 出品，压缩率最优 |
| PNG 压缩 | upng-js | 有损量化，原理同 TinyPNG |
| WebP 压缩 | @jsquash/webp (libwebp WASM) | Google 出品 |
| 并行 | Web Worker + OffscreenCanvas | 不阻塞主线程 |
| 部署 | Cloudflare Pages | 全球 CDN，免费 |

### 1.2 三层架构

```
┌─────────────────────────────────────────────┐
│  UI 层（主线程）                              │
│  compress-image.vue                          │
│  - 文件上传/拖拽                              │
│  - quality 滑块 + 预设（极限/推荐/轻度/无损）  │
│  - 压缩前后对比滑块                           │
│  - 批量文件列表 + 进度                         │
│  - 单文件/批量下载（ZIP）                      │
└──────────────┬──────────────────────────────┘
               │ postMessage(buffer, [buffer])
               │ Transferable 零拷贝传输
               ▼
┌─────────────────────────────────────────────┐
│  处理层（Worker 线程）                        │
│  imageProcessor.worker.ts                    │
│  - createImageBitmap() 解码                  │
│  - OffscreenCanvas 绘制                      │
│  - getImageData() → 像素数据                  │
│  - 调用 WASM 编码器                           │
└──────────────┬──────────────────────────────┘
               │ import()
               ▼
┌─────────────────────────────────────────────┐
│  编码层（WASM）                               │
│  MozJPEG / upng-js / libwebp                 │
│  - 接收 ImageData（RGBA 像素数组）             │
│  - 执行压缩算法                               │
│  - 返回编码后的 ArrayBuffer                    │
└─────────────────────────────────────────────┘
```

### 1.3 为什么是这个架构

**为什么用 Web Worker？** 图片编码是 CPU 密集操作。MozJPEG 编码一张 3MB 的图片，主线程会卡死约 2 秒——页面冻结、滑块拖不动、动画停止。放到 Worker 里，主线程始终流畅。

**为什么用 OffscreenCanvas？** Worker 线程没有 DOM，不能用 `<canvas>` 元素。OffscreenCanvas 是 Canvas API 在 Worker 中的等价物，Chrome/Edge/Firefox/Safari 16.4+ 都支持。

**为什么用 Transferable？** 一张 5MB 图片的 ArrayBuffer，普通 `postMessage` 会完整复制一份（内存占用翻倍）。用 Transferable 是所有权转移，零拷贝，不产生额外内存开销。

## 二、配置 Vite 支持 WASM（第一步）

在 Nuxt/Vite 中用 WASM 不是装个包就行的，需要特殊配置。如果你直接 import @jsquash 的包，会报这个错：

```
TypeError: Failed to execute 'compile' on 'WebAssembly': 
Incorrect response MIME type. Expected 'application/wasm'.
```

**原因**：Vite 预构建（`optimizeDeps`）会把依赖重写成 ESM bundle，但 @jsquash 内部通过 `fetch()` 加载 `.wasm` 文件。预构建过程会破坏 WASM 文件的引用路径，导致运行时找不到 `.wasm` 文件。

**完整配置：**

```typescript
// nuxt.config.ts
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineNuxtConfig({
  vite: {
    plugins: [
      wasm(),              // 让 Vite 正确处理 .wasm 导入
      topLevelAwait(),     // 支持 WASM 模块的 top-level await
    ],
    worker: {
      format: "es" as const,
      plugins: () => [wasm(), topLevelAwait()],  // ⚠️ Worker 内也要配！
    },
    optimizeDeps: {
      exclude: ["@jsquash/webp", "@jsquash/jpeg", "@jsquash/oxipng"],
    },
  },
});
```

> **踩坑**：`worker.plugins` 容易漏配。我当时只配了主线程的 `plugins`，dev 环境没问题（Vite dev server 会正确设置 WASM 的 MIME type），但 build 后部署到 Cloudflare Pages，Worker 内加载 WASM 就炸了。**卡了一整天才发现是 Worker 内缺少 wasm 插件**。

## 三、编写 Web Worker 处理管线（第二步）

这是核心部分，Worker 文件包含完整的图片处理管线。

### 3.1 输入输出类型定义

```typescript
// imageProcessor.worker.ts

// 主线程发给 Worker 的消息
export interface WorkerInput {
  id: string;          // 消息 ID，用于匹配请求和响应
  action: "compress";  // 本篇只讲压缩
  buffer: ArrayBuffer; // 图片的原始二进制数据
  options: {
    outputFormat?: string;  // "jpg" | "png" | "webp"
    quality?: number;       // 1-100
  };
}

// Worker 返回给主线程的消息
export interface WorkerOutput {
  id: string;
  type: "progress" | "complete" | "error";
  progress?: number;   // 0-100 进度
  result?: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}
```

> 前面的类型定义不要跳过。Worker 通信是无类型的（`postMessage` 接受 `any`），TS 类型约束能帮你在编译期就抓住消息格式不匹配的 bug。

### 3.2 解码阶段：从二进制到像素数据

```typescript
self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { id, buffer, options } = e.data;
  
  try {
    // 上报进度：10%
    postMessage({ id, type: "progress", progress: 10 });

    // 第一步：把原始二进制数据解码成 ImageBitmap
    // createImageBitmap 是浏览器内置的图片解码器
    // 支持 JPEG、PNG、WebP、BMP、GIF、AVIF、TIFF 等几乎所有格式
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);
    // bitmap 现在包含了原始像素数据和尺寸信息

    // 上报进度：20%
    postMessage({ id, type: "progress", progress: 20 });

    // 第二步：绘制到 OffscreenCanvas 获取 ImageData
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;

    // ⚠️ 关键处理：JPG 不支持透明通道
    // PNG 图片可能有透明像素（alpha = 0），RGB 值为 (0,0,0,0)
    // 转 JPG 时丢掉 alpha，这些像素变成纯黑色 (0,0,0)
    // 解决方案：先用白色填满画布，再画图片上去
    const format = (options.outputFormat || "jpg").toLowerCase();
    if (format === "jpg" || format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, bitmap.width, bitmap.height);
    }

    ctx.drawImage(bitmap, 0, 0);

    // 上报进度：40%
    postMessage({ id, type: "progress", progress: 40 });

    // 第三步：提取像素数据
    // getImageData 返回宽×高×4 的 Uint8ClampedArray
    // 每个像素占 4 字节：R, G, B, A
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    // 例如一张 1920×1080 的图：1920 × 1080 × 4 = 8,294,400 字节 ≈ 8MB

    // 上报进度：50%
    postMessage({ id, type: "progress", progress: 50 });

    // 第四步：调用 WASM 编码器压缩（下一节详述）
    // ...
  } catch (err) {
    postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
```

### 3.3 为什么 createImageBitmap 这么重要

`createImageBitmap` 是浏览器内置的高性能图片解码器，它做了几件事：
1. **格式识别**：自动检测 magic bytes，支持几乎所有图片格式
2. **解码**：调用浏览器底层的解码器（通常是 C++ 实现），比 JS 解码快得多
3. **返回 ImageBitmap**：这是一种 GPU-ready 的位图表示，可以直接绘制到 Canvas

**不需要我们自己做格式检测或者每种格式装一个解码器**。传入一个 Blob，浏览器帮你搞定解码。

这也是为什么 PixelSwift 能支持 7 种以上输入格式（JPEG、PNG、WebP、BMP、GIF、AVIF、TIFF），但只需用 WASM 做输出编码——解码能力是浏览器原生自带的，不需要引入任何额外的库。

## 四、三种格式的压缩引擎实现（第三步）

这是最核心的部分。不同图片格式的压缩原理完全不同，需要用不同的编码器。

### 4.1 JPEG 压缩：MozJPEG

MozJPEG 是 Mozilla 基于 libjpeg-turbo 魔改的 JPEG 编码器，比标准 JPEG 编码器能小 5-15%，核心改进是更优的量化表和渐进式熵编码。

@jsquash/jpeg 把 MozJPEG 编译成了 WASM，我们直接用它的 `encode` 函数：

```typescript
async function wasmEncodeJPEG(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  // 懒加载：只有第一次压缩 JPEG 时才下载 130KB 的 WASM 文件
  const { default: encode } = await import("@jsquash/jpeg/encode");
  
  // encode 接收两个参数：
  // 1. ImageData：包含 width、height 和 RGBA 像素数组
  // 2. options：quality 范围 1-100
  //    - quality 80：最佳平衡点，体积减少约 70%，肉眼无损
  //    - quality 60：体积减少约 80%，仔细看有轻微模糊
  //    - quality 30：体积减少约 90%，明显模糊
  return encode(imageData, { quality });
}
```

**MozJPEG vs 浏览器原生 Canvas 编码的对比：**

同一张图片，quality=80 时：
- Canvas `toBlob('image/jpeg', 0.8)`：148KB
- MozJPEG encode：126KB（小约 15%）

Canvas 内置的 JPEG 编码器基于标准 libjpeg，而 MozJPEG 在此基础上做了大量优化（Trellis 量化、自适应量化表、渐进式编码），在同等视觉质量下能生成更小的文件。这就是为什么要额外引入 WASM 编码器，而不是直接用 Canvas API。

### 4.2 PNG 压缩：有损量化（TinyPNG 的原理）

很多人以为 PNG 是无损格式不能再压缩了，但实际上 **TinyPNG 做的不是"无损压缩"，而是"有损量化"**。

原理：PNG-24（真彩色）每个像素用 24 位存 RGB，能表示 1600 万种颜色。但大多数图片实际用到的颜色远没那么多。有损量化把颜色降到 256 种以内，转成 PNG-8（索引色），体积直接缩 60-80%。

```typescript
async function wasmEncodePNG(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  const UPNG = (await import("upng-js")).default;

  // quality 1-100 映射到目标颜色数 16-256
  // 为什么是 16-256？
  // - PNG-8 最多支持 256 色（2^8）
  // - 低于 16 色时色阶太明显，不实用
  const cnum = Math.round(16 + (quality / 100) * (256 - 16));

  // UPNG.encode 参数：
  // 1. [imageData.data.buffer]：像素数据数组（支持传多帧，动图用）
  // 2. width
  // 3. height
  // 4. cnum：目标颜色数。0 = 无损，> 0 = 有损量化到 cnum 种颜色
  return UPNG.encode(
    [imageData.data.buffer],
    imageData.width,
    imageData.height,
    cnum,
  );
}
```

**量化效果示例：**

以一张 1920×1080 的 UI 截图为例（原始 PNG-24 = 2.1MB）：
- cnum=256（quality=100）：520KB，视觉几乎无损
- cnum=128（quality=50）：380KB，正常浏览无区别
- cnum=32（quality=10）：180KB，纯色区域开始出现色带

**为什么不用 @jsquash/oxipng？**

OxiPNG 做的是**无损优化**（调整 PNG 过滤器和 DEFLATE 压缩参数），体积缩减通常只有 10-20%。而 TinyPNG 那种 60-80% 的压缩率，靠的就是有损量化。因此在"压缩"场景下，upng-js 的有损量化方案压缩效果远优于 OxiPNG 的无损优化。

### 4.3 WebP 压缩：libwebp

WebP 是 Google 推出的图片格式，同等质量下比 JPEG 小 25-35%，还支持透明通道。

```typescript
async function wasmEncodeWebP(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  const { default: encode } = await import("@jsquash/webp/encode");
  return encode(imageData, { quality });
}
```

@jsquash/webp 内部打包了两份 WASM：
- `webp_enc.wasm`：通用版
- `webp_enc_simd.wasm`：SIMD 优化版（利用 CPU 向量指令并行处理像素）

库会自动检测浏览器是否支持 SIMD 并加载对应版本。SIMD 版本编码速度快 2-3 倍，现在主流浏览器基本都支持了。

### 4.4 编码调度：在 Worker 中选择编码器

把三个编码器串起来：

```typescript
// 接第三节的 Worker onmessage
const outputFormat = options.outputFormat || "jpg";
const qualityPercent = options.quality ?? 85;
let resultBuffer: ArrayBuffer;

// 根据输出格式选择对应的 WASM 编码器
if (outputFormat === "jpg") {
  resultBuffer = await wasmEncodeJPEG(imageData, qualityPercent);
} else if (outputFormat === "png") {
  resultBuffer = await wasmEncodePNG(imageData, qualityPercent);
} else if (outputFormat === "webp") {
  resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
} else {
  // 不支持的格式降级到 Canvas 编码
  const blob = await canvas.convertToBlob({
    type: getMimeType(outputFormat),
  });
  resultBuffer = await blob.arrayBuffer();
}

// 上报进度：90%
postMessage({ id, type: "progress", progress: 90 });

// 返回结果，用 Transferable 零拷贝
postMessage(
  {
    id,
    type: "complete",
    result: {
      buffer: resultBuffer,
      width: canvas.width,
      height: canvas.height,
      format: outputFormat,
    },
  },
  [resultBuffer],  // 所有权转移，Worker 不再持有这块内存
);
```

## 五、主线程 Composable 封装（第四步）

Worker 的调用逻辑封装在 Vue composable 里，暴露响应式的 `isProcessing`、`progress`、`error` 状态。

```typescript
// composables/useImageProcessor.ts

// 单例 Worker——避免重复创建和 WASM 重复编译
let _worker: Worker | null = null;
let _messageId = 0;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("../workers/imageProcessor.worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return _worker;
}

export function useImageProcessor() {
  const isProcessing = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  async function processImage(
    file: File,
    options: ProcessOptions,
  ): Promise<ProcessResult> {
    isProcessing.value = true;
    progress.value = 0;
    error.value = null;
    const startTime = performance.now();

    try {
      const worker = getWorker();
      const id = String(++_messageId);
      const buffer = await file.arrayBuffer();

      const result = await new Promise<{
        buffer: ArrayBuffer;
        width: number;
        height: number;
        format: string;
      }>((resolve, reject) => {
        function handler(e: MessageEvent) {
          if (e.data.id !== id) return;

          if (e.data.type === "progress") {
            progress.value = e.data.progress ?? 0;
          } else if (e.data.type === "complete") {
            worker.removeEventListener("message", handler);
            resolve(e.data.result);
          } else if (e.data.type === "error") {
            worker.removeEventListener("message", handler);
            reject(new Error(e.data.error));
          }
        }
        worker.addEventListener("message", handler);
        worker.postMessage(
          { id, action: options.action, buffer, options },
          [buffer],  // Transferable
        );
      });

      progress.value = 100;
      const blob = new Blob([result.buffer], {
        type: getMimeType(result.format),
      });

      return {
        blob,
        originalSize: file.size,
        processedSize: blob.size,
        width: result.width,
        height: result.height,
        format: result.format,
        duration: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Processing failed";
      throw err;
    } finally {
      isProcessing.value = false;
    }
  }

  // 批量处理：串行执行，避免 WASM 内存溢出
  async function processBatch(
    files: File[],
    options: ProcessOptions,
    onProgress?: (index: number, result: ProcessResult) => void,
  ): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await processImage(files[i]!, options);
      results.push(result);
      onProgress?.(i, result);
    }
    return results;
  }

  return {
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    error: readonly(error),
    processImage,
    processBatch,
  };
}
```

### 5.1 为什么批量处理要串行

WASM 使用线性内存（一块连续的 ArrayBuffer），每次处理图片都在上面分配空间。如果并行处理 20 张大图，内存分配叠加，很快就超出 WASM 内存上限，标签页直接崩溃。

串行处理 + Transferable 传输，每张图处理完后 ArrayBuffer 所有权转给主线程，Worker 内自动释放，内存保持平稳。

实测 10 张混合图片（总 25MB），串行处理约 3 秒，完全可接受。

## 六、性能对比

测试环境：Ryzen 5 笔记本，16GB 内存

| 操作 | 文件大小 | PixelSwift | TinyPNG | 说明 |
|-----|---------|-----------|---------|------|
| JPEG 压缩 q80 | 3 MB | ~150ms | ~5s | TinyPNG 含上传下载 |
| PNG 量化 | 5 MB | ~600ms | ~8s | 压缩率差距 2-3% |
| WebP 压缩 q80 | 4 MB | ~300ms | 不支持 | |
| 10 张批量 | 25 MB | ~3s | 15-30s | 网络差更明显 |
| WASM 首次加载 | - | ~300ms | - | 后续有缓存，无开销 |

## 七、踩坑备忘

1. **Vite Worker 插件遗漏**：`worker.plugins` 里也要加 `wasm()` + `topLevelAwait()`，否则 build 后 Worker 内加载 WASM 报 MIME type 错误
2. **PNG 转 JPG 黑底**：Canvas 绘制前用 `fillRect` 填白底
3. **Transferable 后 buffer 清零**：transfer 后原始 buffer 变空，重新压缩要重新 `file.arrayBuffer()`
4. **WASM 懒加载**：用 `await import()` 按需加载，三个编码器共 500KB+ gzip 不能放首屏
5. **批量内存溢出**：串行处理 + Transferable 释放，不要并行

## 八、总结

纯浏览器端图片压缩的关键点：
- **解码免费**：`createImageBitmap` 支持 7+ 种输入格式，浏览器内置
- **编码用 WASM**：MozJPEG（JPEG）、upng-js（PNG 量化）、libwebp（WebP），效果接近 TinyPNG
- **Worker 隔离**：CPU 密集操作不阻塞 UI
- **Transferable 传输**：大 buffer 零拷贝，省内存

下一篇讲图片格式转换的实现，会涉及 Canvas API 和 WASM 双路径策略、Safari WebP 兼容性等问题。

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 图片压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

欢迎体验和评论区交流，下一篇见！
