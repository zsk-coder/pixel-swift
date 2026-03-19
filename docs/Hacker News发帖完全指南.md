# Hacker News (Show HN) 发帖完全指南

> 本文档包含：注册教程 → 发帖步骤 → 可直接使用的帖子内容 → 注意事项

---

## 📋 第一部分：注册与准备

### 1. 注册账号
1. 打开 [https://news.ycombinator.com/](https://news.ycombinator.com/)
2. 点击右上角 **login**
3. 在登录页面找到 **Create Account** 部分
4. 填写：
   - **username**：选一个简洁的用户名（建议与你的开发者身份相关，比如 `zsk-dev`）
   - **password**：设置密码
5. 点击 **create account** 完成注册

> ⚠️ **重要**：新账号没有发帖限制，但建议注册后先花几分钟浏览首页、给几个帖子投票（点击标题左边的 ▲），让账号有一点活跃度。

### 2. 了解 HN 的文化
- **HN 用户极其厌恶营销**，任何自夸、夸大、广告味的内容都会被快速降权
- 他们尊重：技术深度、真诚分享、解决实际问题
- "Show HN" 是专门给开发者展示个人项目的官方板块，**天然适合 PixelSwift**
- 帖子的排名 = **投票数 ÷ 时间衰减**，所以选对时间发很重要

### 3. 最佳发帖时间
- **最佳时间**：美东上午 8:00-10:00 AM = **北京时间晚上 21:00-23:00**
- 这是美国程序员上班后第一时间刷 HN 的高峰期
- 周二到周四效果最好，避开周末（流量低）

---

## 🚀 第二部分：发帖步骤

### Step 1：进入提交页面
1. 登录后，点击页面顶部导航栏的 **submit**
2. 或者直接访问：[https://news.ycombinator.com/submit](https://news.ycombinator.com/submit)

### Step 2：填写帖子信息

HN 的提交表单非常简单，只有 3 个字段：

| 字段 | 填写内容 |
|------|---------|
| **title** | `Show HN: PixelSwift – Browser-only image compressor/converter using WebAssembly` |
| **url** | `https://pixelswift.site` |
| **text** | **留空！** 如果填了 url 就不要填 text（二选一） |

> **标题规则**：
> - 必须以 `Show HN:` 开头（注意冒号后有空格）
> - 保持简洁，不要用感叹号、全大写或夸张词汇
> - 不要写 "free"、"best"、"amazing" 这类营销词

### Step 3：提交后立即发首评
**这一步极其关键！** 提交帖子后，立刻点进自己的帖子，在评论区写第一条评论。

HN 的传统是：Show HN 的作者在首评里介绍自己为什么做这个项目、技术细节、以及你想得到什么反馈。**这条评论的质量直接决定帖子的存亡。**

---

## 📝 第三部分：可直接使用的内容

### 标题（title）

**推荐标题**（从以下选一个）：

```
Show HN: PixelSwift – Browser-only image compressor/converter using WebAssembly
```

```
Show HN: PixelSwift – Image compression that never uploads your files (WASM + OffscreenCanvas)
```

```
Show HN: A client-side image compressor using WebAssembly – no server, no uploads
```

> 选择建议：第 1 个最稳妥，第 2 个突出隐私卖点，第 3 个更技术向。

---

### 首评（第一条评论）— 可直接复制使用

```
Hi HN,

I built PixelSwift because I was tired of image compression tools that require
uploading files to a server. I wanted something that:

1. Never touches a server – all processing happens in the browser
2. Has no file count limits or daily quotas
3. Supports batch processing
4. Actually produces good compression quality

**How it works technically:**

- Uses OffscreenCanvas API for image decoding/encoding
- Compression is done via the browser's native `canvas.convertToBlob()` with
  configurable quality parameters
- Supports 7+ input formats (JPG, PNG, WebP, BMP, TIFF, AVIF, GIF) →
  outputs to JPG, PNG, or WebP
- Built with Nuxt 4 + Vue 3, deployed on Cloudflare Pages
- Includes a compare slider for before/after preview on single images
- Batch mode with ZIP download (JSZip, lazy-loaded)
- 8 languages (en, zh, ja, ko, de, fr, es, pt) via @nuxtjs/i18n

**What I'd love feedback on:**

- Compression quality – is it comparable to what you'd expect?
- UX flow – anything confusing or missing?
- Any formats you'd want supported that aren't there?

No tracking, no ads, no accounts, no API calls. Just a static site on
Cloudflare Pages.

Link: https://pixelswift.site
```

---

### 备用首评（更简短版本）

如果你觉得上面的太长，可以用这个简短版本：

```
Hi HN, maker here.

I built this because every image compressor I tried either uploads your files
to a server, limits you to 20 files/day, or both.

PixelSwift runs entirely in your browser using OffscreenCanvas. No uploads,
no server, no limits. Supports JPG/PNG/WebP/BMP/TIFF/AVIF/GIF input,
outputs to JPG/PNG/WebP.

Built with Nuxt 4 + Vue 3, hosted on Cloudflare Pages (static site, no backend).

I'd appreciate any feedback on compression quality and the overall UX.
```

---

## 💬 第四部分：如何回复评论

发完帖后，**前 2 小时非常关键**，你要守在电脑前快速回复每一条评论。

### 常见问题及应对模板

**Q: "How does this compare to TinyPNG / Squoosh?"**
```
Great question. TinyPNG uses server-side MozJPEG which generally produces
better compression ratios for JPG. Squoosh also uses WASM codecs
(MozJPEG, OxiPNG etc.) so it's the closest comparison.

The main differences from Squoosh:
- Batch processing (Squoosh is single-file only)
- ZIP download for multiple files
- 8-language internationalization
- Slightly simpler UX for non-technical users

I'd say if you need the absolute best compression ratio, Squoosh wins.
If you want batch processing with a simpler interface, that's where
PixelSwift fits.
```

**Q: "Why not use WASM codecs like MozJPEG directly?"**
```
That's a fair point and something I've considered. Currently I'm using
the browser's native canvas.convertToBlob() which is simpler but
produces slightly larger files than MozJPEG WASM.

I actually have @jsquash/jpeg (MozJPEG WASM port) and @jsquash/oxipng
as dependencies – integrating them as an optional "maximum compression"
mode is on my roadmap. The tradeoff is download size (~2MB WASM binaries)
vs. compression quality.
```

**Q: "Why should I trust that it doesn't upload anything?"**
```
You don't have to trust me – you can verify. Open DevTools > Network tab
while processing images. You'll see zero outgoing requests. The site is
a static deployment on Cloudflare Pages with no backend API.

You can also check the source code: [your GitHub link if open source]
```

**Q: "The compression quality isn't great"**
```
Thanks for the feedback. You're right that the browser's native encoding
isn't as good as specialized codecs. I'm working on integrating MozJPEG
and OxiPNG via WebAssembly for better compression ratios while keeping
everything client-side.
```

**Q: "Nice, but Squoosh already does this"**
不要争辩！友好承认竞品的优势：
```
Squoosh is excellent – it's one of the tools that inspired me. The main
gaps I wanted to fill were batch processing and ZIP download, which
Squoosh doesn't support. For single-image work, Squoosh is hard to beat.
```

---

## ⚠️ 第五部分：关键注意事项

### ❌ 绝对不要做

1. **不要刷票** — 不要发给朋友让他们去投票，HN 有检测机制，会直接杀帖
2. **不要发到任何群/聊天室拉票** — 同上，检测到会被 ban
3. **不要自夸** — "best", "amazing", "revolutionary" 这些词会让你的帖子被秒踩
4. **不要跟批评者争辩** — 友好地接受反馈，即使对方说得不对
5. **不要二次提交** — 如果帖子没火，不要删了重发（HN 会标记重复提交）
6. **标题不要用感叹号 ！**— 这是 HN 的大忌

### ✅ 一定要做

1. **发完帖立刻写首评** — 没有首评的 Show HN 基本不会活
2. **前 2 小时守着回复** — 快速、真诚地回复每条评论
3. **承认不足** — 主动说出产品的缺点（这在 HN 反而赢得尊重）
4. **感谢反馈** — 每条有价值的反馈都说 "Thanks, that's helpful"
5. **技术细节越多越好** — HN 用户爱看底层实现

### 📐 标题万金油公式

```
Show HN: [产品名] – [一句话描述做什么的] ([用什么技术])
```

好的例子：
- `Show HN: PixelSwift – Browser-only image compressor using WebAssembly`
- `Show HN: Hurl – A command line tool to run HTTP requests defined in a simple text format`
- `Show HN: Briefer – Open source Jupyter alternative with dashboards`

烂的例子：
- ~~`Show HN: PixelSwift – The BEST free image compressor!`~~
- ~~`Show HN: I made an amazing tool that will change how you compress images!!!`~~
- ~~`Show HN: PixelSwift is the fastest, most secure image compressor ever built`~~

---

## 📅 发帖 Checklist

发帖当天，按这个顺序执行：

- [ ] 确认 PixelSwift 网站可以正常访问、加载速度快
- [ ] 确认压缩/转换功能正常工作（多测几种格式）
- [ ] 北京时间晚 21:00-23:00（周二-周四最佳），打开 HN
- [ ] 提交帖子（title + url）
- [ ] **立刻**写首评（复制本文档中的首评内容，根据实际情况微调）
- [ ] 接下来 2 小时内保持在线，快速回复每条评论
- [ ] 不要分享链接给任何人拉票
- [ ] 如果帖子起飞了，继续回复到帖子不再有新评论为止

---

## 📊 什么算成功？

| 指标 | 一般 | 不错 | 大成功 |
|------|------|------|--------|
| 投票数 | 5-15 | 30-80 | 100+ |
| 评论数 | 3-10 | 15-40 | 50+ |
| 当日 UV | 200-500 | 1000-3000 | 5000+ |
| 是否上首页 | 未上 | 短暂上过 | 停留数小时 |

即使只拿到 10 个投票也不要灰心 — 很多好产品第一次发也没火。HN 允许你过几个月产品有重大更新后再次提交。

---

## 🔗 参考资料

- [Show HN 官方指南](https://news.ycombinator.com/showhn.html) — 发帖前必读
- [HN 排名算法解释](https://news.ycombinator.com/newsguidelines.html) — 社区规则
