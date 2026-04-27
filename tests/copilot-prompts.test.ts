import { describe, expect, it } from "vitest";
import {
  buildUserMessage,
  buildReviewMessage,
} from "../server/lib/copilot/prompts";
import { retrieveKnowledgeByKeyword } from "../server/lib/copilot/knowledge";
import { PLAN_ACTIONS } from "../shared/types/workflow-copilot";
import type { GoalInput, BatchSummary } from "../shared/types/workflow-copilot";

// ── ChatPromptTemplate 测试（通过 buildUserMessage 间接验证） ──

describe("buildUserMessage", () => {
  const goal: GoalInput = {
    text: "把这批图处理成适合 Shopify 商品页的版本",
    locale: "zh",
    source: "manual",
  };

  const batch: BatchSummary = {
    fileCount: 2,
    totalSizeBytes: 5242880,
    formats: ["png"],
    images: [
      {
        id: "1",
        fileName: "product1.png",
        width: 4000,
        height: 3000,
        sizeBytes: 2621440,
        format: "png",
      },
      {
        id: "2",
        fileName: "product2.png",
        width: 3000,
        height: 2000,
        sizeBytes: 2621440,
        format: "png",
      },
    ],
  };

  it("includes user goal text", () => {
    const msg = buildUserMessage(goal, batch, []);
    expect(msg).toContain("Shopify");
  });

  it("includes batch summary information", () => {
    const msg = buildUserMessage(goal, batch, []);
    expect(msg).toContain("product1.png");
    expect(msg).toContain("4000x3000");
  });

  it("includes knowledge when provided", () => {
    const knowledge = [
      {
        id: "k1",
        scene: "shopify",
        source: "test",
        title: "Shopify Guidelines",
        content: "Use square images for product listings",
      },
    ];
    const msg = buildUserMessage(goal, batch, knowledge);
    expect(msg).toContain("Shopify Guidelines");
    expect(msg).toContain("square images");
  });

  it("does not include knowledge section when empty", () => {
    const msg = buildUserMessage(goal, batch, []);
    expect(msg).not.toContain("Platform Knowledge");
  });
});

describe("buildReviewMessage", () => {
  it("includes user goal and plan JSON", () => {
    const msg = buildReviewMessage("optimize for web", {
      taskSummary: "test plan",
      steps: [],
    });
    expect(msg).toContain("optimize for web");
    expect(msg).toContain("test plan");
  });
});

// ── 知识检索测试（关键词 Fallback） ──

describe("retrieveKnowledgeByKeyword", () => {
  it("retrieves shopify knowledge for shopify-related goals", () => {
    const results = retrieveKnowledgeByKeyword(
      "prepare images for shopify store",
    );
    expect(results.some((r) => r.scene === "shopify")).toBe(true);
  });

  it("retrieves amazon knowledge for amazon-related goals", () => {
    const results = retrieveKnowledgeByKeyword("prepare amazon listing images");
    expect(results.some((r) => r.scene === "amazon")).toBe(true);
  });

  it("retrieves blog knowledge for blog-related goals", () => {
    const results = retrieveKnowledgeByKeyword("compress blog post images");
    expect(results.some((r) => r.scene === "blog")).toBe(true);
  });

  it("retrieves general knowledge when no specific scene matches", () => {
    const results = retrieveKnowledgeByKeyword("make these look nice");
    expect(results.some((r) => r.scene === "general")).toBe(true);
  });

  it("retrieves chinese keyword matches", () => {
    const results = retrieveKnowledgeByKeyword("优化博客配图");
    expect(results.some((r) => r.scene === "blog")).toBe(true);
  });

  it("respects maxResults limit", () => {
    const results = retrieveKnowledgeByKeyword(
      "shopify amazon blog seo optimize",
      2,
    );
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// ── LangChain Prompt Template 结构测试 ──

describe("LangChain prompt templates", () => {
  it("plannerPrompt is importable and has expected structure", async () => {
    const { plannerPrompt } = await import("../server/lib/copilot/prompts");
    expect(plannerPrompt).toBeDefined();

    // ChatPromptTemplate 应该能格式化消息
    const messages = await plannerPrompt.formatMessages({
      userMessage: "test goal",
    });
    expect(messages.length).toBe(2); // system + human
    expect(messages[0].content).toContain("Workflow Copilot");
    expect(messages[1].content).toContain("test goal");

    // System prompt 应包含所有 action
    const systemContent = messages[0].content as string;
    for (const action of PLAN_ACTIONS) {
      expect(systemContent).toContain(action);
    }
  });

  it("reviewerPrompt is importable and has expected structure", async () => {
    const { reviewerPrompt } = await import("../server/lib/copilot/prompts");
    expect(reviewerPrompt).toBeDefined();

    const messages = await reviewerPrompt.formatMessages({
      reviewMessage: "review this plan",
    });
    expect(messages.length).toBe(2);
    expect(messages[0].content).toContain("plan quality auditor");
    expect(messages[1].content).toContain("review this plan");
  });
});

// ── CRAG 节点测试（Schema 验证） ──

describe("CRAG schemas", () => {
  it("gradeResultSchema validates correct input", async () => {
    const { gradeResultSchema } =
      await import("../server/lib/copilot/retrieval-grader");
    const valid = {
      relevant: true,
      confidence: 0.85,
      reason: "Knowledge matches the user goal",
    };
    expect(gradeResultSchema.safeParse(valid).success).toBe(true);
  });

  it("gradeResultSchema rejects invalid confidence", async () => {
    const { gradeResultSchema } =
      await import("../server/lib/copilot/retrieval-grader");
    const invalid = { relevant: true, confidence: 1.5, reason: "test" };
    expect(gradeResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("rewriteResultSchema validates correct input", async () => {
    const { rewriteResultSchema } =
      await import("../server/lib/copilot/query-rewriter");
    const valid = {
      rewrittenQuery: "optimize product images for Shopify",
      reasoning: "Translated Chinese terms to English",
    };
    expect(rewriteResultSchema.safeParse(valid).success).toBe(true);
  });
});
