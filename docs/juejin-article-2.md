# 掘金发帖文章（格式转换篇）

> **发布说明**：复制分隔线以后的内容到掘金编辑器。标签选：`前端` `WebAssembly` `Canvas`
> **发布时间**：建议 周三（3.25）早上 8:30

---

# Canvas API vs WebAssembly：浏览器端图片处理该怎么选？实测性能差 5 倍

之前用 WASM（MozJPEG / libwebp）做了一个[浏览器端图片压缩工具](https://juejin.cn/)，效果很好，压缩率接近 TinyPNG。

后来给这个工具加格式转换功能的时候，我本能地也想用 WASM 做。但实际跑了一下发现：**Canvas API 的 `convertToBlob()` 比 WASM 快了 5 倍**，而且代码量小得多。

这让我重新思考了一个问题：**浏览器端做图片处理，什么时候该用 Canvas API，什么时候该上 WASM？**

结论是：**压缩用 WASM，转换用 Canvas API**。场景不同，诉求不同——压缩要极致体积，转换要速度。不过有个例外：Safari 不支持 Canvas 编码 WebP，这种情况还是得 WASM 兜底。

这篇记录一下 [PixelSwift](https://pixelswift.site/) 格式转换功能的实现，核心就是一个 Canvas 优先 + WASM 兜底的双路径方案。

## 为什么不直接全用 WASM

先看架构图，一目了然：

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

关键区别在右边那条路：**格式转换跳过了 `getImageData()`，直接用 `convertToBlob()`。**

`convertToBlob()` 让浏览器用内置编码器（C++ 实现）直接从 GPU 纹理生成目标格式。不需要像素拷贝到 JS 堆，不需要 WASM 再编码。

实际性能差多少？

| 路径 | 3MB JPEG → WebP | 说明 |
|------|-----------------|------|
| WASM（getImageData + encode） | ~400ms | 两次拷贝 + WASM 编码 |
| Canvas（convertToBlob） | ~80ms | 内置编码，快 5 倍 |

格式转换追求的就是快，5 倍差距没必要纠结了。

## Worker 里怎么分路

压缩和转换共用同一个 Worker，用 `action` 字段区分：

```typescript
if (action === "compress") {
  // 压缩：走 WASM
  const imageData = ctx.getImageData(0, 0, outWidth, outHeight);
  if (outputFormat === "jpg") {
    resultBuffer = await wasmEncodeJPEG(imageData, qualityPercent);
  } else if (outputFormat === "png") {
    resultBuffer = await wasmEncodePNG(imageData, qualityPercent);
  } else if (outputFormat === "webp") {
    resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
  }
} else {
  // 转换：走 Canvas，Safari WebP 除外
  if (outputFormat === "webp" && !(await canCanvasEncodeWebP())) {
    // Safari 兜底
    const imageData = ctx.getImageData(0, 0, outWidth, outHeight);
    resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
  } else {
    // 快速路径
    const resultBlob = await canvas.convertToBlob({
      type: getMimeType(outputFormat),
      quality: qualityPercent / 100,
    });
    resultBuffer = await resultBlob.arrayBuffer();
  }
}
```

逻辑很清晰：compress 无条件走 WASM，convert 默认走 Canvas，只有 Safari + WebP 走 WASM 兜底。

## Safari WebP 的坑：静默降级

这个坑卡了我半天。

Safari 16.3 及以下不支持 Canvas 编码 WebP。但 `convertToBlob({ type: "image/webp" })` **不会报错**，它会静默输出一个 PNG，只是 MIME type 标成了 `image/png`。

也就是说，你不能用 try-catch 来判断是否支持。必须这样检测：

```typescript
let _canvasWebPSupport: boolean | null = null;

async function canCanvasEncodeWebP(): Promise<boolean> {
  if (_canvasWebPSupport !== null) return _canvasWebPSupport;
  try {
    const c = new OffscreenCanvas(1, 1);
    const blob = await c.convertToBlob({ type: "image/webp" });
    // 关键：检查实际输出的 MIME type
    _canvasWebPSupport = blob.type === "image/webp";
  } catch {
    _canvasWebPSupport = false;
  }
  return _canvasWebPSupport;
}
```

用 1×1 的 Canvas 做检测，开销可忽略，结果缓存起来只检测一次。

教训：**我最初直接 try-catch，结果有用户反馈"PNG 转 WebP 后文件变大了"——因为输出其实还是 PNG，只是扩展名变了。**

## PNG 转 JPG 的黑底问题

另一个经典坑：透明 PNG 转 JPG，透明区域变成纯黑色。

原因：Canvas 默认背景透明（RGBA 全 0），PNG 的透明像素画上去是 `(0,0,0,0)`，转 JPG 丢掉 alpha 变成 `(0,0,0)` = 黑色。

解决方法很简单——画图之前先填白底：

```typescript
if (formatLower === "jpg" || formatLower === "jpeg") {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outWidth, outHeight);
}
ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);
```

## 批量处理 + JSZip 按需加载

批量转换采用串行处理，每张图处理完才处理下一张。虽然格式转换走 Canvas API 内存压力不大，但为了跟压缩功能统一架构：

```typescript
for (let i = 0; i < fileItems.value.length; i++) {
  const item = fileItems.value[i];
  if (!item || item.status === "done") continue; // 跳过已完成的

  const result = await processImage(file, {
    action: "convert",
    outputFormat: selectedFormat.value,
    quality: selectedFormat.value === "png" ? 100 : 92,
  });

  processedBlobs.value.set(item.id, result.blob);
}
```

批量下载用 JSZip 打包成 ZIP，动态导入不影响首屏：

```typescript
async function downloadAsZip(files, zipName) {
  const { default: JSZip } = await import("jszip"); // 约 40KB gzip
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  downloadFile(content, zipName);
}
```

## 7 种输入格式，0 行解码代码

PixelSwift 支持 JPEG、PNG、WebP、BMP、GIF、AVIF、TIFF 等 7 种以上输入格式，但我没有写任何解码代码。

`createImageBitmap()` 是浏览器内置的解码器，自动识别 magic bytes，调用底层 C++ 解码器。我只负责编码输出，解码完全交给浏览器：

```typescript
const blob = new Blob([buffer]);
const bitmap = await createImageBitmap(blob); // 一行搞定所有格式
```

所以文件上传的 accept 直接设成 `image/*`：

```vue
<FileUploader accept="image/*" @files="onFilesAdded" />
```

**输入格式 = 浏览器能力，输出格式 = 我们的编码器。**

## 性能数据

测试环境：Ryzen 5，Chrome 130，16GB 内存

| 操作 | 文件大小 | 耗时 |
|------|---------|------|
| PNG → JPG | 5MB | ~80ms |
| JPG → WebP (Chrome) | 3MB | ~90ms |
| JPG → WebP (Safari 旧版) | 3MB | ~400ms |
| BMP → PNG | 8MB | ~120ms |
| 10 张批量 PNG → WebP | 总 30MB | ~1.2s |

对比 CloudConvert 之类的在线工具：同样 3MB PNG → WebP，我们 ~90ms，它们 3-8 秒（含上传下载）。而且图片全程不离开浏览器，没有隐私顾虑。

## 踩坑清单

1. `convertToBlob` 不支持某格式时**不报错**，静默输出 PNG，必须检查 `blob.type`
2. PNG 转 JPG 先 `fillRect` 填白底，否则透明变黑
3. Canvas 的 quality 是 0-1，WASM 是 1-100，别忘了 `/ 100`
4. Safari 16.4+ 才完整支持 OffscreenCanvas
5. JSZip 用 `await import()` 按需加载，别放首屏 bundle
6. Transferable 传输后原 buffer 归零，重新处理要重新 `file.arrayBuffer()`

## 小结

一句话总结：**格式转换用 Canvas API 就够了，WASM 只是 Safari WebP 的兜底方案。**

| 维度 | 压缩 | 转换 |
|------|-----|------|
| 核心诉求 | 体积最小 | 速度最快 |
| 编码路径 | WASM | Canvas API + WASM 兜底 |
| 性能 | 300-500ms/张 | 60-120ms/张 |

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 图片压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

有问题欢迎评论区交流。
