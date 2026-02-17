<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: "Privacy Policy - PixelSwift",
  meta: [
    {
      name: "description",
      content:
        "PixelSwift privacy policy. All image processing happens locally in your browser. We never upload or store your files.",
    },
  ],
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-slate-900">
    <div class="mx-auto max-w-3xl px-6 py-16 sm:py-24 lg:px-8">
      <h1
        class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4"
      >
        {{ t("legal.privacy.title") }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-12">
        {{ t("legal.privacy.lastUpdated", { date: "2026-02-17" }) }}
      </p>

      <div class="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <!-- Overview -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.overviewTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.privacy.overviewText") }}
          </p>
        </section>

        <!-- Data Collection -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.dataTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            {{ t("legal.privacy.dataText") }}
          </p>
          <ul
            class="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1"
          >
            <li>{{ t("legal.privacy.dataItem1") }}</li>
            <li>{{ t("legal.privacy.dataItem2") }}</li>
            <li>{{ t("legal.privacy.dataItem3") }}</li>
          </ul>
        </section>

        <!-- Local Processing -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.localTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.privacy.localText") }}
          </p>
        </section>

        <!-- Cookies -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.cookiesTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.privacy.cookiesText") }}
          </p>
        </section>

        <!-- Third Party -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.thirdPartyTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.privacy.thirdPartyText") }}
          </p>
        </section>

        <!-- Contact -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.privacy.contactTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.privacy.contactText") }}
            <a
              href="mailto:shuaikangzhang62@gmail.com"
              class="text-primary hover:underline"
              >shuaikangzhang62@gmail.com</a
            >
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
