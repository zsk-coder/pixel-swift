// https://nuxt.com/docs/api/configuration/nuxt-config
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },

  // ── Cloudflare Pages 部署 ──
  nitro: {
    preset: "cloudflare-pages",
  },

  // ── 站点 URL（sitemap 和 SEO 需要） ──
  site: {
    url: "https://pixelswift.site",
  },

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/i18n",
    "@nuxtjs/sitemap",
    "@nuxtjs/color-mode",
    "nuxt-schema-org",
    "@element-plus/nuxt",
    "nuxt-gtag",
  ],

  // ── Components (disable path prefix) ──
  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  // ── TailwindCSS ──
  tailwindcss: {
    cssPath: "~/assets/scss/main.scss",
  },

  // ── i18n ──
  i18n: {
    baseUrl: "https://pixelswift.site",
    locales: [
      { code: "en", language: "en-US", file: "en.json", name: "English" },
      { code: "zh", language: "zh-CN", file: "zh.json", name: "简体中文" },
      { code: "es", language: "es-ES", file: "es.json", name: "Español" },
      { code: "ja", language: "ja-JP", file: "ja.json", name: "日本語" },
      { code: "de", language: "de-DE", file: "de.json", name: "Deutsch" },
      { code: "fr", language: "fr-FR", file: "fr.json", name: "Français" },
      { code: "pt", language: "pt-BR", file: "pt.json", name: "Português" },
      { code: "ko", language: "ko-KR", file: "ko.json", name: "한국어" },
    ],
    langDir: "../locales",
    defaultLocale: "en",
    strategy: "prefix_except_default",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_lang",
      redirectOn: "root",
    },
  },

  // ── Color Mode ──
  colorMode: {
    classSuffix: "",
    preference: "system",
    fallback: "light",
  },

  gtag: {
    id: "G-9C80LFFN3X",
    initCommands: [
      // Google Consent Mode v2：默认拒绝，用户同意后由 CookieConsent 组件更新
      [
        "consent",
        "default",
        {
          analytics_storage: "denied",
          wait_for_update: 500,
        },
      ],
    ],
  },

  // ── Element Plus ──
  elementPlus: {
    importStyle: "css",
  },

  // ── Vite (SCSS global injection + WASM support) ──
  vite: {
    plugins: [
      // Enable WebAssembly support for @jsquash/webp (Safari WebP fallback)
      wasm(),
      topLevelAwait(),
    ],
    worker: {
      format: "es" as const,
      plugins: () => [wasm(), topLevelAwait()],
    },
    optimizeDeps: {
      exclude: ["@jsquash/webp", "@jsquash/jpeg", "@jsquash/oxipng"],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "variables" as *;
            @use "mixins" as *;
          `,
          loadPaths: ["./assets/scss"],
        },
      },
    },
  },

  // ── App Meta ──
  app: {
    head: {
      title: "PixelSwift - Free Online Image Tool",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Free online image converter, compressor, and resizer. No upload needed - process images in your browser.",
        },
        { property: "og:site_name", content: "PixelSwift" },
        { property: "og:locale", content: "en_US" },
        // Google网站所有权验证
        {
          name: "google-site-verification",
          content: "kW7iFJUB2r0As4go9uTxiXJDJyU8t9IEThNmw9GqCE8",
        },
      ],

      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        // 主字体：精简权重 + preload 非阻塞加载
        {
          rel: "preload",
          as: "style",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Noto+Sans+SC:wght@400;700&display=swap",
          onload: "this.onload=null;this.rel='stylesheet'",
        },
        // Material Symbols：延迟加载，不阻塞首屏渲染
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,400,0..1&display=swap",
          media: "print",
          onload: "this.media='all'",
        },
      ],
    },
  },

  // ── 性能优化：禁用资源预加载 ──
  experimental: {
    payloadExtraction: false,
  },

  // 移除所有 prefetch/preload 提示，按需加载
  hooks: {
    "build:manifest"(manifest) {
      for (const key in manifest) {
        const file = manifest[key];
        if (file?.prefetch) {
          file.prefetch = false;
        }
        if (file?.preload) {
          file.preload = false;
        }
      }
    },
  },
});
