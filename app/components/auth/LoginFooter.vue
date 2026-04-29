<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer
    class="border-t border-slate-200/70 bg-white/75 py-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/70"
  >
    <div
      class="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8"
    >
      <p class="text-xs text-slate-400 dark:text-slate-500">
        {{ t("footer.copyright", { year: currentYear }) }}
      </p>

      <nav class="flex items-center gap-5">
        <NuxtLink
          :to="localePath('/terms')"
          class="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {{ t("footer.terms") }}
        </NuxtLink>

        <NuxtLink
          :to="localePath('/privacy')"
          class="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {{ t("footer.privacy") }}
        </NuxtLink>
      </nav>
    </div>
  </footer>
</template>
