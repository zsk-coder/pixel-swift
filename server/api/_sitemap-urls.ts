export default defineSitemapEventHandler(async (e) => {
  try {
    // 1. 获取所有的 blog 内容记录
    const posts = await queryCollection(e, "blog").all();

    // 2. 映射成符合多语言前缀结构的合法 URL
    const urls = posts
      .map((post) => {
        // stem: 'blog/es/bypass-tinypng-limits' 或者 'blog/zh/avif-vs-webp-vs-jpeg' 等
        const stemParts = post.stem?.split("/") || [];
        if (stemParts.length >= 3) {
          const locale = stemParts[1];
          const slug = stemParts.slice(2).join("/");

          // 根据 nuxt.config.ts 的配置 (prefix_except_default), "en" 是 defaultLocale
          // 默认语言没前缀，别的语言带 /[locale]/
          const isDefault = locale === "en";
          const loc = isDefault ? `/blog/${slug}` : `/${locale}/blog/${slug}`;

          return {
            loc,
            lastmod: post.date, // 提取 blog 的日期或更新时间提供给搜索引擎
            changefreq: "weekly",
            priority: locale === "en" ? 0.8 : 0.6, // 给英文主内容略高的权重
          };
        }
        return null;
      })
      .filter(Boolean) as any[];

    return urls;
  } catch (err) {
    console.error("生成 sitemap 出错", err);
    return [];
  }
});
