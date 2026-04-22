// ────────────────────────────────────────────────────────
// MVP 轻量 RAG 替代：本地结构化场景知识库
// 按场景标签组织知识片段，根据用户目标关键词匹配检索
// 后续可升级为 pgvector + embedding 检索
// ────────────────────────────────────────────────────────

export interface RetrievedKnowledge {
  id: string;
  scene: string;
  source: string;
  title: string;
  content: string;
}

// 场景知识库：每条是一个针对特定平台/场景的图片处理最佳实践
const KNOWLEDGE_BASE: RetrievedKnowledge[] = [
  {
    id: "shopify-product-images",
    scene: "shopify",
    source: "shopify-docs",
    title: "Shopify Product Image Guidelines",
    content: `Shopify recommends:
- Square images (1:1 aspect ratio) for product listings
- Minimum 2048x2048 pixels for zoom functionality
- WebP format for optimal loading speed (JPEG as fallback)
- File size under 500KB per image for fast page loads
- Consistent white or neutral backgrounds
- Alt text for SEO and accessibility
- Filename should include product name and variant`,
  },
  {
    id: "amazon-listing-images",
    scene: "amazon",
    source: "amazon-seller-central",
    title: "Amazon Product Image Requirements",
    content: `Amazon requires:
- Main image: pure white background (RGB 255,255,255), product fills 85% of frame
- Minimum 1000px on longest side for zoom (recommended 2000px)
- JPEG format preferred (.jpg or .jpeg)
- Maximum 10MB per image
- No watermarks, logos, or text overlays on main image
- Up to 9 images: 1 main + 8 supplementary
- Supplementary images can show lifestyle, dimensions, packaging`,
  },
  {
    id: "blog-image-performance",
    scene: "blog",
    source: "web-performance-guides",
    title: "Blog Image Performance Best Practices",
    content: `For blog and content sites:
- Target file size: 100-300KB per image
- WebP format saves 25-35% over JPEG at equivalent quality
- Width should match content column (typically 800-1200px)
- Use quality 75-85 for JPEG/WebP to balance size and clarity
- Strip EXIF/GPS metadata to reduce size and protect privacy
- Lazy loading for below-the-fold images
- Include descriptive alt text for SEO`,
  },
  {
    id: "seo-image-metadata",
    scene: "seo",
    source: "google-seo-guidelines",
    title: "SEO Image Optimization",
    content: `For search engine optimization:
- Use descriptive, keyword-rich filenames (e.g., "blue-running-shoes.webp")
- Alt text should describe image content naturally, include target keywords
- Keep file sizes small for Core Web Vitals (LCP optimization)
- Use modern formats (WebP, AVIF) with JPEG fallback
- Provide image dimensions in HTML to prevent layout shift
- Submit image sitemap for better indexing
- Strip unnecessary metadata to reduce file size`,
  },
  {
    id: "general-web-optimization",
    scene: "general",
    source: "web-dev-best-practices",
    title: "General Web Image Optimization",
    content: `General best practices:
- WebP is the best balance of quality and compression for most web use
- AVIF offers better compression but has limited browser support
- Quality 80-85 is the sweet spot for most images
- Always strip metadata for web delivery
- Resize to actual display dimensions, not larger
- Use progressive JPEG for large images
- Consider transparency needs: PNG/WebP for alpha, JPEG for photos`,
  },
];

// 场景关键词映射表：用于将用户目标中的关键词路由到对应的场景知识
const SCENE_KEYWORDS: Record<string, string[]> = {
  shopify: [
    "shopify",
    "商品",
    "product page",
    "store",
    "店铺",
    "电商",
    "ecommerce",
  ],
  amazon: ["amazon", "亚马逊", "listing", "fba", "商品图", "主图", "辅图"],
  blog: ["blog", "博客", "文章", "post", "content", "配图", "article"],
  seo: ["seo", "搜索", "search", "alt text", "元数据", "metadata", "indexing"],
  general: [
    "general",
    "web",
    "网站",
    "优化",
    "optimize",
    "compress",
    "压缩",
    "convert",
    "转换",
  ],
};

/**
 * 根据用户目标文本检索相关的场景知识
 * MVP 方案：关键词匹配 + 去重，命中的场景知识按相关度排序
 *
 * @param goalText 用户输入的自然语言目标
 * @param maxResults 最大返回条数，默认 3
 * @returns 匹配的知识片段列表
 */
export function retrieveKnowledge(
  goalText: string,
  maxResults = 3,
): RetrievedKnowledge[] {
  const lowerGoal = goalText.toLowerCase();
  const matchedScenes = new Set<string>();

  // 遍历关键词映射表，找出所有命中的场景
  for (const [scene, keywords] of Object.entries(SCENE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerGoal.includes(keyword.toLowerCase())) {
        matchedScenes.add(scene);
        break;
      }
    }
  }

  // 如果没有任何场景命中，返回通用知识
  if (matchedScenes.size === 0) {
    matchedScenes.add("general");
  }

  // 从知识库中筛选命中场景的知识片段
  const results = KNOWLEDGE_BASE.filter((k) => matchedScenes.has(k.scene));

  return results.slice(0, maxResults);
}
