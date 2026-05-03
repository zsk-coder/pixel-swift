/**
 * useSeoRobots — SEO 止血：对低价值页面自动注入 noindex
 *
 * 为什么需要这个 composable？
 * PixelSwift 有 8 个语言版本，但小语种的工具页（converter、compress-image、resize-image）
 * 没有深度内容支撑，仅仅是 UI 文案的翻译变体。Google 将它们判定为"薄内容(Thin Content)"，
 * 并因此拉低了整个域名的质量评分，导致连主语言的页面也被从索引中剔除。
 *
 * 策略：
 * 1. 小语种（非 en/zh）的工具页 → noindex, follow（保留链接权重传递，但告诉 Google 别索引）
 * 2. 所有语种的功能页（login、auth/callback）→ 永远 noindex, nofollow（这些页面没有任何 SEO 价值）
 * 3. en/zh 的工具页和博客页 → 不做干预，正常索引
 *
 * 限制：如果未来小语种工具页补充了深度内容（如长尾FAQ、AI 案例库），
 *       需要从 NOINDEX_MINOR_TOOL_PATHS 中移除对应路径，重新开放索引。
 */
export function useSeoRobots() {
  const route = useRoute();
  const { locale } = useI18n();

  // ── 永远不应被索引的路径模式（所有语言生效） ──
  // 登录页、OAuth 回调页等功能性页面，爬虫进来也没意义
  const ALWAYS_NOINDEX_PATTERNS = [
    '/login',
    '/auth/callback',
  ];

  // ── 小语种工具页路径（仅对非 en/zh 的语言生效） ──
  // 这些页面在小语种下只有翻译文案，缺乏实质性内容
  const MINOR_LOCALE_NOINDEX_PATTERNS = [
    '/converter',
    '/compress-image',
    '/resize-image',
    '/ai-workflow',
    '/ai-workflow/demo',
    '/pricing',
    '/contact',
    '/privacy',
    '/terms',
    '/refund',
  ];

  // 主语言列表：英文和中文有足够的内容支撑，保留正常索引
  const PRIMARY_LOCALES = ['en', 'zh'];

  useHead(() => {
    const currentLocale = locale.value;
    const path = route.path;

    // ── 判定 1：是否是永远 noindex 的功能页 ──
    const isAlwaysNoindex = ALWAYS_NOINDEX_PATTERNS.some(pattern =>
      path.endsWith(pattern) || path.includes(pattern + '?')
    );
    if (isAlwaysNoindex) {
      return {
        meta: [
          { name: 'robots', content: 'noindex, nofollow' },
        ],
      };
    }

    // ── 判定 2：是否是小语种的工具/辅助页面 ──
    if (!PRIMARY_LOCALES.includes(currentLocale)) {
      // 提取当前路径中去掉语言前缀后的纯路径部分
      // 例如 /ko/converter → /converter，/es/compress-image → /compress-image
      const pathWithoutLocale = path.replace(new RegExp(`^/${currentLocale}`), '') || '/';

      const isMinorToolPage = MINOR_LOCALE_NOINDEX_PATTERNS.some(pattern =>
        pathWithoutLocale === pattern
      );

      if (isMinorToolPage) {
        return {
          meta: [
            // 使用 noindex + follow：不索引页面但保留链接的权重传递
            // 这样小语种页面上的内链（比如指向博客的链接）仍然能传递 PageRank
            { name: 'robots', content: 'noindex, follow' },
          ],
        };
      }
    }

    // 主语言页面和博客页面不做任何干预
    return {};
  });
}
