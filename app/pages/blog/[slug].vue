<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { computed } from "vue";
const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const slug = route.params.slug as string;

// ── Fetch current post from @nuxt/content ──
const { data: post } = await useAsyncData(`blog-${slug}-${locale.value}`, () =>
  queryCollection("blog")
    .where("stem", "LIKE", `blog/${locale.value}/${slug}`)
    .first(),
);

// ── Fetch recommended posts (other articles, same locale) ──
const { data: recommendedPosts } = await useAsyncData(
  `blog-recommended-${locale.value}`,
  () =>
    queryCollection("blog")
      .where("stem", "LIKE", `blog/${locale.value}/%`)
      .order("date", "DESC")
      .limit(4)
      .all(),
);

const filteredRecommended = computed(() => {
  const posts = recommendedPosts.value || [];
  return posts.filter((p: any) => getSlug(p) !== slug).slice(0, 3);
});

// ── SEO ──
useHead({
  title: () => post.value?.title || "",
  meta: [
    { name: "description", content: () => post.value?.description || "" },
    { property: "og:title", content: () => post.value?.title || "" },
    {
      property: "og:description",
      content: () => post.value?.description || "",
    },
    { property: "og:type", content: "article" },
  ],
});

// Derive slug from stem
function getSlug(p: any) {
  const parts = (p.stem || p.path || "").split("/");
  return parts[parts.length - 1] || "";
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

// ── Dynamic TOC from content headings ──
const toc = computed(() => {
  if (!post.value?.body?.toc?.links) return [];
  return post.value.body.toc.links;
});
</script>

<template>
  <div>
    <main v-if="post" class="py-12 md:py-20">
      <!-- ── Article Hero Section ── -->
      <article class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto text-center mb-8 md:mb-12">
          <div
            class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase mb-4 md:mb-6"
          >
            {{ getCategoryLabel(post.category) }}
          </div>
          <h1
            class="text-3xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-[1.1] md:leading-[1.1] tracking-tight mb-6 md:mb-8"
          >
            {{ post.title }}
          </h1>
          <div
            class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-slate-600 dark:text-slate-400"
          >
            <div class="flex items-center gap-3">
              <div
                class="h-12 w-12 sm:h-10 sm:w-10 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 sm:border-0 bg-primary/10 text-primary font-bold flex items-center justify-center text-sm"
              >
                {{ getAuthorInitials(post.author) }}
              </div>
              <div class="text-sm sm:text-base text-left sm:text-center">
                <p
                  class="font-bold sm:font-semibold text-slate-900 dark:text-slate-200"
                >
                  {{ post.author }}
                </p>
                <p class="text-slate-500 sm:hidden">
                  {{ post.date }} •
                  {{ t("blog.minRead", { min: post.readTime }) }}
                </p>
              </div>
            </div>
            <!-- Desktop only date/time row -->
            <span class="hidden sm:block text-slate-300 dark:text-slate-700"
              >•</span
            >
            <div class="hidden sm:flex items-center gap-2">
              <span class="material-symbols-outlined text-lg"
                >calendar_today</span
              >
              <span>{{ post.date }}</span>
            </div>
            <span class="hidden sm:block text-slate-300 dark:text-slate-700"
              >•</span
            >
            <div class="hidden sm:flex items-center gap-2">
              <span class="material-symbols-outlined text-lg">schedule</span>
              <span>{{ t("blog.minRead", { min: post.readTime }) }}</span>
            </div>
          </div>
        </div>

        <!-- ── Cover Image ── -->
        <div class="max-w-5xl mx-auto mb-8 sm:mb-16">
          <div
            class="aspect-video w-full overflow-hidden rounded-2xl shadow-xl sm:shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <img
              :alt="post.title"
              class="w-full h-full object-cover"
              :src="post.cover"
            />
          </div>
        </div>

        <!-- ── Mobile: Table of Contents Accordion ── -->
        <section v-if="toc.length" class="mb-8 lg:hidden">
          <details
            class="group bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800"
          >
            <summary
              class="flex items-center justify-between p-4 cursor-pointer list-none font-bold text-slate-900 dark:text-white"
            >
              <span>{{ t("blog.detail.onThisPage") }}</span>
              <span
                class="material-symbols-outlined transition-transform group-open:rotate-180"
                >expand_more</span
              >
            </summary>
            <nav class="p-4 pt-0">
              <ul class="space-y-3 text-sm font-medium">
                <li v-for="link in toc" :key="link.id">
                  <a
                    class="text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary pl-3 block"
                    :href="`#${link.id}`"
                    >{{ link.text }}</a
                  >
                </li>
              </ul>
            </nav>
          </details>
        </section>

        <!-- ── Content Layout with Sidebar ── -->
        <div
          class="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-10"
        >
          <!-- Main Content Body -->
          <div class="flex-1 min-w-0 mx-auto lg:mx-0 w-full">
            <div
              class="prose prose-slate dark:prose-invert max-w-none custom-prose"
            >
              <ContentRenderer :value="post" />
            </div>

            <!-- ── Mobile: Inline CTA (hidden lg) ── -->
            <section
              class="my-10 bg-slate-900 rounded-2xl p-6 text-center text-white lg:hidden"
            >
              <h3 class="text-white text-xl font-bold mb-2">
                {{ t("blog.detail.ctaTitle") }}
              </h3>
              <p class="text-slate-400 text-sm mb-6">
                {{ t("blog.detail.ctaDesc") }}
              </p>
              <NuxtLink
                :to="localePath('/compress-image')"
                class="w-full inline-block bg-primary hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {{ t("blog.detail.compressNow") }}
              </NuxtLink>
            </section>

            <!-- ── Social Share ── -->
            <div
              class="border-y border-slate-200 dark:border-slate-800 py-8 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6"
            >
              <span
                class="text-sm sm:text-base font-bold text-slate-900 dark:text-white"
                >{{ t("blog.detail.share") }}</span
              >
              <div class="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded-xl transition-all text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span class="material-symbols-outlined text-base sm:text-lg"
                    >share</span
                  >
                  Twitter
                </button>
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded-xl transition-all text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span class="material-symbols-outlined text-base sm:text-lg"
                    >group</span
                  >
                  LinkedIn
                </button>
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded-xl transition-all text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span class="material-symbols-outlined text-base sm:text-lg"
                    >link</span
                  >
                  {{ t("blog.detail.copyLink") }}
                </button>
              </div>
            </div>
          </div>

          <!-- ── Desktop: Sticky Sidebar TOC ── -->
          <aside class="hidden lg:block w-56 shrink-0">
            <div class="sticky top-24">
              <h4
                v-if="toc.length"
                class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6"
              >
                {{ t("blog.detail.onThisPage") }}
              </h4>
              <nav v-if="toc.length" class="space-y-4">
                <a
                  v-for="link in toc"
                  :key="link.id"
                  class="block text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border-l-2 border-transparent pl-4"
                  :href="`#${link.id}`"
                  >{{ link.text }}</a
                >
              </nav>

              <!-- Desktop CTA -->
              <div
                class="mt-12 p-6 bg-primary/5 rounded-2xl border border-primary/10"
              >
                <h5
                  class="text-sm font-bold text-slate-900 dark:text-white mb-2"
                >
                  {{ t("blog.detail.ctaTitle") }}
                </h5>
                <p
                  class="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed"
                >
                  {{ t("blog.detail.ctaDesc") }}
                </p>
                <NuxtLink
                  :to="localePath('/compress-image')"
                  class="w-full inline-block text-center py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
                >
                  {{ t("blog.detail.compressNow") }}
                </NuxtLink>
              </div>
            </div>
          </aside>
        </div>
      </article>

      <!-- ── More Articles (Recommended) ── -->
      <section
        v-if="filteredRecommended.length"
        class="bg-slate-50 dark:bg-slate-900/30 py-16 sm:py-20 mt-16 sm:mt-20"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-end justify-between mb-8 sm:mb-12">
            <div>
              <h2
                class="text-2xl sm:text-3xl font-extrabold sm:font-bold text-slate-900 dark:text-white mb-1 sm:mb-2"
              >
                {{ t("blog.detail.moreArticles") }}
              </h2>
              <p
                class="text-sm sm:text-base text-slate-500 sm:text-slate-600 dark:text-slate-400"
              >
                {{ t("blog.detail.moreArticlesDesc") }}
              </p>
            </div>
            <NuxtLink
              :to="localePath('/blog')"
              class="hidden sm:flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
            >
              {{ t("blog.detail.viewAll") }}
              <span class="material-symbols-outlined text-base"
                >arrow_forward</span
              >
            </NuxtLink>
            <NuxtLink
              :to="localePath('/blog')"
              class="sm:hidden text-primary text-sm font-bold flex items-center"
            >
              {{ t("blog.detail.viewAll") }}
              <span class="material-symbols-outlined text-sm ml-1"
                >arrow_forward_ios</span
              >
            </NuxtLink>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <article
              v-for="rpost in filteredRecommended"
              :key="getSlug(rpost)"
              class="bg-white dark:bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-100 sm:border-slate-200 dark:border-slate-800 shadow-sm sm:shadow-none group cursor-pointer"
            >
              <NuxtLink :to="localePath(`/blog/${getSlug(rpost)}`)">
                <div class="aspect-video overflow-hidden">
                  <img
                    :alt="rpost.title"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    :src="rpost.cover"
                  />
                </div>
                <div class="p-5 sm:p-6 flex flex-col h-[calc(100%-auto)]">
                  <div
                    class="flex items-center gap-2 mb-2 sm:mb-3 text-[10px] font-bold sm:font-extrabold uppercase tracking-wider"
                  >
                    <span class="text-primary">{{
                      getCategoryLabel(rpost.category)
                    }}</span>
                    <span class="text-slate-300 dark:text-slate-600">•</span>
                    <span class="text-slate-500">{{
                      t("blog.minRead", { min: rpost.readTime })
                    }}</span>
                  </div>
                  <h3
                    class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight sm:leading-normal mb-4 group-hover:text-primary transition-colors line-clamp-2"
                  >
                    {{ rpost.title }}
                  </h3>
                  <div class="flex items-center gap-2 sm:gap-3 mt-auto pt-2">
                    <div
                      class="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300"
                    >
                      {{ getAuthorInitials(rpost.author) }}
                    </div>
                    <span
                      class="text-xs font-medium text-slate-600 dark:text-slate-400"
                      >{{ rpost.author }}</span
                    >
                  </div>
                </div>
              </NuxtLink>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   Blog Article – Professional Prose Typography
   Optimized for CJK + Latin mixed content
   ══════════════════════════════════════════════ */

/* ── Base text ── */
.custom-prose {
  line-height: 1.85;
  color: #334155; /* slate-700 */
}
.dark .custom-prose {
  color: #cbd5e1; /* slate-300 */
}

/* ── Headings: dark neutral color, NOT blue ── */
.custom-prose :deep(h2) {
  font-size: 1.375rem;
  font-weight: 700;
  color: #0f172a; /* slate-900 */
  margin-top: 1.75rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #e2e8f0; /* slate-200 */
  letter-spacing: -0.01em;
}
.dark .custom-prose :deep(h2) {
  color: #f1f5f9;
  border-bottom-color: #334155;
}

.custom-prose :deep(h3) {
  font-size: 1.15rem;
  font-weight: 600;
  color: #1e293b; /* slate-800 */
  margin-top: 1.5rem;
  margin-bottom: 0.4rem;
}
.dark .custom-prose :deep(h3) {
  color: #e2e8f0;
}

.custom-prose :deep(h4) {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin-top: 1.25rem;
  margin-bottom: 0.3rem;
}
.dark .custom-prose :deep(h4) {
  color: #cbd5e1;
}

/* ── Paragraph spacing ── */
.custom-prose :deep(p) {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

/* ── Links: subtle, don't overwhelm ── */
.custom-prose :deep(a) {
  color: theme("colors.primary.DEFAULT");
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}
.custom-prose :deep(a:hover) {
  color: theme("colors.primary.dark");
}
.dark .custom-prose :deep(a) {
  color: theme("colors.primary.light");
}
.dark .custom-prose :deep(a:hover) {
  color: theme("colors.primary.100");
}

/* ── Heading anchors: inherit heading color, not link blue ── */
.custom-prose :deep(h2 a),
.custom-prose :deep(h3 a),
.custom-prose :deep(h4 a) {
  color: inherit;
  font-weight: inherit;
}
.custom-prose :deep(h2 a:hover),
.custom-prose :deep(h3 a:hover),
.custom-prose :deep(h4 a:hover) {
  color: inherit;
}

/* ── Lists ── */
.custom-prose :deep(ul) {
  padding-left: 1.5em;
  margin-top: 1em;
  margin-bottom: 1em;
}
.custom-prose :deep(ul > li) {
  padding-left: 0.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.custom-prose :deep(ol) {
  padding-left: 1.5em;
  margin-top: 1em;
  margin-bottom: 1em;
}
.custom-prose :deep(ol > li) {
  padding-left: 0.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.custom-prose :deep(li strong) {
  color: #1e293b;
}
.dark .custom-prose :deep(li strong) {
  color: #f1f5f9;
}

/* ── Blockquote ── */
.custom-prose :deep(blockquote) {
  border-left: 4px solid theme("colors.primary.DEFAULT");
  padding: 0.75rem 1.25rem;
  margin: 1.5rem 0;
  background-color: #f8fafc;
  border-radius: 0 0.5rem 0.5rem 0;
  font-style: italic;
  color: #475569;
}
.dark .custom-prose :deep(blockquote) {
  background-color: rgba(30, 41, 59, 0.5);
  color: #94a3b8;
}

/* ── Images ── */
.custom-prose :deep(img) {
  display: block;
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  margin: 1.5rem 0;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.dark .custom-prose :deep(img) {
  border-color: #334155;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* ── Table ── */
.custom-prose :deep(table) {
  font-size: 0.875rem;
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}
.custom-prose :deep(th) {
  text-align: left;
  font-weight: 600;
  color: #0f172a;
  background-color: #f1f5f9;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid #e2e8f0;
}
.dark .custom-prose :deep(th) {
  color: #f1f5f9;
  background-color: #1e293b;
  border-bottom-color: #475569;
}
.custom-prose :deep(td) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}
.dark .custom-prose :deep(td) {
  border-bottom-color: #334155;
}
.custom-prose :deep(tr:last-child td) {
  border-bottom: none;
}

/* ── Inline code ── */
.custom-prose :deep(:not(pre) > code) {
  background-color: #f1f5f9;
  padding: 0.2em 0.45em;
  border-radius: 0.3rem;
  font-size: 0.875em;
  font-weight: 500;
  color: #0f172a;
}
.dark .custom-prose :deep(:not(pre) > code) {
  background-color: #1e293b;
  color: #e2e8f0;
}

/* ── Code blocks ── */
.custom-prose :deep(pre) {
  border-radius: 0.75rem;
  margin: 1.5rem 0;
}

/* ── Strong / bold ── */
.custom-prose :deep(strong) {
  color: #0f172a;
  font-weight: 600;
}
.dark .custom-prose :deep(strong) {
  color: #f1f5f9;
}

/* ── Horizontal rule ── */
.custom-prose :deep(hr) {
  border-color: #e2e8f0;
  margin: 2.5rem 0;
}
.dark .custom-prose :deep(hr) {
  border-color: #334155;
}
</style>
