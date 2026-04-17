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
    <div class="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <!-- Logo & Slogan Column -->
        <div class="space-y-6 xl:col-span-1">
          <NuxtLink :to="localePath('/')" class="flex items-center gap-2">
            <div
              class="flex h-6 w-6 items-center justify-center rounded bg-primary text-white"
            >
              <span
                aria-hidden="true"
                class="material-symbols-outlined text-[16px]"
                >auto_fix</span
              >
            </div>
            <span class="text-lg font-semibold text-slate-900 dark:text-white"
              >PixelSwift</span
            >
          </NuxtLink>
          <p
            class="text-sm leading-6 text-slate-500 dark:text-slate-400 max-w-xs"
          >
            {{ t("seo.home.description") }}
          </p>
        </div>

        <!-- Links Columns -->
        <div class="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <!-- Tools -->
            <div>
              <ul role="list" class="space-y-4">
                <li>
                  <NuxtLink
                    :to="localePath('/compress-image')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("nav.compressor") }}
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink
                    :to="localePath('/converter')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("nav.converter") }}
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink
                    :to="localePath('/resize-image')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("nav.resizer") }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <!-- Resources -->
            <div class="mt-10 md:mt-0">
              <ul role="list" class="space-y-4">
                <li>
                  <NuxtLink
                    :to="localePath('/blog')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("nav.blog") }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </div>

          <div class="md:grid md:grid-cols-2 md:gap-8">
            <!-- Legal -->
            <div>
              <ul role="list" class="space-y-4">
                <li>
                  <NuxtLink
                    :to="localePath('/privacy')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("footer.privacy") }}
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink
                    :to="localePath('/terms')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("footer.terms") }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <!-- Support -->
            <div class="mt-10 md:mt-0">
              <ul role="list" class="space-y-4">
                <li>
                  <NuxtLink
                    :to="localePath('/contact')"
                    class="text-sm leading-6 text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {{ t("footer.contact") }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div
        class="mt-8 border-t border-slate-900/10 dark:border-white/10 pt-6 lg:mt-12"
      >
        <p
          class="text-xs leading-5 text-slate-500 dark:text-slate-400 text-center"
        >
          {{ t("footer.copyright", { year: currentYear }) }}
        </p>
      </div>
    </div>
  </footer>
</template>
