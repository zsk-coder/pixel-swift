<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: () => t("seo.refund.title"),
  meta: [
    {
      name: "description",
      content: () => t("seo.refund.description"),
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
        {{ t("legal.refund.title") }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-12">
        {{ t("legal.refund.lastUpdated", { date: "2026-04-29" }) }}
      </p>

      <div class="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <!-- Overview -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.overviewTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.refund.overviewText") }}
          </p>
        </section>

        <!-- Free Features -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.freeTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.refund.freeText") }}
          </p>
        </section>

        <!-- Pro Subscription Refunds -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.proTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            {{ t("legal.refund.proText") }}
          </p>
          <ul
            class="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1"
          >
            <li>{{ t("legal.refund.proItem1") }}</li>
            <li>{{ t("legal.refund.proItem2") }}</li>
            <li>{{ t("legal.refund.proItem3") }}</li>
          </ul>
        </section>

        <!-- How to Request -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.howTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            {{ t("legal.refund.howText") }}
          </p>
          <ul
            class="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1"
          >
            <li>{{ t("legal.refund.howItem1") }}</li>
            <li>{{ t("legal.refund.howItem2") }}</li>
            <li>{{ t("legal.refund.howItem3") }}</li>
          </ul>
        </section>

        <!-- Processing Time -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.timeTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.refund.timeText") }}
          </p>
        </section>

        <!-- Exceptions -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.exceptionsTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            {{ t("legal.refund.exceptionsText") }}
          </p>
          <ul
            class="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1"
          >
            <li>{{ t("legal.refund.exceptionsItem1") }}</li>
            <li>{{ t("legal.refund.exceptionsItem2") }}</li>
          </ul>
        </section>

        <!-- Contact -->
        <section>
          <h2
            class="text-xl font-semibold text-slate-900 dark:text-white mb-3"
          >
            {{ t("legal.refund.contactTitle") }}
          </h2>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ t("legal.refund.contactText") }}
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
