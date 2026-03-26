<script setup lang="ts">
const { t } = useI18n();

// 全局 title 模板：所有页面自动追加 "| PixelSwift"
useHead({
  titleTemplate: "%s | PixelSwift",
});

// 工具页通过 useState 设置此值，布局读取后在 Footer 下方添加间距
const hasFixedBottomBar = useState("hasFixedBottomBar", () => false);
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans transition-colors duration-200"
  >
    <!-- Header -->
    <AppHeader />

    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <AppFooter />

    <!-- 移动端底部间距：防止工具页固定下载栏遮挡 footer -->
    <div v-if="hasFixedBottomBar" class="h-28 lg:hidden"></div>
  </div>
</template>
