<script setup lang="ts">
// 工具页面 FAQ 组件：展示常见问题 + 生成 FAQ Schema 结构化数据
const props = defineProps<{
  /** i18n key 前缀，如 'converter.faq' */
  i18nPrefix: string;
  /** FAQ 条目数量 */
  count: number;
}>();

const { t } = useI18n();

// 构建 FAQ 数据
const faqItems = computed(() =>
  Array.from({ length: props.count }, (_, i) => ({
    q: t(`${props.i18nPrefix}.q${i + 1}`),
    a: t(`${props.i18nPrefix}.a${i + 1}`),
  })),
);

// 注入 FAQ Schema 结构化数据
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() =>
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.value.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      ),
    },
  ],
});

// 展开/收起状态
const openIndex = ref<number | null>(null);
function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index;
}
</script>

<template>
  <section class="w-full max-w-3xl mx-auto mt-12 mb-8 px-4">
    <h2
      class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-center mb-8"
    >
      {{ t(`${i18nPrefix}.title`) }}
    </h2>
    <div class="space-y-3">
      <div
        v-for="(item, index) in faqItems"
        :key="index"
        class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-shadow hover:shadow-md"
      >
        <button
          class="w-full flex items-center justify-between px-5 py-4 text-left"
          @click="toggle(index)"
        >
          <span
            class="text-sm font-semibold text-slate-900 dark:text-white pr-4"
          >
            {{ item.q }}
          </span>
          <span
            class="material-symbols-outlined text-slate-400 transition-transform duration-300 shrink-0"
            :class="{ 'rotate-180': openIndex === index }"
          >
            expand_more
          </span>
        </button>
        <div
          class="overflow-hidden transition-all duration-300"
          :class="
            openIndex === index
              ? 'max-h-40 opacity-100'
              : 'max-h-0 opacity-0'
          "
        >
          <p
            class="px-5 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
          >
            {{ item.a }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
