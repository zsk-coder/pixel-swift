<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <header
    class="border-b border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/70"
  >
    <div
      class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
    >
      <NuxtLink
        :to="localePath('/')"
        class="inline-flex items-center gap-2 text-slate-950 transition-opacity hover:opacity-80 dark:text-white"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"
        >
          <span aria-hidden="true" class="material-symbols-outlined text-[20px]">auto_fix</span>
        </span>
        <span class="text-base font-semibold tracking-tight">PixelSwift</span>
      </NuxtLink>

      <NuxtLink
        :to="localePath('/')"
        class="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      >
        {{ t("auth.login.backHome") }}
      </NuxtLink>
    </div>
  </header>
</template>
