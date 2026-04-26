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
  status: "done" | "running" | "pending" | "error" | "warning";
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
  | "error"
  | "unsupported";

// ── 结果文件 ──
export interface ResultFile {
  blob: Blob;
  name: string;
}



// ── 从 File 提取图片特征 ──
async function extractDescriptor(
  file: File,
  index: number,
): Promise<ImageDescriptor> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // 使用 Canvas 检测是否真正含有 alpha 通道（而非仅按扩展名推断）
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = ext === "jpg" || ext === "jpeg" ? "jpeg" : ext;
  let hasAlpha = false;

  // 只对可能有透明度的格式做像素级检测
  if (["png", "webp", "avif"].includes(ext)) {
    try {
      const canvas = new OffscreenCanvas(
        Math.min(width, 64),
        Math.min(height, 64),
      );
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // 检查 alpha 通道是否全为 255（不透明）
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i]! < 255) {
            hasAlpha = true;
            break;
          }
        }
      }
    } catch {
      // OffscreenCanvas 不可用时回退到扩展名推断
      hasAlpha = true;
    }
  }

  bitmap.close();

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
// 前端做参数 clamp 防御，避免 AI 幻觉参数导致处理器异常
function mapStepToProcessOptions(step: PlanStep) {
  const p = step.params as Record<string, unknown>;

  switch (step.action) {
    case "resize": {
      // clamp 尺寸到合理范围 [1, 10000]
      const w =
        typeof p.width === "number"
          ? Math.max(1, Math.min(10000, Math.round(p.width)))
          : undefined;
      const h =
        typeof p.height === "number"
          ? Math.max(1, Math.min(10000, Math.round(p.height)))
          : undefined;
      return {
        action: "resize" as const,
        width: w,
        height: h,
        keepAspectRatio: true,
      };
    }
    case "compress": {
      // clamp 质量到 [1, 100]
      const rawQ = typeof p.quality === "number" ? p.quality : 80;
      return {
        action: "compress" as const,
        quality: Math.max(1, Math.min(100, Math.round(rawQ))),
      };
    }
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
  const { refreshQuota } = useTrialQuota();

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

  // ── 1. 图片特征提取（并行化） ──
  async function extractBatch(files: File[]): Promise<BatchSummary> {
    // 并行提取所有图片特征，显著提升大批量图片的处理速度
    const descriptors = await Promise.all(
      files.map((file, i) => extractDescriptor(file, i)),
    );

    const formats = [...new Set(descriptors.map((d) => d.format))];
    const totalSizeBytes = descriptors.reduce((s, d) => s + d.sizeBytes, 0);

    return {
      fileCount: files.length,
      totalSizeBytes,
      formats,
      images: descriptors,
    };
  }

  // ── SSE 事件解析工具函数 ──
  function parseSSEPart(part: string) {
    if (!part.trim()) return;
    const lines = part.split("\n");
    let eventType = "message";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) eventType = line.substring(7);
      if (line.startsWith("data: ")) dataStr += line.substring(6);
    }

    return { eventType, dataStr };
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

    // 处理单个 SSE 事件的回调
    function handleSSEEvent(eventType: string, dataStr: string) {
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
            // 规划阶段进度：10% → 40%，每收到一个 SSE 事件就往前推一点
            progress.value = Math.min(40, progress.value + 3);
            if (chunk.planner) {
              // 如果当前正在 running 的日志是 "Analyzing..."，完成它
              if (logs.value[logs.value.length - 1]?.status === "running") {
                updateLastLog("done", "");
              }
              const attemptsStr =
                chunk.planner.attempts > 1
                  ? ` (${t("copilot.execution.logs.attempt", { n: chunk.planner.attempts })})`
                  : "";
              addLog(
                "running",
                `${t("copilot.execution.logs.aiGenerating")}${attemptsStr}...`,
              );
            } else if (chunk.reviewer) {
              if (logs.value[logs.value.length - 1]?.status === "running") {
                updateLastLog("done", "");
              }
              addLog("running", t("copilot.execution.logs.aiReviewing"));
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

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // 处理 buffer 中剩余的最后一个事件，避免尾部数据丢失
        if (buffer.trim()) {
          const parsed = parseSSEPart(buffer);
          if (parsed) handleSSEEvent(parsed.eventType, parsed.dataStr);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const parsed = parseSSEPart(part);
        if (parsed) handleSSEEvent(parsed.eventType, parsed.dataStr);
      }
    }

    if (!finalPlan) {
      throw new Error("LangGraph stream finished but no valid plan received.");
    }
    return finalPlan;
  }

  // ── 3. 浏览器端执行计划（并行处理，并发上限 4） ──
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

    // 并发控制工具：限制同时处理数量避免内存尖峰
    const CONCURRENCY = 4;
    async function processWithConcurrency<T>(
      items: T[],
      fn: (item: T, index: number) => Promise<void>,
    ) {
      let running = 0;
      let idx = 0;
      return new Promise<void>((resolve, reject) => {
        function next() {
          if (idx >= items.length && running === 0) {
            resolve();
            return;
          }
          while (running < CONCURRENCY && idx < items.length) {
            const currentIdx = idx++;
            running++;
            fn(items[currentIdx]!, currentIdx)
              .then(() => {
                running--;
                next();
              })
              .catch(reject);
          }
        }
        next();
      });
    }

    // 按步骤顺序执行（每步对所有文件并行处理）
    for (const step of imageSteps) {
      const opts = mapStepToProcessOptions(step)!;
      addLog("running", `${step.reason}...`);

      const nextBlobs: { blob: Blob; name: string }[] = new Array(
        currentBlobs.length,
      );
      const stepStart = performance.now();

      await processWithConcurrency(currentBlobs, async (item, i) => {
        const { blob, name } = item;
        const inputFile = new File([blob], name, { type: blob.type });

        try {
          const result = await processImage(inputFile, opts);
          const outputName = buildOutputFileName(name, step, result);
          nextBlobs[i] = { blob: result.blob, name: outputName };
        } catch (err) {
          // 单张失败不阻断整批
          console.warn(`[Copilot] 处理失败: ${name}`, err);
          nextBlobs[i] = { blob, name }; // 保留原始版本
        }

        completed++;
        // 执行阶段进度映射到 40% → 100%
        progress.value = 40 + Math.round((completed / totalWork) * 60);
      });

      const stepDuration = ((performance.now() - stepStart) / 1000).toFixed(1);
      updateLastLog("done", `(${stepDuration}s)`);
      currentBlobs = nextBlobs;
    }

    // 处理元数据步骤（rename_files 等）
    for (const step of metaSteps) {
      const stepStart = performance.now();
      addLog("running", `${step.reason}...`);

      completed++;
      progress.value = 40 + Math.round((completed / totalWork) * 60);

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
      progress.value = 5; // 提取开始，先给 5%
      addLog(
        "running",
        t("copilot.execution.logs.analyzing", { count: files.length }),
      );
      const extractStart = performance.now();
      const batch = await extractBatch(files);
      const extractDuration = (
        (performance.now() - extractStart) /
        1000
      ).toFixed(1);
      updateLastLog("done", `(${extractDuration}s)`);
      progress.value = 10; // 提取完成，推到 10%

      // ── 阶段 2: AI 规划 ──
      phase.value = "planning";
      addLog("running", t("copilot.execution.logs.aiPlanning"));
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

      // ── 空步骤防护：AI 返回 steps=[] 说明全部操作不支持 ──
      if (aiPlan.steps.length === 0) {
        const riskMsg = aiPlan.risks.map((r) => r.message).join("; ");
        const fallbackMsg = t
          ? t("apiEvents.SERVER_ERROR.UNSUPPORTED_OPERATION")
          : "Unsupported operation";
        errorMessage.value = riskMsg || fallbackMsg;

        // 优雅退出，进入 warning/unsupported 阶段而不是抛出红屏错误
        addLog("warning", errorMessage.value);
        phase.value = "unsupported";
        progress.value = 100;
        return;
      }

      // ── 阶段 3: 浏览器端执行 ──
      phase.value = "executing";
      const results = await executePlan(files, aiPlan);

      // ── 阶段 4: 完成 ──
      resultFiles.value = results;
      progress.value = 100;
      phase.value = "done";
      // 强制刷新本地配额缓存，让头像菜单立刻显示最新的剩余次数
      refreshQuota();
      addLog(
        "done",
        t("copilot.execution.logs.allDone", { count: results.length }),
      );
    } catch (err) {
      phase.value = "error";
      const key =
        err instanceof Error ? err.message : "SERVER_ERROR.UNKNOWN_ERROR";

      // 判断是否是标准的内建错误 Key（以大写字母和下划线组成的固定格式开头）
      const isI18nKey = /^[A-Z_]+\.[A-Z_]+$/.test(key);
      const translatedMsg = isI18nKey ? t(`apiEvents.${key}`) : key;

      errorMessage.value = translatedMsg;
      addLog(
        "error",
        t("copilot.execution.logs.errorPrefix", { message: translatedMsg }),
      );
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
