# PixelSwift Reddit 发帖完全教程

## 第一步：注册账号（如果还没有）

1. 打开 https://www.reddit.com/register
2. 用邮箱注册（建议用 Gmail），取一个看起来像正常用户的名字（**不要**叫 `pixelswift_official`）
3. 注册后**不要马上发帖**——如果是全新号，建议先花 1-2 天在目标子版块里浏览、给别人的帖子点赞和留评论（哪怕只是 "This is great, thanks for sharing!"），让账号有一点活跃度

> [!WARNING]
> Reddit 对新号发推广内容非常敏感。如果你是今天注册、今天发帖，被删帖或被标记为 spam 的概率很高。**如果你已有 Reddit 账号（哪怕很少用），优先用老号。**

---

## 第二步：选择子版块（Subreddit）

推荐目标 subreddit（按优先级排序）：

| Subreddit | 成员量 | 适合程度 | 发帖角度 |
|-----------|--------|---------|---------|
| **r/webdev** | ~2.5M | ⭐⭐⭐ | 开发者视角：我用 WASM 做了个纯浏览器图片工具 |
| **r/SideProject** | ~200K | ⭐⭐⭐ | 个人项目展示，这个版块就是干这个的 |
| **r/InternetIsBeautiful** | ~17M | ⭐⭐⭐ | 展示有趣实用的网站，流量极大但审核严格 |
| **r/privacy** | ~1.8M | ⭐⭐ | 隐私角度：不用上传图片的压缩工具 |
| **r/selfhosted** | ~400K | ⭐⭐ | 本地处理 = 无服务器依赖 |
| **r/webdesign** | ~800K | ⭐ | 设计师视角：日常压缩图片的更好选择 |

> [!TIP]
> **不要一天同时发多个 subreddit！** 这会被 Reddit 反垃圾系统标记。建议今天发 1 个，间隔 1-2 天再发另一个。推荐顺序：先 r/SideProject（最友好） → 再 r/webdev → 再 r/privacy。

---

## 第三步：发帖方式（关键！）

### ❌ 错误方式：发 Link Post

直接发一个链接 → 被当广告 → 删帖/踩爆

### ✅ 正确方式：发 Text Post（自我介绍 + 故事）

Reddit 社区喜欢**真人讲故事**，不喜欢"来看我的产品"。你的帖子应该是在分享你做这个东西的过程和动机，**顺便**提到工具链接。

---

## 第四步：帖子内容（直接可用）

### r/SideProject 版本

**标题**：
```
I built a free browser-based image compressor — no uploads, no servers, your files never leave your device
```

**正文**：
```
Hey everyone 👋

I've been working on a side project called PixelSwift and wanted to share it with you.

**The problem I was solving:**

Every time I needed to compress images for a website or email, I'd use TinyPNG or similar tools. But it always bugged me that I had to upload my files to someone else's server. For personal screenshots? Meh, fine. But for client work, medical docs, or anything remotely sensitive — that felt wrong. Some enterprise clients even have NDAs that prohibit uploading assets to third-party services.

**What I built:**

PixelSwift is an image processing tool that runs **100% in your browser**. No server, no uploads, no data collection. It uses WebAssembly (MozJPEG for JPEG, OxiPNG for PNG) to deliver compression quality comparable to TinyPNG — but everything happens locally on your device.

**Key features:**

- 🔒 Files never leave your device — all processing happens in-browser via WASM + Web Workers
- 🖼️ Compress (JPG/PNG/WebP), convert between formats, and resize images
- ⚡ Faster than upload-based tools since there's no network round-trip
- 📦 Batch processing — handle multiple images at once, download as ZIP
- 🌍 Available in 8 languages
- 💰 Completely free — no accounts, no watermarks, no limits
- 🔌 Works offline once loaded

**Tech stack**: Nuxt 3 + TypeScript + WebAssembly + Web Workers, deployed on Cloudflare Pages.

Here's the link if you want to try it: https://pixelswift.site

I'd love to hear your feedback — especially on compression quality and UX. What features would make this more useful for your workflow?
```

---

### r/webdev 版本

**标题**：
```
Show r/webdev: I used WebAssembly + Web Workers to build a client-side image compressor — here's what I learned
```

