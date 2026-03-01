<script setup>
// Element Plus 暗黑模式支持（官方方案）
import "element-plus/theme-chalk/dark/css-vars.css";

// 生成 hreflang、og:locale 和 canonical link 标签，用于 SEO 多语言优化
const head = useLocaleHead({
  addDirAttribute: true,
  addSeoAttributes: true,
});
useHead({
  htmlAttrs: computed(() => head.value.htmlAttrs),
  link: computed(() => head.value.link),
  meta: computed(() => head.value.meta),
});

// ── Schema.org：全局 WebSite 结构化数据 ──
const { t } = useI18n();
useSchemaOrg([
  defineWebSite({
    name: "PixelSwift",
    description: t("schema.siteDescription"),
  }),
]);
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/*
 * Element Plus Theme Color Override
 *
 * :root       => overrides EP light mode defaults (specificity 0,1,0)
 * html.dark   => overrides EP dark mode defaults (specificity 0,1,1)
 *
 * EP dark/css-vars.css uses html.dark selector, so we must match
 * the same selector to override dark mode primary color.
 */

/* ── Light Mode ── */
/* html:root (0,1,1) beats EP's auto-imported :root (0,1,0) */
html:root {
  --el-color-primary: #2563eb;
  --el-color-primary-light-1: #3b82f6;
  --el-color-primary-light-2: #60a5fa;
  --el-color-primary-light-3: #93bbfd;
  --el-color-primary-light-4: #a5c8fe;
  --el-color-primary-light-5: #bdd5fe;
  --el-color-primary-light-6: #c9ddfe;
  --el-color-primary-light-7: #d4e4fe;
  --el-color-primary-light-8: #e0ecff;
  --el-color-primary-light-9: #ecf3ff;
  --el-color-primary-dark-2: #1d4ed8;
}

/* ── Dark Mode ── */
html.dark {
  --el-color-primary: #3b82f6;
  --el-color-primary-light-1: #2563eb;
  --el-color-primary-light-2: #1d4ed8;
  --el-color-primary-light-3: #1e40af;
  --el-color-primary-light-4: #1e3a8a;
  --el-color-primary-light-5: #1a3270;
  --el-color-primary-light-6: #162b5e;
  --el-color-primary-light-7: #12234d;
  --el-color-primary-light-8: #0e1c3d;
  --el-color-primary-light-9: #0a142d;
  --el-color-primary-dark-2: #60a5fa;
}

/* ── View Transition (circular theme toggle) ── */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) {
  z-index: 1;
}
::view-transition-new(root) {
  z-index: 9999;
}
/* ── 移动端 iOS Safari 防缩放 ── */
/* iOS Safari 在 focus 字体 < 16px 的表单元素时会自动放大页面 */
@media screen and (max-width: 768px) {
  select,
  input,
  textarea,
  .el-input__inner,
  .el-select .el-input__inner {
    font-size: 16px !important;
  }
}
</style>
