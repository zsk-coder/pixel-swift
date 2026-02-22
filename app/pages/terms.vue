<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: () => t("seo.terms.title"),
  meta: [
    {
      name: "description",
      content: () => t("seo.terms.description"),
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
        {{ t("legal.terms.title") }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-12">
        {{ t("legal.terms.lastUpdated", { date: "2026-02-17" }) }}
      </p>

      <div class="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <!-- Acceptance -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.acceptTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.acceptText") }}
          </p>
        </section>

        <!-- Service Description -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.serviceTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.serviceText") }}
          </p>
        </section>

        <!-- Usage Rules -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.usageTitle") }}
          </h2>
          <ul
            class="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1"
          >
            <li>{{ t("legal.terms.usageItem1") }}</li>
            <li>{{ t("legal.terms.usageItem2") }}</li>
            <li>{{ t("legal.terms.usageItem3") }}</li>
          </ul>
        </section>

        <!-- Intellectual Property -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.ipTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.ipText") }}
          </p>
        </section>

        <!-- Disclaimer -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.disclaimerTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.disclaimerText") }}
          </p>
        </section>

        <!-- Changes -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.changesTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.changesText") }}
          </p>
        </section>

        <!-- Contact -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.terms.contactTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.terms.contactText") }}
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
