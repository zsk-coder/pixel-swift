/**
 * Workflow Copilot 编排 Composable
 *
 * 核心职责：
 *  1. 从 File[] 提取图片特征 → ImageDescriptor[] + BatchSummary
 *  2. 调用 POST /api/ai-workflow/plan 获取 AI 生成的 ProcessPlan
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
} from "~~/shared/types/workflow-copilot";
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

  // ── 定时器 ──
  let progressTimer: ReturnType<typeof setInterval> | null = null;

  // ── 日志工具方法 ──
  function addLog(
    status: LogEntry["status"],
    message: string,
    duration?: string,
  ) {
    logs.value.push({ status, message, duration });
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

  // 完成最后一条 running 日志
  function completeLastRunning() {
    if (logs.value[logs.value.length - 1]?.status === "running") {
      updateLastLog("done", "");
    }
  }

  // planning 阶段安全网：确保始终有一条 running 日志
  // 不新增条目，而是把最后一条 done 日志改回 running，避免产生重复条目
  function ensureLastLogRunning() {
    if (
      phase.value === "planning" &&
      logs.value.length > 0 &&
      logs.value[logs.value.length - 1]?.status !== "running"
    ) {
      const last = logs.value[logs.value.length - 1]!;
      last.status = "running";
      last.duration = undefined;
    }
  }

  // ── 统一的假进度条工具 ──
  // ease-out 曲线：前快后慢，从 from% 缓慢爬到 to%
  function startProgressTimer(from: number, to: number, durationMs: number) {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    const tickInterval = 500;
    const totalTicks = durationMs / tickInterval;
    let tick = 0;
    progressTimer = setInterval(() => {
      tick++;
      if (phase.value !== "planning" || tick >= totalTicks) {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        return;
      }
      const ratio = 1 - Math.pow(1 - tick / totalTicks, 2);
      progress.value = Math.round(from + (to - from) * ratio);
    }, tickInterval);
  }

  function stopProgressTimer() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  // ── 1. 图片特征提取（并行化） ──
  async function extractBatch(files: File[]): Promise<BatchSummary> {
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

  // ── SSE 事件解析 ──
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

  // ── 暂存检索元数据：onRetrieve 静默存储，onGradeKnowledge 评估后才决定展示 ──
  // 主流 RAG 产品做法：检索 + 评估是原子操作，只展示最终确认相关的结果
  let _pendingRetrieveMeta: { knowledgeCount: number; knowledgeTitles: string[] } | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onRetrieve(data: any) {
    const meta = data.lastNodeMeta;

    // 静默存储检索元数据，不立即展示给用户
    if (meta?.knowledgeCount > 0) {
      _pendingRetrieveMeta = {
        knowledgeCount: meta.knowledgeCount,
        knowledgeTitles: meta.knowledgeTitles as string[],
      };
    } else {
      _pendingRetrieveMeta = null;
    }

    // 单调递增保护：假进度条可能已超过 12%，不能往回拽
    progress.value = Math.max(progress.value, Math.min(12, progress.value + 4));

    // 启动假进度条：从当前值缓慢爬到 ~35%，覆盖 retrieve → planner 整段空白
    if (!progressTimer) {
      startProgressTimer(progress.value, 35, 12000);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onGradeKnowledge(data: any) {
    const meta = data.lastNodeMeta;
    completeLastRunning();

    if (meta?.relevant && _pendingRetrieveMeta) {
      // Grader 确认相关：此时才展示匹配结果
      addLog(
        "done",
        t("copilot.execution.logs.knowledgeMatched", {
          count: _pendingRetrieveMeta.knowledgeCount,
          titles: _pendingRetrieveMeta.knowledgeTitles.join(", "),
        }),
      );
      addLog("done", t("copilot.execution.logs.knowledgeRelevant"));

      // 单调递增保护
      const next = Math.min(progress.value + 3, 35);
      progress.value = Math.max(progress.value, next);
    }
    // 不相关 → 什么都不展示，静默跳过，直接进入 AI 规划

    // 清空暂存
    _pendingRetrieveMeta = null;

    // 追加固定的 "AI 规划中..." 日志，填补后续 planner LLM 调用的空白期（去重）
    const aiPlanningMsg = t("copilot.execution.logs.aiPlanning");
    const lastLog = logs.value[logs.value.length - 1];
    if (!lastLog || lastLog.message !== aiPlanningMsg) {
      addLog("running", aiPlanningMsg);
    } else if (lastLog.status !== "running") {
      lastLog.status = "running";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onPlanner(data: any) {
    stopProgressTimer();

    const attemptsStr =
      data.attempts > 1
        ? ` (${t("copilot.execution.logs.attempt", { n: data.attempts })})`
        : "";
    // 将 aiPlanning 的 running 日志直接更新为完成态（复用同一条，避免蹦出新条目）
    updateLastLog(
      "done",
      "",
      `${t("copilot.execution.logs.aiGenerating")}${attemptsStr}`,
    );
    // 单调递增保护：假进度条可能已把值推到 30%+，stopProgressTimer 后不能跳回
    progress.value = Math.max(progress.value, Math.min(35, progress.value + 8));
    // 填补 reviewer LLM 调用的空白期
    addLog("running", t("copilot.execution.logs.aiReviewing"));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onReviewer(data: any) {
    completeLastRunning();

    // 如果审核未通过，插入打回日志
    if (data.review?.approved === false) {
      addLog("done", t("copilot.execution.logs.reviewFailed"));
      addLog("running", t("copilot.execution.logs.aiPlanningRetry"));
    }
    // 单调递增保护
    progress.value = Math.max(progress.value, Math.min(38, progress.value + 4));
  }

  // ── 2. 调用 Plan API ──
  async function fetchPlan(
    goalInput: GoalInput,
    batch: BatchSummary,
  ): Promise<ProcessPlan> {
    const response = await fetch("/api/ai-workflow/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    // 处理单个 SSE 事件
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

            // 按节点类型分发到独立处理器
            if (chunk.retrieve) onRetrieve(chunk.retrieve);
            if (chunk.gradeKnowledge) onGradeKnowledge(chunk.gradeKnowledge);
            if (chunk.planner) onPlanner(chunk.planner);
            else if (chunk.reviewer) onReviewer(chunk.reviewer);
            else if (chunk.output && "finalPlan" in chunk.output)
              finalPlan = chunk.output.finalPlan;

            // 安全网：planning 阶段每个事件处理后，确保始终有一条 running 日志
            ensureLastLogRunning();
          }
        } catch (e) {
          console.error("[Copilot SSE] Parse error:", e);
        }
      }
    }

    // 读取 SSE 流
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
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
    const imageSteps = processPlan.steps.filter(
      (s) => s.enabled && mapStepToProcessOptions(s) !== null,
    );
    const metaSteps = processPlan.steps.filter(
      (s) => s.enabled && mapStepToProcessOptions(s) === null,
    );

    const totalWork = imageSteps.length * files.length + metaSteps.length;
    let completed = 0;

    // 当前的文件数据：每个步骤产生新的 Blob，链式传递给下一个步骤
    let currentBlobs: { blob: Blob; name: string }[] = files.map((f) => ({
      blob: f,
      name: f.name,
    }));

    // 并发控制：限制同时处理数量避免内存尖峰
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
          nextBlobs[i] = { blob, name };
        }

        completed++;
        // 执行阶段进度映射到 40% → 100%
        progress.value = 40 + Math.round((completed / totalWork) * 60);
      });

      const stepDuration = ((performance.now() - stepStart) / 1000).toFixed(1);
      updateLastLog("done", `(${stepDuration}s)`);
      currentBlobs = nextBlobs;
    }

    // 元数据步骤（rename_files 等）：无实际图像处理，直接标记完成
    for (const step of metaSteps) {
      addLog("done", `${step.reason}`);
      completed++;
      progress.value = 40 + Math.round((completed / totalWork) * 60);
    }

    return currentBlobs;
  }

  // ── 主入口：运行完整流程 ──
  async function run(files: File[], goalText: string, locale: string) {
    // 重置状态
    stopProgressTimer();
    phase.value = "extracting";
    plan.value = null;
    logs.value = [];
    progress.value = 0;
    errorMessage.value = null;
    resultFiles.value = [];

    try {
      // ── 阶段 1: 特征提取 ──
      progress.value = 5;
      addLog(
        "running",
        t("copilot.execution.logs.analyzing", { count: files.length }),
      );
      const batch = await extractBatch(files);
      updateLastLog("done");

      // ── 阶段 2: AI 规划 ──
      phase.value = "planning";
      addLog(
        "running",
        t("copilot.execution.logs.retrieving", { query: goalText }),
      );
      // 假进度条：从 5% 缓慢爬到 ~15%，填补 HTTP → 首个 SSE 到达之间的空白
      startProgressTimer(5, 15, 8000);

      const goalInput: GoalInput = {
        text: goalText,
        locale,
        source: "manual",
      };

      const aiPlan = await fetchPlan(goalInput, batch);
      plan.value = aiPlan;

      completeLastRunning();

      // 记录计划摘要
      addLog(
        "done",
        t("copilot.execution.logs.planSummary", {
          summary: aiPlan.taskSummary,
          steps: aiPlan.steps.length,
        }),
      );

      // ── 空步骤防护：AI 返回 steps=[] 说明全部操作不支持 ──
      if (aiPlan.steps.length === 0) {
        const riskMsg = aiPlan.risks.map((r) => r.message).join("; ");
        const fallbackMsg = t
          ? t("apiEvents.SERVER_ERROR.UNSUPPORTED_OPERATION")
          : "Unsupported operation";
        errorMessage.value = riskMsg || fallbackMsg;

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
    stopProgressTimer();
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
