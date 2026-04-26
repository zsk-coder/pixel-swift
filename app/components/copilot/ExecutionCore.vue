<script setup lang="ts">
/**
 * ExecutionCore — Workflow Copilot 执行引擎组件
 * 接收用户上传的文件和意图，驱动 useWorkflowCopilot 执行完整流程
 * 实时展示日志、进度、结果下载
 */
import type { LogEntry } from "~/composables/useWorkflowCopilot";

const { t, locale } = useI18n();
const localePath = useLocalePath();

const props = defineProps<{
  intent?: string;
  files: File[];
}>();

const emit = defineEmits<{
  reset: [];
}>();

// ── 核心编排 ──
const {
  phase,
  plan,
  logs,
  progress,
  errorMessage,
  resultFiles,
  run,
  downloadResults,
  reset,
} = useWorkflowCopilot();

// 组件挂载后自动启动执行流程
const intentText = computed(() => props.intent || "Prepare for Shopify");

onMounted(() => {
  if (props.files.length > 0) {
    run(props.files, intentText.value, locale.value);
  }
});

// ── 操作 ──
function handleNewWorkflow() {
  reset();
  emit("reset");
}

async function handleDownload() {
  await downloadResults();
}

function handleRetry() {
  if (props.files.length > 0) {
    run(props.files, intentText.value, locale.value);
  }
}

// ── 日志滚动 ──
const logContainer = ref<HTMLDivElement>();
watch(
  () => logs.value.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  },
);

// ── 日志条目样式 ──
function getLogIcon(status: LogEntry["status"]) {
  switch (status) {
    case "done":
      return "check_circle";
    case "running":
      return "sync";
    case "pending":
      return "schedule";
    case "error":
      return "error";
    case "warning":
      return "info";
  }
}

function getLogIconClass(status: LogEntry["status"]) {
  switch (status) {
    case "done":
      return "text-success";
    case "running":
      return "text-primary animate-spin";
    case "pending":
      return "text-text-secondary dark:text-slate-500";
    case "error":
      return "text-red-500";
    case "warning":
      return "text-warning";
  }
}




// ── 进度条控制 ──
const progressWidth = computed(() => `${progress.value}%`);
</script>

