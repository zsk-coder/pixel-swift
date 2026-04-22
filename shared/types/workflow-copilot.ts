// ────────────────────────────────────────────────────────
// Workflow Copilot 核心类型定义
// 前后端共享，所有结构均与 Tech Spec 对齐
// ────────────────────────────────────────────────────────

// ── 白名单动作类型 ──
// 前端执行器和 AI 规划器都只允许使用这些动作
export const PLAN_ACTIONS = [
  "resize",
  "compress",
  "convert_format",
  "rename_files",
  "generate_alt_text",
  "strip_metadata",
] as const;

export type PlanAction = (typeof PLAN_ACTIONS)[number];

// ── 图片描述 ──
// 前端提取的单张图片基础特征，不上传原图给 AI
export interface ImageDescriptor {
  id: string;
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
  hasAlpha?: boolean;
}

// ── 批次摘要 ──
// 将整批图片的特征汇总成紧凑结构，作为 AI 规划的上下文输入
export interface BatchSummary {
  fileCount: number;
  totalSizeBytes: number;
  formats: string[];
  images: ImageDescriptor[];
}

// ── 用户目标输入 ──
export interface GoalInput {
  /** 用户输入的自然语言目标描述 */
  text: string;
  /** 当前界面语言（影响 AI 返回语言） */
  locale: string;
  /** 输入来源：手动输入或预设快捷按钮 */
  source: "manual" | "preset_chip";
  /** 如果来源是预设快捷按钮，记录按下的 key */
  presetKey?: string;
}

// ── AI 计划步骤 ──
export interface PlanStep {
  id: string;
  action: PlanAction;
  enabled: boolean;
  reason: string;
  params: Record<string, unknown>;
}

// ── 风险提示 ──
export interface PlanRisk {
  type: string;
  message: string;
  severity: "info" | "warning";
}

// ── 导出方案 ──
export interface ExportPlan {
  zipName: string;
  includeMetadataCsv: boolean;
  filenamePattern?: string;
}

// ── AI 生成的完整处理计划（核心 Schema） ──
export interface ProcessPlan {
  taskSummary: string;
  taskType: string;
  confidence: number;
  scene: string;
  steps: PlanStep[];
  risks: PlanRisk[];
  exportPlan: ExportPlan;
}

// ── API 请求 / 响应 ──

export interface GeneratePlanRequest {
  goal: GoalInput;
  batch: BatchSummary;
}

export interface GeneratePlanResponse {
  plan: ProcessPlan;
  remainingTrialCount: number;
}
