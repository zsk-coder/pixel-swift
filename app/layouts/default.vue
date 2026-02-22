<script setup lang="ts">
const { t } = useI18n();
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

    <!-- Cookie 同意横幅 -->
    <CookieConsent />
  </div>
</template>
