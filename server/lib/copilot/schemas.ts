import { z } from "zod";
import { PLAN_ACTIONS } from "~~/shared/types/workflow-copilot";

// ────────────────────────────────────────────────────────
// ProcessPlan 的 Zod 校验 Schema
// 用于对 AI 返回的 JSON 做强类型校验，确保前端只收到合法的执行计划
// ────────────────────────────────────────────────────────

// 白名单动作枚举
const planActionSchema = z.enum(PLAN_ACTIONS);

// 单个执行步骤
export const planStepSchema = z.object({
  id: z.string().min(1),
  action: planActionSchema,
  enabled: z.boolean(),
  reason: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
});

// 风险提示
export const planRiskSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning"]),
});

// 导出方案
export const exportPlanSchema = z.object({
  zipName: z.string().min(1),
  includeMetadataCsv: z.boolean(),
  filenamePattern: z.string().optional(),
});

// 完整的处理计划（AI 输出的核心结构）
export const processPlanSchema = z.object({
  taskSummary: z.string(),
  taskType: z.string(),
  confidence: z.number().min(0).max(1),
  scene: z.string(),
  steps: z.array(planStepSchema), // 允许空数组：全部操作不支持时 AI 返回 steps=[]
  risks: z.array(planRiskSchema),
  exportPlan: exportPlanSchema,
});

// ── 请求体校验 ──

const imageDescriptorSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  sizeBytes: z.number().nonnegative(),
  format: z.string(),
  hasAlpha: z.boolean().optional(),
});

const batchSummarySchema = z.object({
  fileCount: z.number().int().positive(),
  totalSizeBytes: z.number().nonnegative(),
  formats: z.array(z.string()).min(1),
  images: z.array(imageDescriptorSchema).min(1),
});

const goalInputSchema = z.object({
  text: z.string().min(1).max(500),
  locale: z.string().min(2).max(10),
  source: z.enum(["manual", "preset_chip"]),
  presetKey: z.string().optional(),
});

// 前端发送过来的完整请求体
export const generatePlanRequestSchema = z.object({
  goal: goalInputSchema,
  batch: batchSummarySchema,
});

// ── Action 级二次参数校验 ──
// 确保各 action 的 params 在合理范围内

// resize 参数约束
const resizeParamsSchema = z
  .object({
    width: z.number().int().min(1).max(10000).optional(),
    height: z.number().int().min(1).max(10000).optional(),
    mode: z.enum(["fit", "fill", "exact"]).optional(),
  })
  .refine((data) => data.width || data.height, {
    message: "Resize action requires at least width or height",
  });

// compress 参数约束
const compressParamsSchema = z.object({
  quality: z.number().min(1).max(100),
});

// convert_format 参数约束
const convertFormatParamsSchema = z.object({
  targetFormat: z.enum(["webp", "jpeg", "png", "avif"]),
});

// action -> params schema 映射表
const actionParamsSchemas: Partial<Record<string, z.ZodType>> = {
  resize: resizeParamsSchema,
  compress: compressParamsSchema,
  convert_format: convertFormatParamsSchema,
};

/**
 * 对计划中每个步骤的 params 做二次精细校验
 * 基础 processPlanSchema 只检查 params 是 Record<string, unknown>，
 * 这里根据具体 action 类型做深层校验
 *
 * @param plan 已通过基础校验的 ProcessPlan
 * @returns 校验失败的步骤列表（空数组表示全部通过）
 */
export function validateStepParams(
  plan: z.infer<typeof processPlanSchema>,
): { stepId: string; action: string; error: string }[] {
  const errors: { stepId: string; action: string; error: string }[] = [];

  for (const step of plan.steps) {
    const schema = actionParamsSchemas[step.action];
    if (!schema) continue;

    const result = schema.safeParse(step.params);
    if (!result.success) {
      errors.push({
        stepId: step.id,
        action: step.action,
        error: result.error.issues.map((i) => i.message).join("; "),
      });
    }
  }

  return errors;
}
