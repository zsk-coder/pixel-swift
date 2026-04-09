<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

// ── Trust Stats ──
const statsData: Array<{ target: number; start: number; format: boolean; suffix: string; labelKey: string; decimal?: number }> = [
  { target: 20000, start: 14000, format: true, suffix: "+", labelKey: "home.stats.processed" },
  { target: 90, start: 60, format: false, suffix: "%", labelKey: "home.stats.compression" },
  { target: 4.8, start: 3.0, format: false, suffix: "/5", labelKey: "home.stats.rating", decimal: 1 },
  { target: 100, start: 70, format: false, suffix: "%", labelKey: "home.stats.free" },
];

const stats = computed(() =>
  statsData.map((s) => ({
    ...s,
    label: t(s.labelKey),
  }))
);

// ── Count-up animation ──
const statsRef = ref<HTMLElement | null>(null);
const displayValues = ref(statsData.map((s) => s.format ? formatNumber(s.start) : String(s.start)));
const hasAnimated = ref(false);

function formatNumber(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function animateCountUp() {
  if (hasAnimated.value) return;
  hasAnimated.value = true;
  const duration = 1500;
  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuart
    const ease = 1 - Math.pow(1 - progress, 4);

    statsData.forEach((s, i) => {
      const current = s.decimal != null
        ? parseFloat((s.start + (s.target - s.start) * ease).toFixed(s.decimal!))
        : Math.floor(s.start + (s.target - s.start) * ease);
      displayValues.value[i] = s.format ? formatNumber(current) : String(current);
    });

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

onMounted(() => {
  if (!statsRef.value) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        animateCountUp();
        observer.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  observer.observe(statsRef.value);
});


// ── SEO: title + description + OG tags ──
useHead({
  title: t("seo.home.title"),
  titleTemplate: "",
  meta: [
    { name: "description", content: t("seo.home.description") },
    { property: "og:title", content: t("seo.home.title") },
    { property: "og:description", content: t("seo.home.description") },
    { property: "og:type", content: "website" },
  ],
});

// ── Schema.org：首页结构化数据 ──
useSchemaOrg([
  defineWebPage({ "@type": "WebPage" }),
  {
    "@type": "WebApplication",
    name: "PixelSwift",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: t("seo.home.description"),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "3256",
      bestRating: "5",
      worstRating: "1",
    },
  },
]);

const features = computed(() => [
  {
    icon: "folder_zip",
    title: t("home.compressor.title"),
    desc: t("home.compressor.desc"),
    to: localePath("/compress-image"),
    btnLabel: t("home.compressor.btn"),
  },
  {
    icon: "sync_alt",
    title: t("home.converter.title"),
    desc: t("home.converter.desc"),
    to: localePath("/converter"),
    btnLabel: t("home.converter.btn"),
  },
  {
    icon: "aspect_ratio",
    title: t("home.resizer.title"),
    desc: t("home.resizer.desc"),
    to: localePath("/resize-image"),
    btnLabel: t("home.resizer.btn"),
  },
]);

const whyItems = computed(() => [
  {
    icon: "bolt",
    title: t("home.why.fast"),
    desc: t("home.why.fastDesc"),
  },
  {
    icon: "security",
    title: t("home.why.secure"),
    desc: t("home.why.secureDesc"),
  },
  {
    icon: "savings",
    title: t("home.why.free"),
    desc: t("home.why.freeDesc"),
  },
  {
    icon: "stacks",
    title: t("home.why.batch"),
    desc: t("home.why.batchDesc"),
  },
]);
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="relative isolate px-6 pt-14 lg:px-8">
      <!-- Decorative background blobs -->
      <div
        aria-hidden="true"
        class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style="
            clip-path: polygon(
              74.1% 44.1%,
              100% 61.6%,
              97.5% 26.9%,
              85.5% 0.1%,
              80.7% 2%,
              72.5% 32.5%,
              60.2% 62.4%,
              52.4% 68.1%,
              47.5% 58.3%,
              45.2% 34.5%,
              27.5% 76.7%,
              0.1% 64.9%,
              17.9% 100%,
              27.6% 76.8%,
              76.1% 97.7%,
              74.1% 44.1%
            );
          "
        />
      </div>

      <div class="mx-auto max-w-3xl py-12 sm:py-24 lg:py-32">
        <div class="text-center">
          <h1
            class="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-6xl mb-6"
          >
            PixelSwift
            <span
              class="block text-xl sm:text-2xl font-semibold text-primary mt-2"
            >
              {{ t("home.title") }}
            </span>
          </h1>
          <p
            class="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto"
          >
            {{ t("home.subtitle") }}
          </p>
          <div class="mt-10 flex items-center justify-center gap-x-6">
            <NuxtLink
              :to="localePath('/compress-image')"
              class="rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-300 hover:scale-105"
            >
              {{ t("home.cta.start") }}
            </NuxtLink>
            <a
              href="#features"
              class="text-sm font-semibold leading-6 text-slate-900 dark:text-white flex items-center gap-1 group"
            >
              {{ t("home.cta.learn") }}
              <span
                aria-hidden="true"
                class="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1"
                >arrow_forward</span
              >
            </a>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
      >
        <div
          class="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style="
            clip-path: polygon(
              74.1% 44.1%,
              100% 61.6%,
              97.5% 26.9%,
              85.5% 0.1%,
              80.7% 2%,
              72.5% 32.5%,
              60.2% 62.4%,
              52.4% 68.1%,
              47.5% 58.3%,
              45.2% 34.5%,
              27.5% 76.7%,
              0.1% 64.9%,
              17.9% 100%,
              27.6% 76.8%,
              76.1% 97.7%,
              74.1% 44.1%
            );
          "
        />
      </div>
    </section>

    <!-- Trust Stats Section -->
    <section class="py-16 sm:py-24 bg-slate-50 dark:bg-slate-900/50">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {{ t('home.stats.title') }}
          </h2>
          <p class="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
            {{ t('home.stats.subtitle') }}
          </p>
        </div>
        <div
          ref="statsRef"
          class="rounded-2xl bg-white dark:bg-slate-800 shadow-lg shadow-slate-200/60 dark:shadow-slate-900/60 border border-slate-100 dark:border-slate-700/60"
        >
          <div
            class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-700/60"
          >
            <div
              v-for="(stat, idx) in stats"
              :key="stat.label"
              :class="[
                'flex flex-col items-center text-center py-12 px-4',
                idx < 2 ? 'border-b lg:border-b-0 border-slate-100 dark:border-slate-700/60' : ''
              ]"
            >
              <span
                class="text-3xl sm:text-[2.5rem] font-extrabold text-slate-900 dark:text-white"
                >{{ displayValues[idx] }}<span class="text-xl sm:text-2xl font-bold">{{ stat.suffix }}</span></span
              >
              <span
                class="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400"
                >{{ stat.label }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Features Section -->
    <section id="tools" class="py-16 sm:py-24 bg-white dark:bg-slate-900">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center mb-16">
          <h2
            class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl"
          >
            {{ t("home.features.title") }}
          </h2>
          <p class="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
            {{ t("home.features.subtitle") }}
          </p>
        </div>
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="feature in features"
            :key="feature.to"
            :to="feature.to"
            class="group relative flex flex-col items-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-slate-200 dark:border-slate-700 transition-all duration-300"
          >
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300"
            >
              <span
                aria-hidden="true"
                class="material-symbols-outlined text-[32px]"
                >{{ feature.icon }}</span
              >
            </div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
              {{ feature.title }}
            </h3>
            <p class="text-center text-slate-600 dark:text-slate-400">
              {{ feature.desc }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Why Choose Us Section -->
    <section id="features" class="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          class="mx-auto grid max-w-2xl grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4 text-center lg:text-left"
        >
          <div
            v-for="item in whyItems"
            :key="item.title"
            class="flex flex-col items-center lg:items-start"
          >
            <div
              class="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white"
            >
              <span aria-hidden="true" class="material-symbols-outlined">{{
                item.icon
              }}</span>
            </div>
            <h3
              class="text-lg font-bold leading-8 text-slate-900 dark:text-white"
            >
              {{ item.title }}
            </h3>
            <p
              class="mt-2 text-base leading-7 text-slate-600 dark:text-slate-400"
            >
              {{ item.desc }}
            </p>
          </div>
        </div>
      </div>
    </section>



    <!-- FAQ Section -->
    <section class="pt-6 pb-12 sm:py-24 bg-white dark:bg-slate-900">
      <ToolFaq i18n-prefix="home.faq" :count="7" />
    </section>

  </div>
</template>
