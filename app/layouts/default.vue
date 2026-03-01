<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();

// 工具页有固定底部栏，需要额外底部间距防止遮挡 footer
const hasFixedBottomBar = computed(() => {
  const path = route.path;
  return (
    path.includes("compress-image") ||
    path.includes("resize-image")
  );
});
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
    <div v-if="hasFixedBottomBar" class="h-40 lg:hidden"></div>

    <!-- Cookie 同意横幅 -->
    <CookieConsent />
  </div>
</template>