<template>
  <div
    class="w-full max-w-5xl mx-auto space-y-6 lg:space-y-8 animate-[fadeIn_0.5s_ease-out]"
  >
    <!-- 目标文本 -->
    <div class="flex justify-center mb-2 lg:mb-4">
      <p
        class="text-text-secondary dark:text-slate-400 text-xs lg:text-sm italic border-l-2 border-surface-border dark:border-dark-border pl-3"
      >
        {{ t("copilot.execution.objectiveApplied", { intent: intentText }) }}
      </p>
    </div>

    <!-- 处理进度卡片 -->
    <section
      class="bg-surface dark:bg-dark-card rounded-card shadow-low border border-surface-border/50 dark:border-dark-border/50 p-6 sm:p-8 hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-[20px]"
              >settings_b_roll</span
            >
          </div>
          <div>
            <h2 class="font-bold text-xl text-text-primary dark:text-white">
              {{ t("copilot.execution.processingWorkflow") }}
            </h2>
            <p class="text-sm text-text-secondary dark:text-slate-400">
              {{ t("copilot.execution.processingDesc") }}
            </p>
          </div>
        </div>
        <!-- 阶段状态标签 -->
        <div v-if="phase !== 'idle'" class="flex items-center gap-2">
          <span
            v-if="phase === 'done'"
            class="text-sm font-medium text-success flex items-center gap-1"
          >
            <span
              class="material-symbols-outlined text-[16px]"
              :style="{ fontVariationSettings: '\'FILL\' 1' }"
              >check_circle</span
            >
            {{ t("copilot.execution.allDone") }}
          </span>
          <span
            v-else-if="phase === 'error'"
            class="text-sm font-medium text-red-500 flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px]">error</span>
            {{ t("copilot.execution.errorLabel") }}
          </span>
          <span
            v-else-if="phase === 'unsupported'"
            class="text-sm font-medium text-warning flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px]">info</span>
            {{ t("copilot.execution.unsupportedNotice", "Notice") }}
          </span>
          <span
            v-else
            class="text-sm font-medium text-primary flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px] animate-spin"
              >sync</span
            >
            {{ progress }}%
          </span>
        </div>
      </div>

      <!-- 进度条 -->
      <div
        class="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
      >
        <div
          class="h-full rounded-full relative transition-all duration-500 ease-out"
          :class="[
            phase === 'error'
              ? 'bg-red-500'
              : phase === 'unsupported'
                ? 'bg-warning'
                : 'bg-primary',
          ]"
          :style="{ width: progressWidth }"
        >
          <div
            v-if="
              phase !== 'error' && phase !== 'unsupported' && phase !== 'done'
            "
            class="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-50"
          />
        </div>
      </div>
    </section>

    <!-- 详细状态区 -->
    <section class="space-y-4">
      <!-- AI 计划生成概要（仅在 plan 就绪后展示） -->
      <div
        v-if="plan"
        class="bg-surface dark:bg-dark-card rounded-card shadow-low border border-surface-border/50 dark:border-dark-border/50 overflow-hidden group hover:shadow-md transition-shadow"
      >
        <div
          class="p-4 sm:px-6 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30"
        >
          <div
            class="flex items-center gap-4 text-text-primary dark:text-white"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :class="
                phase === 'unsupported'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-success/10 text-success'
              "
            >
              <span class="material-symbols-outlined text-sm">{{
                phase === "unsupported" ? "info" : "check"
              }}</span>
            </div>
            <span class="font-medium text-sm">
              <strong class="mr-1.5"
                >{{ t("copilot.execution.pipelineGenerated") }}:</strong
              >
              <span class="font-normal">{{ plan.taskSummary }}</span>
            </span>
          </div>
          <span class="text-xs text-text-secondary dark:text-slate-400">
            {{
              t("copilot.execution.planConfidence", {
                score: ((plan.confidence || 0) * 100).toFixed(0) + "%",
              })
            }}
          </span>
        </div>
      </div>

      <!-- 执行步骤列表 -->
      <div
        class="bg-surface dark:bg-dark-card rounded-card shadow-low border border-surface-border/50 dark:border-dark-border/50 overflow-hidden min-h-[320px] flex flex-col"
      >
        <!-- 头部 -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-surface-border/50 dark:border-dark-border/50"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="material-symbols-outlined text-primary text-[20px]"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >checklist</span
            >
            <span class="font-semibold text-sm text-text-primary dark:text-white">
              {{ t("copilot.execution.executionCore") }}
            </span>
          </div>
          <!-- 步骤计数器 -->
          <span
            v-if="logs.length > 0"
            class="text-xs font-medium text-text-secondary dark:text-slate-400 tabular-nums"
          >
            {{ logs.filter((l) => l.status === 'done').length }}/{{ logs.length }}
          </span>
        </div>

        <!-- 步骤内容 -->
        <div
          ref="logContainer"
          class="px-6 py-4 flex-1 overflow-y-auto"
        >
          <!-- 空状态 -->
          <div
            v-if="logs.length === 0"
            class="flex flex-col items-center justify-center h-full gap-3 opacity-40"
          >
            <span
              class="material-symbols-outlined text-3xl"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >hourglass_empty</span
            >
            <span class="text-sm text-text-secondary dark:text-slate-400">{{ t("copilot.execution.waiting") }}</span>
          </div>

          <!-- 步骤列表 -->
          <div class="space-y-1">
            <div
              v-for="(log, idx) in logs"
              :key="idx"
              :class="[
                'flex items-center gap-3 px-1 py-2.5 rounded-lg text-sm transition-all duration-300',
              ]"
            >
              <!-- 状态图标 -->
              <span
                class="material-symbols-outlined text-[18px] shrink-0"
                :class="getLogIconClass(log.status)"
                :style="log.status === 'done' ? 'font-variation-settings: \'FILL\' 1' : ''"
                >{{ getLogIcon(log.status) }}</span
              >
              <!-- 消息文本 -->
              <span
                :class="[
                  'flex-1',
                  log.status === 'running'
                    ? 'text-primary dark:text-primary-100 font-medium'
                    : log.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : log.status === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-text-secondary dark:text-slate-400',
                ]"
              >
                {{ log.message }}
              </span>
              <!-- 耗时徽章 -->
              <span
                v-if="log.duration"
                class="text-[11px] font-medium text-text-secondary/60 dark:text-slate-500 tabular-nums shrink-0"
              >
                {{ log.duration }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <!-- 配合配额耗尽显示升级按钮 -->
        <NuxtLink
          v-if="phase === 'error' && errorMessage === t('apiEvents.QUOTA_EXHAUSTED.UPGRADE_REQUIRED')"
          :to="localePath('/pricing')"
          class="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] hover:bg-primary-dark active:scale-95"
        >
          <span class="material-symbols-outlined text-[18px]">verified</span>
          {{ t('pricing.pro.cta') }}
        </NuxtLink>

        <!-- 错误/不支持 重试 -->
        <el-button
          v-else-if="phase === 'error' || phase === 'unsupported'"
          :type="phase === 'error' ? 'danger' : 'warning'"
          size="large"
          plain
          @click="handleRetry"
        >
          <span class="material-symbols-outlined text-[18px] mr-1"
            >refresh</span
          >
          {{ t("copilot.execution.retry") }}
        </el-button>

        <el-button
          size="large"
          @click="handleNewWorkflow"
          :disabled="
            phase !== 'done' && phase !== 'error' && phase !== 'unsupported'
          "
        >
          <span class="material-symbols-outlined text-[18px] mr-1">add</span>
          {{ t("copilot.execution.newWorkflow") }}
        </el-button>

        <el-button
          type="primary"
          size="large"
          @click="handleDownload"
          :disabled="phase !== 'done' || resultFiles.length === 0"
        >
          <span class="material-symbols-outlined text-[18px] mr-1"
            >download</span
          >
          {{ t("copilot.execution.downloadAll") }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 不确定进度时的左右摆动动画 */
@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
