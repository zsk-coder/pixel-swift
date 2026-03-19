# 掘金发帖文章

> **发布说明**：复制下面分隔线以后的内容到掘金编辑器。标签选：`前端` `WebAssembly` `Vue.js`

---

## 以下为文章正文

# 用 WASM 实现纯浏览器端的图片压缩，完全不需要后端

市面上的在线图片压缩工具（TinyPNG、iLoveIMG 等）都是把图片上传到服务器处理的。但现在 MozJPEG、OxiPNG 这些专业压缩算法都有了 WebAssembly 版本，完全可以在浏览器本地跑。

我基于这个思路做了一个工具 [PixelSwift](https://pixelswift.site/)，支持图片压缩、格式转换和尺寸调整，全程不发任何网络请求。这篇文章主要记录一下实现过程中的技术方案和遇到的问题。

## 整体架构

先看下处理流程：

```
用户拖入图片
    ↓
主线程：校验文件 → 生成缩略图 → 把 ArrayBuffer 传给 Worker
    ↓
Worker 线程：检测格式(magic bytes) → 解码 → 压缩/转换/缩放 → 编码 → 返回 Blob
    ↓
主线程：更新 UI → 渲染前后对比 → 生成下载链接
```

技术栈：

- **Nuxt 4 + Vue 3**，SSR 负责 SEO 页面，CSR 负责交互
- **@jsquash/jpeg**：MozJPEG 的 WASM 版，JPEG 编解码
- **@jsquash/oxipng**：OxiPNG 的 WASM 版，PNG 无损优化
- **@jsquash/webp**：libwebp 的 WASM 版，WebP 编解码
- **Web Worker + OffscreenCanvas**：图片处理全在 Worker 线程
- 部署在 **Cloudflare Pages**

这几个 WASM 编解码器来自 [jSquash](https://github.com/nichenqin/jSquash)，底子是 Google Squoosh 的编解码核心。压缩效果跟 TinyPNG 对比过大概 100 张图，压缩率差距在 2-3% 以内。

## 为什么要用 Web Worker

图片编码是 CPU 密集操作。MozJPEG 编码一张 5MB 的 PNG，主线程会直接卡死 2-3 秒——页面冻住，滑块拖不动，按钮没反应。

把处理逻辑丢到 Worker 线程之后，主线程始终保持响应，用户可以同时调参数或者继续添加图片。

```typescript
const worker = new Worker('/workers/imageProcessor.worker.js');

worker.postMessage({
  id: crypto.randomUUID(),
  action: 'compress',
  buffer: await file.arrayBuffer(),
  options: { quality: 80, format: 'jpeg' }
}, [buffer]); // Transferable，零拷贝

worker.onmessage = (e) => {
  const { id, type, result } = e.data;
  if (type === 'complete') {
    const blob = new Blob([result.buffer], { type: 'image/jpeg' });
    updateUI(id, blob, result.metadata);
  }
};
```

注意 `postMessage` 的第二个参数 `[buffer]`：这是 Transferable 传输，直接把 ArrayBuffer 的所有权移交给 Worker，不做拷贝。处理大图时这一行能省掉一倍的内存占用。

## Worker 内部的图片解码

Worker 里没有 DOM，不能用普通的 Canvas 元素。这里用 OffscreenCanvas 来做解码：

```typescript
const img = await createImageBitmap(blob);
const canvas = new OffscreenCanvas(img.width, img.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imageData = ctx.getImageData(0, 0, img.width, img.height);
// 拿到 imageData 之后就可以喂给 WASM 编码器了
```

兼容性：Chrome、Edge、Firefox 都支持，Safari 16.4+ 支持。低版本 Safari 需要降级到主线程 Canvas。

## 踩过的坑

### 1. Nuxt/Vite 里加载 WASM

这是花时间最多的地方。Vite 的依赖预构建会试图 bundle 所有依赖，但 @jsquash 系列的 WASM 文件加载机制跟 Vite 不兼容，构建时会报各种错。

解决方法是在 `nuxt.config.ts` 里把这几个包排除出预构建：

```typescript
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      exclude: ['@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/webp']
    }
  }
});
```

另外 WASM 文件一定要做懒加载。三个编解码器加起来 500KB+（gzipped），全放在首屏加载会严重影响 LCP。我的做法是用户第一次上传图片时才 `import()`。

### 2. 批量处理时内存溢出

上线后有用户拿 20 张大 PNG 测试，标签页直接崩了。

原因：WASM 使用线性内存，每次处理图片都在 WASM heap 上分配空间。连续处理多张大图不手动释放的话，很快就超限了。

解决方法比较直接——在 Worker 里串行处理，每处理完一张就释放 WASM 内存，而不是并行跑。内存占用保持平稳，代价是稍微慢一点，但实际体感差别不大。

### 3. SIMD 检测和性能差异

@jsquash/webp 提供了两份 WASM binary：普通版和 SIMD 优化版。运行时需要检测浏览器是否支持 SIMD，然后加载对应的文件：

```typescript
import { simd } from 'wasm-feature-detect';

const hasSIMD = await simd();
const wasmPath = hasSIMD
  ? '/wasm/webp_enc_simd.wasm'
  : '/wasm/webp_enc.wasm';
await initWebPEncoder(wasmPath);
```

实测 SIMD 版本的 WebP 编码快了 2-3 倍。现在大部分设备都支持 SIMD，但 fallback 还是要保留。

## 性能数据

测试环境：Ryzen 5 笔记本，16GB 内存

| 操作 | 文件大小 | 耗时 |
|-----|---------|------|
| JPEG 压缩 (quality 80) | 3 MB | ~150ms |
| PNG 优化 (OxiPNG) | 5 MB | ~600ms |
| PNG → WebP 转换 | 4 MB | ~300ms |
| 10 张混合格式批量处理 | 25 MB | ~3 秒 |

作为对比，同样的 10 张图用 TinyPNG 需要 15-30 秒（包含上传下载时间），网络差的话更久。

UI 层用 TailwindCSS 的响应式断点做了多端适配，手机和平板上也能正常跑，WASM 处理逻辑跟桌面端完全一致。

## 多语言 SEO 的意外收获

PixelSwift 做了 8 种语言支持（中英日韩德法西葡）。原本只是想覆盖更多用户，后来发现在 SEO 层面有很大的优势。

英文搜 "image compressor"，要跟 TinyPNG 这种十年老站竞争，基本没机会。但日语搜 "画像圧縮 アップロード不要"、韩语搜 "이미지 압축 업로드 불필요"——几乎没竞品。

Nuxt 的 @nuxtjs/i18n 模块可以自动处理 hreflang 标签、本地化 URL 和语言检测，配置成本很低。

## 回顾

有两个教训：

一是内容比技术优化重要。Sitemap、Schema.org 这些我第一天就配好了，但 Google 不在乎你 sitemap 多完美——站上只有 3 个页面，它不会认为你是个有价值的站点。应该先写博客内容（"邮件图片怎么压缩"这种场景文章），搜索量比工具页本身大得多。

二是不要过早优化。我花了两天做 WASM 的 bundle splitting，把每个编解码器拆成独立 chunk。后来发现用户上传文件时一个 `import()` 全部加载就行了，根本不需要那么细粒度的拆分。

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

如果你也在做 WASM 相关的东西，欢迎交流。
