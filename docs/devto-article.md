# Dev.to 发帖文章

> **使用说明**：以下 ` ``` markdown ` 代码块内的内容可直接复制到 Dev.to 编辑器。标题和 tags 已在 UI 手动填写的话，只需复制正文部分（从 "Every online image compressor" 开始）。

---

## AI 味道修改说明

| 原文问题 | 修改方式 |
|---------|---------|
| 反复使用 "Here's" 开头（AI 高频句式） | 换成更口语化的过渡 |
| 每段都用 **加粗** 强调（AI 典型节奏） | 减少加粗，只在真正关键处使用 |
| 列表太整齐、太对称（4 个 bullet 都是同样长度） | 打破节奏，有长有短 |
| "The key insight was..." 这类总结句 | 换成更随意的叙述 |
| "dramatically speed up"、"critical for" 等副词堆砌 | 去掉或换成具体数据 |
| "What I'd Do Differently" 三条都是同样结构 | 打乱格式，加入个人语气 |
| 缺少真实的"踩坑故事"和情绪 | 加入挫折感和口语化吐槽 |
| 结尾太标准的 CTA（AI 模板） | 换成更随意的收尾 |

---

## 以下为文章正文（复制到 Dev.to）

```markdown
---
title: I Built a Browser-Only Image Compressor with WebAssembly — Here's What I Learned
published: true
tags: webdev, javascript, webassembly, privacy
cover_image: https://pixelswift.site/images/og-image.png
---

Every online image compressor I've used works the same way: upload to a server, wait, download. TinyPNG, iLoveIMG, Compressor.io — same deal.

This always annoyed me. I'm sending my photos to some random server... just to make them smaller? My laptop has a perfectly good CPU sitting right there. And with WebAssembly, the actual compression algorithms (MozJPEG, OxiPNG) can run in a browser now.

So I spent the last couple of months building [PixelSwift](https://pixelswift.site/) — it compresses, converts, and resizes images entirely in your browser. Nothing gets uploaded anywhere. I wanted to write up the technical bits because I ran into some non-obvious problems along the way.

## Why not just use a server?

The obvious answer is privacy — your images stay on your device. But honestly, what pushed me to go fully client-side was annoyance with the upload model:

- Slow connections make everything painful. I've sat there watching a progress bar for a 10MB PNG when the actual compression takes 600ms.
- TinyPNG caps you at 5MB per file and 20 images per batch on the free tier. I hit that limit constantly.
- It doesn't work offline at all. I've been on planes wishing I could just shrink a screenshot.

The privacy angle is a nice bonus for users who care about GDPR or handle sensitive documents, but for me it started as a "why is this so slow and annoying" problem.

## The WASM stack

Turns out, all the heavy-lifting libraries I needed already have WASM ports thanks to the [jSquash](https://github.com/nichenqin/jSquash) project (which builds on Google's Squoosh codecs):

- **@jsquash/jpeg** — MozJPEG encoder/decoder
- **@jsquash/oxipng** — OxiPNG for PNG optimization
- **@jsquash/webp** — libwebp for WebP

I was skeptical about quality at first, but after testing across ~100 images, compression ratios land within 2-3% of TinyPNG's output. Close enough that I can't tell the difference visually.

## How the processing pipeline works

```
User drops files
       ↓
  Main Thread: validate, generate thumbnails, send ArrayBuffer to Worker
       ↓
  Web Worker: detect format → decode (Canvas/WASM) → process → encode → return Blob
       ↓
  Main Thread: update UI, show before/after preview, generate download link
```

The Web Worker part is important. MozJPEG encoding is CPU-heavy — if you run it on the main thread, the entire page freezes. No scrolling, no clicking, nothing responds. I learned this the hard way during early prototyping when my UI would just lock up for 2-3 seconds per image.

```typescript
// Simplified worker communication
const worker = new Worker('/workers/imageProcessor.worker.js');

worker.postMessage({
  id: crypto.randomUUID(),
  action: 'compress',
  buffer: await file.arrayBuffer(),
  options: { quality: 80, format: 'jpeg' }
}, [buffer]); // Transferable — moves the buffer instead of copying it

worker.onmessage = (e) => {
  const { id, type, result } = e.data;
  if (type === 'complete') {
    const blob = new Blob([result.buffer], { type: 'image/jpeg' });
    updateUI(id, blob, result.metadata);
  }
};
```

That `Transferable` in `postMessage` is easy to miss. Without it, you're copying the entire ArrayBuffer to the Worker, which doubles memory usage for large files.

Inside the Worker, I use OffscreenCanvas for image decoding:

```typescript
const img = await createImageBitmap(blob);
const canvas = new OffscreenCanvas(img.width, img.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imageData = ctx.getImageData(0, 0, img.width, img.height);
```

Works in Chrome, Edge, Firefox, and Safari 16.4+. Older Safari falls back to main-thread Canvas, which is slower but still works.

## Gotchas I hit (and you probably will too)

### WASM loading in Nuxt/Vite

PixelSwift is built with Nuxt (deployed on Cloudflare Pages). Getting WASM modules to load correctly took more debugging than I'd like to admit.

Vite's dependency optimization tries to bundle everything, but these WASM codec libraries don't play well with that. I had to exclude them:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      exclude: ['@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/webp']
    }
  }
});
```

Also, you absolutely need to lazy-load the WASM modules. The combined size is 500KB+ gzipped — loading all of that upfront would tank your page load time.

### Memory blowups in batch processing

This one bit me hard. A user tested with 20 large PNGs and the tab crashed.

The issue: WASM uses linear memory, and each image processing allocates inside the WASM heap. Process 20 images without cleanup and you'll blow past the memory limit.

Fix: process images one-by-one in the Worker (not in parallel) and free WASM memory after each one. Boring, but it works. Memory stays flat even for big batches now.

### SIMD makes a real difference

The @jsquash/webp package ships two WASM binaries — one with SIMD instructions, one without. I use wasm-feature-detect to pick the right one at runtime:

```typescript
import { simd } from 'wasm-feature-detect';

