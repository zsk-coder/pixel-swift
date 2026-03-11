import { defineContentConfig, defineCollection, z } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: "page",
      source: "blog/**/*.md",
      schema: z.object({
        title: z.string(),
        description: z.string(),
        category: z.string(),
        author: z.string(),
        date: z.string(),
        readTime: z.number(),
        cover: z.string(),
        featured: z.boolean().optional().default(false),
      }),
    }),
  },
});
