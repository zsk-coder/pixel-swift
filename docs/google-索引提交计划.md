# Google Search Console 索引提交计划

> 创建日期：2026-03-04
> 目标：让所有核心工具页面在 8 种语言下全部被 Google 索引

## 当前收录状态（2026-03-04）

| 页面           | en  | zh  | es  | ja  | de  | fr  | pt  | ko  |
| -------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| 首页           | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ❌  | ❌  |
| compress-image | ✅  | ✅  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| converter      | ✅  | ✅  | ✅  | ✅  | ❌  | ❌  | ❌  | ❌  |
| resize-image   | ✅  | ✅  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| contact        | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| privacy        | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| terms          | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |

---

## 第 1 批 — 3月4日（今天）

> 在 Search Console 顶部"网址检查"中粘贴 URL → 点击"请求编入索引"

- [ ] `https://pixelswift.site/de/compress-image`
- [ ] `https://pixelswift.site/fr/compress-image`
- [ ] `https://pixelswift.site/de/converter`
- [ ] `https://pixelswift.site/fr/converter`
- [ ] `https://pixelswift.site/de/resize-image`
- [ ] `https://pixelswift.site/fr/resize-image`
- [ ] `https://pixelswift.site/pt`
- [ ] `https://pixelswift.site/ko`

---

## 第 2 批 — 3月5日

- [x] `https://pixelswift.site/es/compress-image`
- [x] `https://pixelswift.site/ja/compress-image`
- [ ] `https://pixelswift.site/pt/compress-image`
- [ ] `https://pixelswift.site/ko/compress-image`
- [ ] `https://pixelswift.site/pt/converter`
- [ ] `https://pixelswift.site/ko/converter`
- [ ] `https://pixelswift.site/es/resize-image`
- [ ] `https://pixelswift.site/ja/resize-image`
- [ ] `https://pixelswift.site/pt/resize-image`
- [ ] `https://pixelswift.site/ko/resize-image`

---

## 第 3 批 — 3月6日（辅助页面，优先级低）

- [ ] `https://pixelswift.site/contact`
- [ ] `https://pixelswift.site/zh/contact`
- [ ] `https://pixelswift.site/privacy`
- [ ] `https://pixelswift.site/zh/privacy`
- [ ] `https://pixelswift.site/terms`
- [ ] `https://pixelswift.site/zh/terms`

> 其他语言的 contact/privacy/terms 无需手动提交，让 Google 自然爬取即可。

---

## 验收检查 — 3月10日

- [ ] 再次访问 Search Console → 网页索引编制，确认已索引数量增长
- [ ] 用 `site:https://pixelswift.site` 搜索，确认结果数接近 40+
- [ ] 检查"未编入索引"列表，查看是否有被拒绝的页面及原因

---

## 注意事项

- "请求编入索引"每天有次数限制（约 10-20 次），不要一天提交太多
- 提交后通常 1-3 天 Google 会完成爬取和索引
- 重复提交同一个 URL 不会有负面影响，只是催 Google 重新爬取
- Sitemap 已包含全部 56 个 URL，Google 也会通过 sitemap 自动发现，手动提交只是加速