const hasSIMD = await simd();
const wasmPath = hasSIMD
  ? '/wasm/webp_enc_simd.wasm'
  : '/wasm/webp_enc.wasm';
await initWebPEncoder(wasmPath);
```

With SIMD, WebP encoding is about 2-3x faster. Most modern devices support it, but the fallback is there for older hardware.

## Some performance numbers

Tested on a mid-range laptop (Ryzen 5, 16GB RAM):

| What | File size | Time |
|------|-----------|------|
| JPEG compress (quality 80) | 3 MB | ~150ms |
| PNG optimize via OxiPNG | 5 MB | ~600ms |
| PNG → WebP conversion | 4 MB | ~300ms |
| 10 images, mixed formats | 25 MB total | ~3s |

For comparison, the same 10-image batch through TinyPNG takes 15-30 seconds depending on your upload speed. On hotel wifi? Don't even bother.

## One thing I didn't expect: multi-language SEO is a cheat code

PixelSwift supports 8 languages. I originally added them thinking "more languages = more users." But the real win was SEO.

Search "image compressor" in English and you're competing against TinyPNG (10+ years old, millions of monthly visitors). Search "画像圧縮 アップロード不要" (image compression, no upload needed) in Japanese? Almost no competition. Same for Korean, German, Portuguese.

Nuxt's @nuxtjs/i18n module handles hreflang tags, localized URLs, and language detection automatically. Setting it up was maybe 2 hours of work. The SEO payoff is disproportionately large.

## What I got wrong

Honestly, I spent too long perfecting the technical side. Sitemaps, Schema.org markup, structured data — all done on day one. But Google doesn't care about your perfect sitemap if you only have 3 pages with actual text content.

I should have started writing blog posts (targeting stuff like "how to compress images for email" or "webp vs jpg") way earlier. A single blog post can bring in more organic traffic than a perfectly optimized tool page.

Also, I wasted about two days trying to split the WASM bundles into tiny chunks for optimal loading. In practice, a simple dynamic `import()` that loads the module when the user first uploads a file works great. Premature optimization is real.

## Try it yourself

The tool is at [pixelswift.site](https://pixelswift.site/). Free, no account needed.

If you want proof that nothing gets uploaded — open your browser's DevTools Network tab while using it. Zero requests to any server during processing.

I'm still actively working on it, so if you run into issues or have ideas, let me know in the comments.

---

*Curious if anyone else has shipped WASM-based tools to real users. What was the weirdest gotcha you ran into?*
```
