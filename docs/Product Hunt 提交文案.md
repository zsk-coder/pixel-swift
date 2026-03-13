# PixelSwift — Product Hunt 提交文案

> **提交前提醒**：PH 每个产品只能 launch 一次，请确保准备充分再提交！
> 建议提交时间：**周二至周四**，避开大产品发布日

---

## 基本信息

| 字段                     | 内容                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| **Product Name**         | PixelSwift                                                        |
| **URL**                  | https://pixelswift.site                                           |
| **Tagline** (60字符限制) | Private image tools — compress, convert & resize in your browser  |
| **Topics**               | Image Processing, Privacy, Developer Tools, Web App, Productivity |

---

## Tagline 备选方案

按风格排列，任选其一：

1. **隐私导向** — `Private image tools — compress, convert & resize in your browser`
2. **对标竞品** — `The privacy-first alternative to TinyPNG — no uploads, ever`
3. **技术亮点** — `WebAssembly-powered image processing that never leaves your device`
4. **简洁有力** — `Compress, convert & resize images locally — 100% free & private`

> **推荐使用第 1 条**，兼顾功能描述和隐私卖点，最像 PH 上的高赞 tagline 风格。

---

## Description（产品描述）

```
PixelSwift is a free, browser-based image processing platform built on WebAssembly.
Unlike traditional tools like TinyPNG or iLoveIMG that upload your files to remote servers,
PixelSwift processes everything locally — your images never leave your device.

🔒 **100% Private** — Zero uploads. Your files stay on your device, always.
⚡ **Blazing Fast** — No upload/download wait. Processing starts instantly.
🎨 **3 Tools in One** — Convert (JPG/PNG/WebP/BMP), compress (up to 90% reduction),
   and resize images with precision controls.
🌍 **8 Languages** — English, Chinese, Spanish, Japanese, German, French, Portuguese, Korean.
💰 **Completely Free** — No registration, no watermarks, no usage limits.
📦 **Batch Processing** — Handle up to 20 images at once and download as ZIP.

Built with Nuxt.js and WebAssembly (MozJPEG, UPNG) for professional-grade compression
quality without server dependency.
```

---

## First Comment（发布后的第一条评论）

PH 上第一条评论很重要，通常由 Maker 自己发，讲述产品背后的故事：

```
Hey Product Hunt! 👋

I'm the maker of PixelSwift. Here's why I built it:

Every time I needed to compress an image, I'd go to TinyPNG or iLoveIMG and upload my files
to someone else's server. For personal photos? That felt wrong. For client work?
Even worse — some NDAs explicitly prohibit uploading assets to third-party services.

So I built PixelSwift: an image processing tool that runs **entirely in your browser**.
No server, no upload, no data collection. It uses WebAssembly (MozJPEG for JPEG, UPNG for PNG)
to deliver compression quality on par with TinyPNG — but without your files ever leaving
your device.

It's 100% free, supports 8 languages, and works offline once loaded.

I'd love to hear your feedback! What features would make this more useful for your workflow?
```

---

## Maker Comment 回复模板

准备好一些常见问题的回复：

### Q: "How does the compression quality compare to TinyPNG?"

```
Great question! PixelSwift uses MozJPEG (same encoder Mozilla developed) for JPEG
and UPNG for PNG — both are industry-standard algorithms. In most cases, the output
quality is indistinguishable from TinyPNG. The key difference is WHERE the processing
happens: locally in your browser vs. on TinyPNG's servers.
```

### Q: "Does it work offline?"

```
Yes! Once the page is loaded, all processing happens via WebAssembly in your browser.
You can go offline and it will continue to work. No internet connection needed for
the actual image processing.
```

### Q: "Why not open source?"

```
I'm considering open-sourcing parts of the codebase in the future.
Right now I'm focused on polishing the core experience. Stay tuned!
```

---

## 产品截图建议

PH 允许上传多张截图/GIF，建议准备以下内容：

| 序号 | 内容                 | 说明                                                              |
| ---- | -------------------- | ----------------------------------------------------------------- |
| 1    | **Hero 截图**        | 首页全景，展示品牌和 3 个核心工具卡片                             |
| 2    | **压缩前后对比**     | 显示一张图片压缩 80%+ 的文件大小变化                              |
| 3    | **批量处理演示 GIF** | 拖入多张图片 → 一键处理 → 下载 ZIP 的全流程                       |
| 4    | **隐私对比图**       | 左右对比：传统工具流程（上传→服务器→下载）vs PixelSwift（纯本地） |
| 5    | **多语言展示**       | 展示 8 种语言切换的截图（体现国际化）                             |

> **最重要的是第 3 个（GIF 演示）**，PH 上有动画的产品点击率远高于纯截图。

---

## 提交前 Checklist

- [ ] **og:image 已添加** — PH 会抓取，没有的话展示效果很差
- [ ] **产品 demo GIF 已录制** — 30 秒内展示核心流程
- [ ] **PH 账号已养 1-2 周** — 日常浏览、点赞、评论其他产品
- [ ] **Twitter/X 账号准备好** — PH 上的社交链接
- [ ] **选好发布日期** — 周二至周四，北京时间下午 3-4 点（对应太平洋时间 0:00）
- [ ] **通知朋友/社群支持** — 不要刷票，但可以告知关注者你的发布
- [ ] **准备好全天在线回复评论** — Launch Day 的互动很重要

---

## 时间节点建议

| 时间        | 行动                                          |
| ----------- | --------------------------------------------- |
| **本周**    | 注册 PH 账号，开始养号（每天 5 分钟浏览点赞） |
| **第 2 周** | 完成 og:image、录制 demo GIF、准备截图        |
| **第 3 周** | 选定日期，提交 launch，发布当天全天在线互动   |
