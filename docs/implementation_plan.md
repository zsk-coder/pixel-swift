# 博客模块内容填充 — 修订版实施方案

采用 `@nuxt/content` v3 构建内容驱动的博客系统，填充 6 篇 SEO 专业文章，覆盖 8 种语言。

---

## 一、SEO 专家选题策略

从搜索意图漏斗出发，6 篇文章覆盖 **竞品截流 → 格式科普 → 场景解决 → 技术布道 → 实操教程 → 行业指南** 全链路：

| # | Slug | 标题 | 核心关键词池 | 搜索意图 | 月搜索量级 |
|---|---|---|---|---|---|
| 1 | `tinypng-alternative-privacy` | TinyPNG vs PixelSwift: Why Client-Side Compression Wins | tinypng alternative, compress images without uploading, private image compressor | 竞品截流/转化 | ★★★★★ |
| 2 | `webp-vs-jpg-vs-png` | WebP vs JPG vs PNG: The Ultimate Image Format Guide | webp vs jpg, best image format for website, png vs webp | 信息获取 | ★★★★★ |
| 3 | `compress-images-for-email` | How to Reduce Image File Size for Email Without Losing Quality | compress image for email, reduce image size kb, shrink photo for email | 问题解决 | ★★★★☆ |
| 4 | `browser-image-compression-explained` | How Browser-Based Image Compression Works (No Upload Needed) | client-side image processing, browser image compression, wasm image processing | 技术布道 | ★★★☆☆ |
| 5 | `optimize-images-for-web` | How to Optimize Images for Web Performance in 2026 | optimize images for web, reduce page load time, image optimization techniques | 实操教程 | ★★★★☆ |
| 6 | `image-seo-best-practices` | Image SEO: 10 Proven Practices to Rank Higher in Google Images | image seo, optimize images for google, alt text best practices, image sitemap | 行业指南 | ★★★★☆ |

**选题逻辑**：
- **#1** 直接截流 TinyPNG 竞品搜索流量（"tinypng alternative" 月搜索量 8K+），碰瓷隐私痛点
- **#2** 最大流量池（"webp vs jpg" 月搜索量 33K+），作为常青科普入口
- **#3** 精准痛点场景（邮件附件过大是高频真实需求），自然引导使用压缩+缩放工具
- **#4** 技术差异化布道（纯本地 WASM 处理），建立品牌技术壁垒认知
- **#5** 与现有 mock 详情页标题一致，覆盖"web image optimization"这一核心赛道
- **#6** 图片 SEO 指南，用户画像与工具完美匹配，内链回所有工具页

---

## 二、技术架构：@nuxt/content v3

### 内容目录结构

```
content/
├── blog/
│   ├── en/                          # 英文（默认语言）
│   │   ├── tinypng-alternative-privacy.md
│   │   ├── webp-vs-jpg-vs-png.md
│   │   ├── compress-images-for-email.md
│   │   ├── browser-image-compression-explained.md
│   │   ├── optimize-images-for-web.md
│   │   └── image-seo-best-practices.md
│   ├── zh/                          # 简体中文
│   │   └── (同上 6 篇)
│   ├── ja/                          # 日文
│   ├── ko/                          # 韩文
│   ├── de/                          # 德文
│   ├── fr/                          # 法文
│   ├── es/                          # 西班牙文
│   └── pt/                          # 葡萄牙文
```

每篇 Markdown frontmatter：
```yaml
---
title: "WebP vs JPG vs PNG: The Ultimate Image Format Guide"
description: "Learn the key differences between WebP, JPG, and PNG..."
category: "guides"
author: "Alex Chen"
date: "2026-03-11"
readTime: 10
cover: "/images/blog/format-comparison.png"
featured: false
---
```

---

## 三、Proposed Changes

### 3.1 安装与配置

#### [NEW] 安装 @nuxt/content
```bash
npm install @nuxt/content
```

#### [MODIFY] [nuxt.config.ts](file:///d:/A_工作/前端/项目/项目/ai/pixel-swift/nuxt.config.ts)
- 在 `modules` 数组中添加 `'@nuxt/content'`

#### [NEW] [content.config.ts](file:///d:/A_工作/前端/项目/项目/ai/pixel-swift/content.config.ts)
- 定义 `blog` collection，`type: 'page'`，source 指向 `content/blog/**/*.md`

---

### 3.2 内容文件 (48 个 Markdown 文件)

#### [NEW] content/blog/{lang}/{slug}.md × 6 篇 × 8 语言

每篇文章 1500-2500 字，遵循以下 SEO 写作规范：
- 唯一 H1（从 frontmatter title 自动生成）
- 有序 H2/H3 层级、不跳跃
- 每 200-300 字自然植入一个核心关键词变体
- 每篇至少 2 个 CTA 内链指向工具页 (`/compress-image`, `/converter`, `/resize-image`)
- 文章间建立内链网络（相关阅读推荐）

---

### 3.3 页面修改

#### [MODIFY] [index.vue](file:///d:/A_工作/前端/项目/项目/ai/pixel-swift/app/pages/blog/index.vue)
- 用 `queryCollection('blog')` 替换 mock posts 数据
- 按当前 locale 过滤文章
- 分类过滤基于 frontmatter `category`

#### [MODIFY] [[slug].vue](file:///d:/A_工作/前端/项目/项目/ai/pixel-swift/app/pages/blog/[slug].vue)
- 用 `queryCollection('blog').path()` 获取当前文章
- `ContentRenderer` 渲染 Markdown 正文
- 动态生成 TOC（从内容的 heading 中提取）
- 添加 `BlogPosting` Schema.org JSON-LD
- 完整 SEO meta tags
- 推荐文章从同 collection 查询

---

## 四、Verification Plan

1. `npm run dev` 启动后访问 `/blog` 确认文章列表正确展示
2. 点击各篇文章 `/blog/[slug]` 确认渲染正常
3. 切换语言确认各语言文章内容正确
4. 检查 HTML 源码的 Schema.org JSON-LD 和 meta tags
5. 分类筛选功能正常
