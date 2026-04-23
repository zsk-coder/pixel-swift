/**
 * Workflow Copilot 编排 Composable
 *
 * 核心职责：
 *  1. 从 File[] 提取图片特征 → ImageDescriptor[] + BatchSummary
 *  2. 调用 POST /api/workflow-copilot/plan 获取 AI 生成的 ProcessPlan
 *  3. 在浏览器端逐步执行 plan.steps（resize / compress / convert 等）
 *  4. 维护执行日志 LogEntry[]，供 ExecutionCore 实时渲染
 *  5. 提供批量下载结果能力
 */

import type {
  ImageDescriptor,
  BatchSummary,
  GoalInput,
  ProcessPlan,
  PlanStep,
  GeneratePlanResponse,
} from "~~/shared/types/workflow-copilot";
import type { ApiResponse } from "~~/shared/types/api";
import { ApiCode } from "~~/shared/types/api";

// ── 日志条目类型 ──
export interface LogEntry {
  timestamp: string; // "HH:mm:ss"
  status: "done" | "running" | "pending" | "error";
  message: string;
  duration?: string; // "(0.8s)"
}

// ── 执行阶段 ──
export type CopilotPhase =
  | "idle"
  | "extracting"
  | "planning"
  | "executing"
  | "done"
  | "error";

// ── 结果文件 ──
export interface ResultFile {
  blob: Blob;
  name: string;
}

// ── 时间戳格式化工具 ──
function nowTimestamp(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

// ── 从 File 提取图片特征 ──
async function extractDescriptor(
  file: File,
  index: number,
): Promise<ImageDescriptor> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();

  // 检测是否有 alpha 通道（PNG / WebP 可能有）
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAlpha = ["png", "webp", "avif"].includes(ext);
  const format = ext === "jpg" || ext === "jpeg" ? "jpeg" : ext;

  return {
    id: `img-${index}-${Date.now()}`,
    fileName: file.name,
    width,
    height,
    sizeBytes: file.size,
    format,
    hasAlpha,
  };
}

// ── 将 PlanAction 映射到 useImageProcessor 的 ProcessOptions ──
function mapStepToProcessOptions(step: PlanStep) {
  const p = step.params as Record<string, unknown>;

  switch (step.action) {
    case "resize":
      return {
        action: "resize" as const,
        width: (p.width as number) || undefined,
        height: (p.height as number) || undefined,
        keepAspectRatio: true,
      };
    case "compress":
      return {
        action: "compress" as const,
        quality: (p.quality as number) || 80,
      };
    case "convert_format": {
      const fmt = (p.targetFormat as string) || "webp";
      return {
        action: "convert" as const,
        outputFormat: (fmt === "jpeg" ? "jpg" : fmt) as
          | "jpg"
          | "png"
          | "webp"
          | "avif",
      };
    }
    default:
      // rename_files / generate_alt_text / strip_metadata 在浏览器端不做图像处理
      return null;
  }
}

// ── 根据 step 生成输出文件名 ──
function buildOutputFileName(
  originalName: string,
  step: PlanStep,
  result?: { width: number; height: number; format: string },
): string {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const p = step.params as Record<string, unknown>;

  switch (step.action) {
    case "resize": {
      const w = result?.width || (p.width as number);
      const h = result?.height || (p.height as number);
      const ext = result?.format || originalName.split(".").pop() || "jpg";
      return `${baseName}_${w}x${h}.${ext}`;
    }
    case "compress": {
      const ext = result?.format || originalName.split(".").pop() || "jpg";
      return `${baseName}_compressed.${ext}`;
    }
    case "convert_format": {
      const fmt = (p.targetFormat as string) || "webp";
      return `${baseName}.${fmt}`;
    }
    case "rename_files": {
      const pattern = (p.pattern as string) || "{name}-optimized";
      const ext = originalName.split(".").pop() || "jpg";
      return pattern.replace("{name}", baseName) + `.${ext}`;
    }
    default:
      return originalName;
  }
}

