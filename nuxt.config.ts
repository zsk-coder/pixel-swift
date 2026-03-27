// https://nuxt.com/docs/api/configuration/nuxt-config
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const SITE_URL = "https://pixelswift.site";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  devServer: {
    host: "0.0.0.0",
  },
  // ── Cloudflare Pages 部署 ──
  nitro: {
    preset: "cloudflare-pages",
  },

  // ── 站点 URL（sitemap 和 SEO 需要） ──
  site: {
    url: SITE_URL,
  },

  // ── 公开运行时配置（组件中使用 useRuntimeConfig().public.siteUrl）──
  runtimeConfig: {
    public: {
      siteUrl: SITE_URL,
    },
  },

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/i18n",
    "@nuxtjs/sitemap",
    "@nuxtjs/color-mode",
    "nuxt-schema-org",
    "@element-plus/nuxt",
    "nuxt-gtag",
    "@nuxt/content",
    "@vite-pwa/nuxt",
  ],

  // ── PWA ──
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "PixelSwift - Free Online Image Tool",
      short_name: "PixelSwift",
      description:
        "Free online image converter, compressor, and resizer. No upload needed.",
      theme_color: "#2563eb",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/icons/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icons/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "gstatic-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
          handler: "CacheFirst",
          options: {
            cacheName: "images-cache",
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
  },

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
    baseUrl: SITE_URL,
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
    enabled: process.env.NODE_ENV === "production",
    id: "G-9C80LFFN3X",
  },

  // ── Element Plus ──
  elementPlus: {
    importStyle: "css",
  },

  // ── Vite (SCSS global injection + WASM support) ──
  vite: {
    // 生产构建：移除 console.* 和 debugger（esbuild 内置，无需额外依赖）
    esbuild: {
      drop: ["console", "debugger"],
    },
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
        // Google AdSense 验证
        {
          name: "google-adsense-account",
          content: "ca-pub-7567205058563091",
        },
        // PWA - Apple 支持
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
      ],
      script: [
        {
          src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7567205058563091",
          async: true,
          crossorigin: "anonymous",
        },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "apple-touch-icon",
          sizes: "192x192",
          href: "/icons/pwa-192x192.png",
        },
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