**正文**：
```
I recently shipped a side project called PixelSwift, and I thought the dev community here might find the technical approach interesting.

**TL;DR**: It's a free image compressor/converter/resizer that runs entirely in the browser — no uploads, no server processing. Your files literally never leave localhost.

**The tech that makes it work:**

- **WebAssembly**: MozJPEG and OxiPNG compiled to WASM for encoding. This gives near-native compression quality without any server dependency.
- **Web Workers**: All heavy processing runs off the main thread, so the UI stays completely responsive even when crunching a batch of 20 high-res images.
- **Canvas API + OffscreenCanvas**: Used for image decoding and pixel manipulation within workers.
- **Nuxt 3 + TypeScript**: For the app framework, with Cloudflare Pages for edge delivery.

**Interesting challenges I ran into:**

1. Safari doesn't support WebP encoding natively, so I had to use a WASM-based WebP encoder (@jsquash/webp) as a fallback.
2. Getting WASM modules to load correctly inside Web Workers required `vite-plugin-wasm` + `vite-plugin-top-level-await` — this was NOT straightforward to debug.
3. PNG transparency handling when converting to JPEG (the classic "black background" problem) — solved by compositing onto a white canvas before encoding.

**Why I built it**: I got tired of uploading images to TinyPNG/iLoveIMG for every project. With WASM being mature enough, it felt like the right time to bring the processing engine to the browser instead.

Try it here: https://pixelswift.site

Would love technical feedback, especially from anyone who's worked with WASM in production. What was your experience?
```

---

### r/privacy 版本

**标题**：
```
Free image compressor that processes everything locally in your browser — no uploads to any server, ever
```

**正文**：
```
Hi r/privacy,

I built a tool called PixelSwift that I think this community would appreciate.

**The privacy problem with image tools**: Most online image compressors (TinyPNG, iLoveIMG, etc.) require you to upload your images to their servers for processing. Even if they promise to delete files after a few hours, your data still travels through their infrastructure. For anyone handling sensitive images — personal photos, medical documents, legal files, or anything under GDPR/HIPAA — this is an unnecessary risk.

**The solution**: PixelSwift processes images entirely within your browser using WebAssembly. Your files never leave your device. There's no server-side processing, no data collection, no accounts — nothing.

What it does:
- Compress JPG/PNG/WebP images (up to 80%+ file size reduction)
- Convert between image formats
- Resize images to exact dimensions

It works offline once loaded, and there are no limits on file size or usage. Completely free, no registration required.

Link: https://pixelswift.site

I built this because I believe privacy shouldn't be a premium feature — especially for something as basic as compressing an image.
```

---

## 第五步：发帖后的操作

### 1. 保持在线回复评论（前 2-4 小时最关键）

Reddit 的算法看重**帖子的互动率**。发帖后的头几个小时里：
- 每条评论都要认真回复
- 语气真诚、谦虚、感激
- 如果有人提 bug 或建议，说 "Great catch, I'll look into this!"
- **不要**对批评进行辩护或反驳

### 2. 不要做的事

| ❌ 不要做 | 为什么 |
|----------|--------|
| 叫朋友来点赞 | Reddit 反刷票很严，会封号 |
| 用小号评论自己的帖子 | 被发现 = 永久封禁 |
| 同一天发多个 subreddit | 被标记为垃圾信息 |
| 删帖重发 | Reddit 对重复提交很敏感 |
| 跟喷子吵架 | 冷静回复或忽略 |

### 3. 一周内的发帖节奏

| 日期 | 动作 |
|------|------|
| 今天 | 发 **r/SideProject** |
| +2天 | 发 **r/webdev**（用技术角度的版本） |
| +4天 | 发 **r/privacy**（用隐私角度的版本） |
| +7天 | 看情况决定是否发 r/InternetIsBeautiful |

---

## 第六步：效果预期

| 场景 | 预计效果 |
|------|---------|
| 帖子被忽略（大概率） | 10-30 次点击，几条评论 |
| 帖子小火 | 100-500 次点击，收获 20+ upvote |
| 帖子大火（需要运气） | 1000+ 点击，100+ upvote，被其他地方转发 |

> [!NOTE]
> 不是每篇帖子都能火。但即使只有 30 次点击，也比现在的 0 次好。**关键是坚持发**，不同 subreddit 用不同角度切入。Reddit 最大的价值不只是直接流量，而是**高权重外链**——Google 非常重视 Reddit 上的链接。
