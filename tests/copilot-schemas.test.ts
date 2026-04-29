import { describe, expect, it } from "vitest";
import {
  processPlanSchema,
  generatePlanRequestSchema,
  validateStepParams,
} from "../server/lib/copilot/schemas";

// ── ProcessPlan Schema 校验测试 ──

describe("processPlanSchema", () => {
  // 合法的完整计划
  const validPlan = {
    taskSummary: "Prepare images for Shopify product pages",
    taskType: "ecommerce",
    confidence: 0.91,
    scene: "shopify",
    steps: [
      {
        id: "resize-shopify",
        action: "resize",
        enabled: true,
        reason: "Shopify recommends 2048x2048 for zoom",
        params: { width: 2048, height: 2048, mode: "fit" },
      },
      {
        id: "convert-webp",
        action: "convert_format",
        enabled: true,
        reason: "WebP reduces file size",
        params: { targetFormat: "webp" },
      },
    ],
    risks: [
      {
        type: "possible_quality_loss",
        message: "Fine detail may be lost after conversion",
        severity: "warning",
      },
    ],
    exportPlan: {
      zipName: "shopify-product-images",
      includeMetadataCsv: true,
      filenamePattern: "{slug}-{index}",
    },
  };

  it("accepts a valid ProcessPlan", () => {
    const result = processPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("rejects plan with unknown action", () => {
    const invalidPlan = {
      ...validPlan,
      steps: [
        {
          id: "unknown-step",
          action: "ai_enhance", // 不在白名单中
          enabled: true,
          reason: "test",
          params: {},
        },
      ],
    };
    const result = processPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("rejects plan with confidence out of range", () => {
    const result = processPlanSchema.safeParse({
      ...validPlan,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects plan with negative confidence", () => {
    const result = processPlanSchema.safeParse({
      ...validPlan,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects plan with empty steps array", () => {
    const result = processPlanSchema.safeParse({
      ...validPlan,
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects plan with empty taskSummary", () => {
    const result = processPlanSchema.safeParse({
      ...validPlan,
      taskSummary: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts plan with empty risks array", () => {
    const result = processPlanSchema.safeParse({
      ...validPlan,
      risks: [],
    });
    expect(result.success).toBe(true);
  });
});

// ── Action 级二次参数校验测试 ──

describe("validateStepParams", () => {
  it("passes valid resize params", () => {
    const plan = {
      taskSummary: "test",
      taskType: "test",
      confidence: 0.9,
      scene: "test",
      steps: [
        {
          id: "resize-1",
          action: "resize" as const,
          enabled: true,
          reason: "test",
          params: { width: 2048, height: 2048, mode: "fit" },
        },
      ],
      risks: [],
      exportPlan: { zipName: "test", includeMetadataCsv: false },
    };
    expect(validateStepParams(plan)).toEqual([]);
  });

  it("catches invalid resize params (width too large)", () => {
    const plan = {
      taskSummary: "test",
      taskType: "test",
      confidence: 0.9,
      scene: "test",
      steps: [
        {
          id: "resize-bad",
          action: "resize" as const,
          enabled: true,
          reason: "test",
          params: { width: 99999, height: 2048 },
        },
      ],
      risks: [],
      exportPlan: { zipName: "test", includeMetadataCsv: false },
    };
    const errors = validateStepParams(plan);
    expect(errors.length).toBe(1);
    expect(errors[0].stepId).toBe("resize-bad");
  });

  it("catches invalid compress quality", () => {
    const plan = {
      taskSummary: "test",
      taskType: "test",
      confidence: 0.9,
      scene: "test",
      steps: [
        {
          id: "compress-bad",
          action: "compress" as const,
          enabled: true,
          reason: "test",
          params: { quality: 150 }, // 超出 1-100 范围
        },
      ],
      risks: [],
      exportPlan: { zipName: "test", includeMetadataCsv: false },
    };
    const errors = validateStepParams(plan);
    expect(errors.length).toBe(1);
  });

  it("skips validation for actions without param schemas (rename_files)", () => {
    const plan = {
      taskSummary: "test",
      taskType: "test",
      confidence: 0.9,
      scene: "test",
      steps: [
        {
          id: "rename-1",
          action: "rename_files" as const,
          enabled: true,
          reason: "test",
          params: { pattern: "{name}-optimized" },
        },
      ],
      risks: [],
      exportPlan: { zipName: "test", includeMetadataCsv: false },
    };
    expect(validateStepParams(plan)).toEqual([]);
  });
});

// ── 请求体 Schema 校验测试 ──

describe("generatePlanRequestSchema", () => {
  const validRequest = {
    goal: {
      text: "把这批图处理成适合 Shopify 商品页的版本",
      locale: "zh",
      source: "manual",
    },
    batch: {
      fileCount: 2,
      totalSizeBytes: 5242880,
      formats: ["png", "jpg"],
      images: [
        {
          id: "img-1",
          fileName: "product1.png",
          width: 4000,
          height: 3000,
          sizeBytes: 2097152,
          format: "png",
        },
        {
          id: "img-2",
          fileName: "product2.jpg",
          width: 3000,
          height: 2000,
          sizeBytes: 3145728,
          format: "jpg",
        },
      ],
    },
  };

  it("accepts a valid request", () => {
    const result = generatePlanRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("rejects request with empty goal text", () => {
    const result = generatePlanRequestSchema.safeParse({
      ...validRequest,
      goal: { ...validRequest.goal, text: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects request with no images", () => {
    const result = generatePlanRequestSchema.safeParse({
      ...validRequest,
      batch: { ...validRequest.batch, images: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects request with invalid source", () => {
    const result = generatePlanRequestSchema.safeParse({
      ...validRequest,
      goal: { ...validRequest.goal, source: "voice" },
    });
    expect(result.success).toBe(false);
  });
});
