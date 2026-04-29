import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── 手动加载 .env 文件（独立脚本不经过 Nuxt，无法自动读取） ──
try {
  const envPath = resolve(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env 文件不存在时忽略，依赖系统环境变量
}

import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// ────────────────────────────────────────────────────────
// 知识库灌入脚本（Corrective RAG 数据准备）
//
// 将平台图片处理指南分块 → 向量化 → 写入 Supabase pgvector
// 设计为幂等操作：通过 scene + title 做冲突去重 (ON CONFLICT DO UPDATE)
//
// 使用方式：
//   npx tsx server/lib/copilot/knowledge-seed.ts
//
// 需要环境变量：
//   NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY / NUXT_SUPABASE_SERVICE_KEY
//   NUXT_OPENAI_API_KEY / NUXT_OPENAI_BASE_URL (可选)
// ────────────────────────────────────────────────────────

// ── 原始知识数据（从旧 knowledge.ts 迁移，保持一致性） ──

interface KnowledgeEntry {
  scene: string;
  source: string;
  title: string;
  content: string;
}

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
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

  // ── 以下为新增知识条目，扩展覆盖范围 ──
  {
    scene: "etsy",
    source: "etsy-seller-handbook",
    title: "Etsy Product Image Guidelines",
    content: `Etsy recommends:
- Minimum 2000px on shortest side for zoom functionality
- Natural lighting preferred, avoid heavy filters
- First photo (thumbnail): clean shot against simple background
- Up to 10 photos per listing
- Show scale with props or hands for handmade items
- Include lifestyle/styled shots for context
- JPEG or PNG format, max 1MB recommended for fast loading`,
  },
  {
    scene: "instagram",
    source: "instagram-creator-guidelines",
    title: "Instagram Image Specifications",
    content: `Instagram image specifications:
- Square post: 1080x1080px (1:1 ratio)
- Portrait post: 1080x1350px (4:5 ratio, recommended for engagement)
- Landscape post: 1080x566px (1.91:1 ratio)
- Stories/Reels: 1080x1920px (9:16 ratio)
- JPEG format, quality 85+ for minimal compression artifacts
- File size limit: 30MB
- sRGB color space for accurate display`,
  },
  {
    scene: "tiktok",
    source: "tiktok-shop-guidelines",
    title: "TikTok Shop Product Image Requirements",
    content: `TikTok Shop requires:
- Minimum 600x600px, recommended 800x800px or higher
- Square aspect ratio (1:1) preferred
- White or light solid background for main image
- JPEG or PNG format, under 5MB
- No watermarks, borders, or promotional text on main image
- Product should fill at least 60% of frame
- Up to 9 images per product listing`,
  },
];

// ── 主流程 ──

async function main() {
  // 1. 初始化 Supabase client（使用 service key 绕过 RLS）
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NUXT_SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "❌ 缺少 NUXT_PUBLIC_SUPABASE_URL 或 NUXT_SUPABASE_SERVICE_KEY 环境变量",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 2. 初始化 Embedding 模型
  const openaiApiKey = process.env.NUXT_OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("❌ 缺少 NUXT_OPENAI_API_KEY 环境变量");
    process.exit(1);
  }

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: openaiApiKey,
    modelName:
      process.env.NUXT_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    configuration: {
      baseURL: process.env.NUXT_OPENAI_BASE_URL || "https://api.openai.com/v1",
    },
  });

  // 3. 初始化文本分块器
  // chunkSize=500 保证每个片段的语义完整性，overlap=50 避免边界丢失上下文
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  console.info("🚀 开始灌入知识库...\n");

  let totalChunks = 0;

  for (const entry of KNOWLEDGE_ENTRIES) {
    // 分块（短文本可能只产生 1 个 chunk）
    const chunks = await splitter.splitText(entry.content);

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      // 为多 chunk 的条目追加编号
      const chunkTitle =
        chunks.length > 1
          ? `${entry.title} (Part ${i + 1}/${chunks.length})`
          : entry.title;

      // 向量化
      const vector = await embeddings.embedQuery(chunkContent);

      // Upsert 到 Supabase（ON CONFLICT 通过 scene + title 去重）
      const { error } = await supabase.from("knowledge_documents").upsert(
        {
          scene: entry.scene,
          source: entry.source,
          title: chunkTitle,
          content: chunkContent,
          embedding: vector,
          metadata: {
            originalTitle: entry.title,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        },
        { onConflict: "scene,title" },
      );

      if (error) {
        console.error(
          `  ❌ 插入失败 [${entry.scene}] ${chunkTitle}:`,
          error.message,
        );
      } else {
        console.info(`  ✅ [${entry.scene}] ${chunkTitle}`);
        totalChunks++;
      }
    }
  }

  console.info(`\n🎉 知识库灌入完成！共写入 ${totalChunks} 个知识片段`);
}

main().catch((err) => {
  console.error("❌ 知识灌入脚本执行失败:", err);
  process.exit(1);
});
