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
  // Only exclude featured post from grid when featured section is visible
  const basePosts = showFeatured.value
    ? posts.filter((p: any) => !p.featured)
    : posts;
  if (activeCategory.value === "allCategories") return basePosts;
  return basePosts.filter((p: any) => p.category === activeCategory.value);
});

// ── Featured post ──
const featuredPost = computed(() => {
  const posts = allPosts.value || [];
  return posts.find((p: any) => p.featured) || null;
});

// Only show featured section when there are enough articles (>= 6)
const showFeatured = computed(() => {
  const posts = allPosts.value || [];
  return !!featuredPost.value && posts.length >= 6;
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
      <!-- ── Featured Article ── -->
      <!-- Exactly matching design: flex flex-col lg:flex-row, min-h-[400px] -->
      <article
        v-if="showFeatured"
        class="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm mb-4 featured-card group transition-all hover:shadow-lg"
      >
        <!-- Image with FEATURED badge overlay on mobile -->
        <div class="featured-card__image overflow-hidden relative">
          <img
            :alt="featuredPost.title"
            :src="featuredPost.cover"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <!-- Badge overlay on image (mobile only) -->
          <span
            class="featured-badge-overlay absolute top-3 left-3 bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider uppercase shadow-sm"
          >
            {{ t("blog.featured") }}
          </span>
        </div>
        <!-- Content -->
        <div class="featured-card__content flex flex-col">
          <!-- Desktop-only badge (hidden on mobile since it's on the image) -->
          <span
            class="featured-badge hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold bg-primary text-white mb-4 uppercase tracking-wider shadow-sm"
          >
            {{ t("blog.featured") }}
          </span>

          <h2
            class="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors"
          >
            {{ featuredPost.title }}
          </h2>
          <p
            class="text-slate-600 dark:text-slate-300 line-clamp-2 sm:line-clamp-3 text-sm sm:text-lg leading-relaxed"
          >
            {{ featuredPost.description }}
          </p>
          <!-- Author row: hidden on mobile per mobile design -->
          <div class="hidden sm:flex items-center gap-4 mt-8 mb-8">
            <div
              class="w-12 h-12 rounded-full overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center ring-2 ring-white dark:ring-slate-800 shadow-sm"
            >
              <img
                src="/images/logo.png"
                alt="PixelSwift"
                class="w-full h-full object-cover"
              />
            </div>
            <div>
              <p class="text-base font-semibold text-slate-900 dark:text-white">
                {{ featuredPost.author }}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ featuredPost.date }}
              </p>
            </div>
          </div>
          <!-- CTA: mt-2 pt-4 border-t on mobile matching design, inline on desktop -->
          <div
            class="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 sm:border-0 sm:mt-0 sm:pt-0"
          >
            <NuxtLink
              :to="localePath(`/blog/${getSlug(featuredPost)}`)"
              class="inline-flex items-center text-primary font-bold text-sm sm:font-semibold sm:text-lg hover:gap-2 transition-all"
              :aria-label="t('blog.readMore') + ': ' + featuredPost.title"
            >
              {{ t("blog.readMore") }}
              <span
                class="material-symbols-outlined ml-1 text-[18px] sm:text-xl"
                aria-hidden="true"
                >arrow_forward</span
              >
            </NuxtLink>
          </div>
        </div>
      </article>

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
          :key="post.slug"
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

/* ── Featured card layout ── */
.featured-card {
  display: flex;
  flex-direction: column;
}
.featured-card__image {
  aspect-ratio: 16 / 9;
  max-height: 200px;
}
.featured-card__content {
  padding: 1.25rem;
  gap: 0.5rem;
}
/* Hide overlay badge on desktop, show inline badge instead */
.featured-badge-overlay {
  display: block;
}

@media (min-width: 640px) {
  .featured-badge-overlay {
    display: none;
  }
}

@media (min-width: 1024px) {
  .featured-card {
    flex-direction: row;
    min-height: 400px;
  }
  .featured-card__image {
    width: 50%;
    aspect-ratio: auto;
    max-height: none;
  }
  .featured-card__content {
    width: 50%;
    padding: 3rem 2.5rem;
    gap: 0;
    justify-content: center;
  }
}

/* ── Most Popular grid (3 columns on md+) ── */
.popular-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .popular-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ── Featured badge (force fit-content width) ── */
.featured-badge {
  width: fit-content;
  align-self: flex-start;
}

/* ── Popular post thumbnails (fixed 96px square to prevent large images from expanding) ── */
.popular-thumb {
  width: 96px;
  height: 96px;
  min-width: 96px;
  min-height: 96px;
  flex-shrink: 0;
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
