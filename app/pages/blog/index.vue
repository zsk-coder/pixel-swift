<script setup lang="ts">
const { t, locale } = useI18n();
const localePath = useLocalePath();

const siteUrl = useRuntimeConfig().public.siteUrl;
const blogUrl = computed(() => {
  const prefix = locale.value === "en" ? "" : `/${locale.value}`;
  return `${siteUrl}${prefix}/blog`;
});

// ── SEO ──
useHead({
  title: t("seo.blog.title"),
  meta: [
    { name: "description", content: t("seo.blog.description") },
    // Open Graph
    { property: "og:title", content: t("seo.blog.title") },
    { property: "og:description", content: t("seo.blog.description") },
    { property: "og:type", content: "website" },
    { property: "og:url", content: () => blogUrl.value },
    {
      property: "og:image",
      content: `${siteUrl}/images/blog/og-default.png`,
    },
    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: t("seo.blog.title") },
    { name: "twitter:description", content: t("seo.blog.description") },
    {
      name: "twitter:image",
      content: `${siteUrl}/images/blog/og-default.png`,
    },
  ],
});

useSchemaOrg([
  defineWebPage({ "@type": "CollectionPage" }),
  {
    "@type": "Blog",
    name: "PixelSwift Blog",
    description: t("seo.blog.description"),
  },
]);

// ── Real content from @nuxt/content ──
const { data: allPosts } = await useAsyncData(
  `blog-list-${locale.value}`,
  () =>
    queryCollection("blog")
      .where("stem", "LIKE", `blog/${locale.value}/%`)
      .order("date", "DESC")
      .all(),
  { watch: [locale] },
);

// Derive slug from stem (e.g. "blog/en/tinypng-alternative-privacy" → "tinypng-alternative-privacy")
function getSlug(post: any) {
  const parts = (post.stem || post.path || "").split("/");
  return parts[parts.length - 1] || "";
}

// ── Category filter ──
// Dynamic categories based on actual posts
const categories = computed(() => {
  const posts = allPosts.value || [];
  const usedCategories = [
    ...new Set(posts.map((p: any) => p.category).filter(Boolean)),
  ];
  return ["allCategories", ...usedCategories];
});

const activeCategory = ref("allCategories");

const filteredPosts = computed(() => {
  const posts = allPosts.value || [];
  if (activeCategory.value === "allCategories") return posts;
  return posts.filter((p: any) => p.category === activeCategory.value);
});

// ── Pagination ──
const currentPage = ref(1);
const totalPages = computed(() =>
  Math.max(1, Math.ceil((filteredPosts.value?.length || 0) / 6)),
);

// ── Mobile infinite scroll ──
const isMobile = ref(false);
const loadMoreRef = ref<HTMLElement | null>(null);
const isLoadingMore = ref(false);
const hasMore = ref(true);

function loadMore() {
  // No-op for now — all posts are loaded at once
}

function getCategoryLabel(key: string) {
  if (key === "allCategories") return t("blog.allCategories");
  return t(`blog.categories.${key}`);
}

function getAuthorInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
</script>

<template>
  <div>
    <!-- ═══ HERO SECTION ═══ -->
    <section class="hero-section relative overflow-hidden">
      <!-- Decorative gradient blobs (matching design: blob class) -->
      <div class="blob -top-20 -left-20"></div>
      <div
        class="blob -bottom-20 -right-20"
        style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)"
      ></div>
      <div class="max-w-7xl mx-auto px-4 text-center">
        <h1
          class="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4"
        >
          {{ t("blog.title") }}
        </h1>
        <p class="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {{ t("blog.subtitle") }}
        </p>
      </div>
    </section>

    <!-- ═══ MAIN CONTENT ═══ -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">


      <!-- ── Category Filter Pills ── -->
      <!-- Matching design: no border on inactive pills -->
      <div
        v-if="categories.length > 4"
        class="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-4 pb-2"
      >
        <button
          v-for="cat in categories"
          :key="cat"
          class="px-5 py-2 rounded-full text-sm font-medium shrink-0 transition-colors"
          :class="[
            activeCategory === cat
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
          ]"
          @click="activeCategory = cat"
        >
          {{ getCategoryLabel(cat) }}
        </button>
      </div>

      <!-- ── Article Grid ── -->
      <!-- Matching design: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <article
          v-for="post in filteredPosts"
          :key="post.path || post.id"
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
        >
          <NuxtLink
            :to="localePath(`/blog/${getSlug(post)}`)"
            class="block"
            :aria-label="post.title"
          >
            <!-- Card Image: fixed 140px on mobile, aspect-video on desktop -->
            <div class="card-image overflow-hidden">
              <img
                :alt="post.title"
                :src="post.cover"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <!-- Card Content -->
            <div class="card-content flex flex-col">
              <h3
                class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight line-clamp-2"
              >
                {{ post.title }}
              </h3>
              <p
                class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed truncate sm:line-clamp-2 sm:whitespace-normal"
              >
                {{ post.description }}
              </p>
              <div
                class="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800"
              >
                <span class="text-slate-500 text-xs font-medium">
                  {{ post.date }}
                </span>
              </div>
            </div>
          </NuxtLink>
        </article>
      </div>

      <!-- ── Mobile: Infinite scroll sentinel ── -->
      <div ref="loadMoreRef" class="sm:hidden py-6 flex justify-center">
        <span v-if="isLoadingMore" class="text-sm text-slate-400">{{
          t("blog.loading") || "Loading..."
        }}</span>
        <span v-else-if="!hasMore" class="text-sm text-slate-400">{{
          t("blog.noMore") || "No more articles"
        }}</span>
      </div>

      <!-- ── Desktop: Pagination (Element Plus) ── -->
      <div class="mt-12 hidden sm:flex justify-center">
        <ElPagination
          v-model:current-page="currentPage"
          :page-size="6"
          :total="totalPages * 6"
          background
          layout="prev, pager, next"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Decorative blobs (matching design exactly) ── */
.blob {
  position: absolute;
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);
  filter: blur(80px);
  opacity: 0.2;
  z-index: -1;
  border-radius: 50%;
}

/* ── Hide scrollbar for category filters ── */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ── Hero section ── */
.hero-section {
  padding-top: 2.5rem;
  padding-bottom: 2rem;
}

@media (min-width: 640px) {
  .hero-section {
    padding-top: 4rem;
    padding-bottom: 3rem;
  }
}



/* ── Article card image: 140px fixed on mobile, aspect-video on sm+ ── */
.card-image {
  height: 140px;
}

@media (min-width: 640px) {
  .card-image {
    height: auto;
    aspect-ratio: 16 / 9;
  }
}

/* ── Article card content: compact on mobile, spacious on sm+ ── */
.card-content {
  padding: 1.25rem;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .card-content {
    padding: 1.5rem;
    gap: 0.5rem;
  }
}
</style>
