<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer
    class="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800"
    aria-labelledby="footer-heading"
  >
    <h2 id="footer-heading" class="sr-only">Footer</h2>
    <div class="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div class="flex flex-col md:flex-row justify-between items-center gap-8">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="flex items-center gap-2">
          <div
            class="flex h-6 w-6 items-center justify-center rounded bg-primary text-white"
          >
            <span class="material-symbols-outlined text-[16px]">auto_fix</span>
          </div>
          <span class="text-lg font-bold text-slate-900 dark:text-white"
            >PixelSwift</span
          >
        </NuxtLink>

        <!-- Links -->
        <div class="flex flex-wrap justify-center gap-x-8 gap-y-4">
          <NuxtLink
            :to="localePath('/privacy')"
            class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            {{ t("footer.privacy") }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/terms')"
            class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            {{ t("footer.terms") }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/contact')"
            class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            {{ t("footer.contact") }}
          </NuxtLink>
        </div>


      </div>

      <div
        class="mt-8 border-t border-slate-900/10 dark:border-white/10 pt-8 text-center"
      >
        <p class="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {{ t("footer.copyright", { year: currentYear }) }}
        </p>
      </div>
    </div>
  </footer>
</template>
