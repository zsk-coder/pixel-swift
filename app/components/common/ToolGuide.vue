<script setup lang="ts">
/**
 * 工具页面引导内容组件：展示"使用步骤" + "使用场景" SEO 可爬取内容
 * 用法：<ToolGuide i18n-prefix="compressor.guide" :steps="3" :cases="4" />
 */
const props = defineProps<{
  /** i18n key 前缀，如 'compressor.guide' */
  i18nPrefix: string;
  /** 步骤数量 */
  steps?: number;
  /** 使用场景数量 */
  cases?: number;
}>();

const { t } = useI18n();

const stepItems = computed(() =>
  Array.from({ length: props.steps || 3 }, (_, i) => ({
    title: t(`${props.i18nPrefix}.step${i + 1}Title`),
    desc: t(`${props.i18nPrefix}.step${i + 1}Desc`),
  })),
);

const caseItems = computed(() =>
  Array.from({ length: props.cases || 4 }, (_, i) => ({
    icon: t(`${props.i18nPrefix}.case${i + 1}Icon`),
    title: t(`${props.i18nPrefix}.case${i + 1}Title`),
    desc: t(`${props.i18nPrefix}.case${i + 1}Desc`),
  })),
);
</script>

<template>
  <section class="w-full mt-12 mb-4">
    <!-- How to Use -->
    <div class="mb-12">
      <h2
        class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-center mb-8"
      >
        {{ t(`${i18nPrefix}.stepsTitle`) }}
      </h2>
      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="(step, index) in stepItems"
          :key="index"
          class="relative flex flex-col items-center text-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <!-- Step number badge -->
          <div
            class="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow"
          >
            {{ index + 1 }}
          </div>
          <h3
            class="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-2"
          >
            {{ step.title }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {{ step.desc }}
          </p>
        </div>
      </div>
    </div>

    <!-- Use Cases -->
    <div>
      <h2
        class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-center mb-8"
      >
        {{ t(`${i18nPrefix}.casesTitle`) }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="(item, index) in caseItems"
          :key="index"
          class="flex gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
        >
          <div
            class="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-primary flex items-center justify-center"
          >
            <span
              aria-hidden="true"
              class="material-symbols-outlined text-xl"
              >{{ item.icon }}</span
            >
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-1">
              {{ item.title }}
            </h3>
            <p
              class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
            >
              {{ item.desc }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