// ────────────────────────────────────────────────────────
// Composable 主函数
// ────────────────────────────────────────────────────────
export function useWorkflowCopilot() {
  const { processImage } = useImageProcessor();
  const { downloadAsZip } = useDownload();
  const { t } = useI18n();

  // ── 响应式状态 ──
  const phase = ref<CopilotPhase>("idle");
  const plan = ref<ProcessPlan | null>(null);
  const logs = ref<LogEntry[]>([]);
  const progress = ref(0);
  const errorMessage = ref<string | null>(null);
  const resultFiles = ref<ResultFile[]>([]);

  // ── 日志工具方法 ──
  function addLog(
    status: LogEntry["status"],
    message: string,
    duration?: string,
  ) {
    logs.value.push({
      timestamp: nowTimestamp(),
      status,
      message,
      duration,
    });
  }

  // 更新最后一条日志的状态
  function updateLastLog(
    status: LogEntry["status"],
    duration?: string,
    message?: string,
  ) {
    const last = logs.value[logs.value.length - 1];
    if (last) {
      last.status = status;
      if (duration) last.duration = duration;
      if (message) last.message = message;
    }
  }

  // ── 1. 图片特征提取 ──
  async function extractBatch(files: File[]): Promise<BatchSummary> {
    const descriptors: ImageDescriptor[] = [];

    for (let i = 0; i < files.length; i++) {
      const desc = await extractDescriptor(files[i]!, i);
      descriptors.push(desc);
    }

    const formats = [...new Set(descriptors.map((d) => d.format))];
    const totalSizeBytes = descriptors.reduce((s, d) => s + d.sizeBytes, 0);

    return {
      fileCount: files.length,
      totalSizeBytes,
      formats,
      images: descriptors,
    };
  }

  // ── 2. 调用 Plan API ──
  async function fetchPlan(
    goalInput: GoalInput,
    batch: BatchSummary,
  ): Promise<ProcessPlan> {
    const response = await fetch("/api/workflow-copilot/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ goal: goalInput, batch }),
    });

    const contentType = response.headers.get("content-type") || "";

    // 如果返回 JSON 说明接口抛出了预检失败（比如 Auth / Quota 判断）
    if (contentType.includes("json")) {
      const res = await response.json();
      if (res.code === ApiCode.UNAUTHORIZED)
        throw new Error("UNAUTHORIZED.LOGIN_REQUIRED");
      if (res.code === ApiCode.QUOTA_EXHAUSTED)
        throw new Error("QUOTA_EXHAUSTED.UPGRADE_REQUIRED");
      throw new Error(res.msg || "SERVER_ERROR.AI_UNAVAILABLE");
    }

    if (!response.body) {
      throw new Error("No response body received from planning API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPlan: ProcessPlan | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventType = "message";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.substring(7);
          if (line.startsWith("data: ")) dataStr += line.substring(6);
        }

        if (eventType === "error") {
          let msg = "SERVER_ERROR.AI_UNAVAILABLE";
          try {
            const err = JSON.parse(dataStr);
            if (err.message) msg = err.message;
          } catch (e) {}
          throw new Error(msg);
        }

        if (eventType === "message" && dataStr) {
          try {
            const payload = JSON.parse(dataStr);
            if (payload.type === "progress") {
              const chunk = payload.chunk;
              if (chunk.planner) {
                // 如果当前正在 running 的日志是 "Analyzing..."，完成它
                if (logs.value[logs.value.length - 1]?.status === "running") {
                  updateLastLog("done", "");
                }
                const attemptsStr =
                  chunk.planner.attempts > 1
                    ? ` (Attempt ${chunk.planner.attempts})`
                    : "";
                addLog(
                  "running",
                  `AI generating optimal workflow${attemptsStr}...`,
                );
              } else if (chunk.reviewer) {
                if (logs.value[logs.value.length - 1]?.status === "running") {
                  updateLastLog("done", "");
                }
                addLog(
                  "running",
                  `AI Quality Assurance: Reviewing generated plan for compliance...`,
                );
              } else if (chunk.output && "finalPlan" in chunk.output) {
                finalPlan = chunk.output.finalPlan;
              }
            } else if (payload.type === "complete") {
              // stream complete signals quota deductions etc
            }
          } catch (e) {
            console.error("[Copilot SSE] Parse error:", e);
          }
        }
      }
    }

    if (!finalPlan) {
      throw new Error("LangGraph stream finished but no valid plan received.");
    }
    return finalPlan;
  }

  // ── 3. 浏览器端执行计划 ──
  async function executePlan(files: File[], processPlan: ProcessPlan) {
    // 收集需要在浏览器端处理图像的步骤
    const imageSteps = processPlan.steps.filter(
      (s) => s.enabled && mapStepToProcessOptions(s) !== null,
    );

    // 收集非图像处理步骤（rename 等）
    const metaSteps = processPlan.steps.filter(
      (s) => s.enabled && mapStepToProcessOptions(s) === null,
    );

    const totalWork = imageSteps.length * files.length + metaSteps.length;
    let completed = 0;

    // 当前的文件数据：初始为用户上传的原始文件
    // 每个步骤可能产生新的 Blob，链式传递给下一个步骤
    let currentBlobs: { blob: Blob; name: string }[] = files.map((f) => ({
      blob: f,
      name: f.name,
    }));

    // 按步骤顺序执行（每步对所有文件做处理）
    for (const step of imageSteps) {
      const opts = mapStepToProcessOptions(step)!;
      addLog("running", `${step.reason}...`);

      const nextBlobs: { blob: Blob; name: string }[] = [];
      const stepStart = performance.now();

      for (let i = 0; i < currentBlobs.length; i++) {
        const { blob, name } = currentBlobs[i]!;

        // 将 Blob 转成 File 以便 processImage 使用
        const inputFile = new File([blob], name, { type: blob.type });

        try {
          const result = await processImage(inputFile, opts);
          const outputName = buildOutputFileName(name, step, result);
          nextBlobs.push({ blob: result.blob, name: outputName });
        } catch (err) {
          // 单张失败不阻断整批
          console.warn(`[Copilot] 处理失败: ${name}`, err);
          nextBlobs.push({ blob, name }); // 保留原始版本
        }

        completed++;
        progress.value = Math.round((completed / totalWork) * 100);
      }

      const stepDuration = ((performance.now() - stepStart) / 1000).toFixed(1);
      updateLastLog("done", `(${stepDuration}s)`);
      currentBlobs = nextBlobs;
    }

    // 处理元数据步骤（rename_files 等）
    for (const step of metaSteps) {
      const stepStart = performance.now();
      addLog("running", `${step.reason}...`);

      if (step.action === "rename_files") {
        currentBlobs = currentBlobs.map((f) => ({
          blob: f.blob,
          name: buildOutputFileName(f.name, step),
        }));
      }
      // generate_alt_text / strip_metadata 在 Phase1 只记录日志
      completed++;
      progress.value = Math.round((completed / totalWork) * 100);

      const stepDuration = ((performance.now() - stepStart) / 1000).toFixed(1);
      updateLastLog("done", `(${stepDuration}s)`);
    }

    return currentBlobs;
  }

  // ── 主入口：运行完整流程 ──
  async function run(files: File[], goalText: string, locale: string) {
    // 重置状态
    phase.value = "extracting";
    plan.value = null;
    logs.value = [];
    progress.value = 0;
    errorMessage.value = null;
    resultFiles.value = [];

    try {
      // ── 阶段 1: 特征提取 ──
      addLog("running", `Analyzing ${files.length} images in batch queue...`);
      const extractStart = performance.now();
      const batch = await extractBatch(files);
      const extractDuration = (
        (performance.now() - extractStart) /
        1000
      ).toFixed(1);
      updateLastLog("done", `(${extractDuration}s)`);

      // ── 阶段 2: AI 规划 ──
      phase.value = "planning";
      addLog("running", "AI generating optimal processing pipeline...");
      const planStart = performance.now();

      const goalInput: GoalInput = {
        text: goalText,
        locale,
        source: "manual",
      };

      const aiPlan = await fetchPlan(goalInput, batch);
      plan.value = aiPlan;

      const planDuration = ((performance.now() - planStart) / 1000).toFixed(1);
      updateLastLog("done", `(${planDuration}s)`);

      // 记录计划摘要
      addLog(
        "done",
        `Plan: ${aiPlan.taskSummary} (${aiPlan.steps.length} steps, confidence: ${(aiPlan.confidence * 100).toFixed(0)}%)`,
      );

      // ── 阶段 3: 浏览器端执行 ──
      phase.value = "executing";
      const results = await executePlan(files, aiPlan);

      // ── 阶段 4: 完成 ──
      resultFiles.value = results;
      progress.value = 100;
      phase.value = "done";
      addLog("done", `All done! ${results.length} files ready for download.`);
    } catch (err) {
      phase.value = "error";
      const key =
        err instanceof Error ? err.message : "SERVER_ERROR.UNKNOWN_ERROR";
      const translatedMsg = key.includes(".") ? t(`apiEvents.${key}`) : key;
      errorMessage.value = translatedMsg;
      addLog("error", `Error: ${translatedMsg}`);
    }
  }

  // ── 下载结果 ──
  async function downloadResults() {
    if (resultFiles.value.length === 0) return;

    const zipName =
      plan.value?.exportPlan.zipName ||
      `pixelswift_copilot_${new Date().toISOString().split("T")[0]?.replace(/-/g, "")}`;

    await downloadAsZip(resultFiles.value, `${zipName}.zip`);
  }

  // ── 重置 ──
  function reset() {
    phase.value = "idle";
    plan.value = null;
    logs.value = [];
    progress.value = 0;
    errorMessage.value = null;
    resultFiles.value = [];
  }

  return {
    // 状态
    phase: readonly(phase),
    plan: readonly(plan),
    logs: readonly(logs),
    progress: readonly(progress),
    errorMessage: readonly(errorMessage),
    resultFiles: readonly(resultFiles),

    // 操作
    run,
    downloadResults,
    reset,
  };
}
