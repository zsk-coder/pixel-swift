<script setup lang="ts">
/**
 * Workflow Copilot 正式首页
 * 设计基于 Lumina Velocity Design System
 * 功能：Hero 展示 + 输入素材预览 + AI 处理意图配置
 */

import FileUploader from "~/components/common/FileUploader.vue";
import ExecutionCore from "~/components/copilot/ExecutionCore.vue";
import { useFileDialog } from "@vueuse/core";

const { t } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();

// ── SEO ──
useHead({ title: t("seo.copilot.title") });
useSeoMeta({
  description: t("seo.copilot.description"),
  ogTitle: t("seo.copilot.title"),
  ogDescription: t("seo.copilot.description"),
});

// ── Upload State ──
const uploadedFiles = ref<File[]>([]);
const thumbnailUrls = ref<string[]>([]);
const hasFiles = computed(() => uploadedFiles.value.length > 0);

function handleFiles(files: File[]) {
  // Append new files selectively relying on size+name as pseudo-ID to prevent duplicates
  const newFiles = files.filter(
    (f) =>
      !uploadedFiles.value.some(
        (existing) => existing.name === f.name && existing.size === f.size,
      ),
  );

  if (newFiles.length === 0) return;

  const combined = [...uploadedFiles.value, ...newFiles];
  uploadedFiles.value = combined;

  // Append new Object URLs
  const newUrls = newFiles.map((f) => URL.createObjectURL(f));
  thumbnailUrls.value = [...thumbnailUrls.value, ...newUrls];
}

function handleClearFiles() {
  thumbnailUrls.value.forEach((url) => URL.revokeObjectURL(url));
  uploadedFiles.value = [];
  thumbnailUrls.value = [];
}

const { open: openFileDialog, onChange: onFileDialogChange } = useFileDialog({
  accept: "image/jpeg,image/png,image/webp,image/avif",
  multiple: true,
});

onFileDialogChange((files) => {
  if (files && files.length > 0) {
    handleFiles(Array.from(files));
  }
});

// Clean up on unmount
onUnmounted(() => {
  thumbnailUrls.value.forEach((url) => URL.revokeObjectURL(url));
});

// ── 统计数据（从真实文件推导） ──
const imageCount = computed(() => uploadedFiles.value.length);
const extraCount = computed(() => Math.max(0, imageCount.value - 7));
const totalSizeStr = computed(() => {
  const bytes = uploadedFiles.value.reduce((acc, f) => acc + f.size, 0);
  if (bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
});

// ── 目标文本（限制 500 字符，控制 token 消耗） ──
const GOAL_MAX_LEN = 500;
const goalText = ref("");

// ── 建议标签组（仅展示当前已支持的能力） ──
const suggestions = computed(() => [
  {
    icon: "compress",
    label: t("copilot.suggestions.compressWeb"),
  },
  {
    icon: "swap_horiz",
    label: t("copilot.suggestions.convertWebp"),
  },
  {
    icon: "aspect_ratio",
    label: t("copilot.suggestions.resize800"),
  },
]);

// 点击建议标签，将文本追加到输入框
function appendSuggestion(label: string) {
  goalText.value += (goalText.value ? ", " : "") + label;
}

// ── Execution State ──
const isExecuting = ref(false);
// 必须同时有文件和自然语言描述才允许生成计划
const canGenerate = computed(() => hasFiles.value && goalText.value.trim().length > 0);

function handleGenerate() {
  if (!canGenerate.value) return;
  // 未登录用户跳转登录页，登录后自动回跳
  if (!user.value) {
    navigateTo(localePath("/login?returnTo=/workflow-copilot"));
    return;
  }
  isExecuting.value = true;
}

function handleReset() {
  isExecuting.value = false;
  handleClearFiles();
  goalText.value = "";
}
</script>

<template>
  <div class="relative min-h-[70vh] overflow-x-hidden">
    <!-- ── 背景渐变光晕 ── -->
    <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        class="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-primary-100 opacity-20 blur-[120px]"
      />
      <div
        class="absolute top-[40%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-purple-100 opacity-20 blur-[100px]"
      />
    </div>

    <!-- ── Main Content ── -->
    <main class="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 lg:py-16">
      <!-- Hero Section -->
      <section
        class="w-full max-w-4xl mx-auto flex flex-col items-center text-center mb-12 lg:mb-16 space-y-5"
      >
        <h1
          class="text-4xl sm:text-5xl lg:text-[60px] font-black tracking-[-0.05em] leading-[1.1] text-text-primary dark:text-white text-balance"
        >
          {{ t("copilot.hero.title") }}
          <span
            class="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600"
            >{{ t("copilot.hero.titleHighlight") }}</span
          >
        </h1>
        <p
          class="text-base font-normal text-text-secondary dark:text-slate-400 max-w-2xl leading-relaxed"
        >
          {{ t("copilot.hero.desc") }}
        </p>
      </section>

      <!-- ── Dynamic Content Area ── -->
      <transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        leave-active-class="transition duration-300 ease-in"
        leave-to-class="opacity-0 -translate-y-4 shadow-none"
        mode="out-in"
      >
        <!-- Input State -->
        <div
          v-if="!isExecuting"
          class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 lg:items-stretch items-start w-full"
        >
          <!-- ── 左栏：Input Assets（7列） ── -->
          <div class="lg:col-span-7 flex flex-col">
            <transition
              enter-active-class="transition duration-500 ease-out"
              enter-from-class="opacity-0 translate-y-4"
              leave-active-class="transition duration-300 ease-in"
              leave-to-class="opacity-0 translate-y-4"
              mode="out-in"
            >
              <!-- ── Empty State: Upload Action ── -->
              <div
                v-if="!hasFiles"
                class="w-full flex-1 rounded-card overflow-hidden bg-[#f8fafc] dark:bg-slate-800/70 border-2 border-dashed border-slate-200 hover:border-primary/50 dark:border-dark-border cursor-pointer transition-colors duration-300"
              >
                <FileUploader
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  :max-size="50"
                  :max-count="50"
                  :multiple="true"
                  @files="handleFiles"
                />
              </div>

              <!-- ── Filled State: Assets Grid ── -->
              <div
                v-else
                class="bg-surface dark:bg-dark-card rounded-card p-6 md:p-8 transition-all duration-300 hover:shadow-low"
              >
                <!-- 标题栏 -->
                <div class="flex items-center justify-between mb-6">
                  <h2
                    class="text-xl font-bold text-text-primary dark:text-white"
                  >
                    {{ t("copilot.assets.title") }}
                  </h2>
                  <div class="flex gap-3">
                    <button
                      @click="openFileDialog()"
                      class="text-sm font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                    >
                      <span class="material-symbols-outlined text-[18px]"
                        >add</span
                      >
                      {{ t("copilot.assets.addMore") }}
                    </button>
                    <button
                      @click="handleClearFiles"
                      class="text-sm font-medium text-text-secondary dark:text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <span class="material-symbols-outlined text-[18px]"
                        >delete</span
                      >
                      Clear
                    </button>
                  </div>
                </div>

                <!-- 摘要卡片 -->
                <div
                  class="bg-white dark:bg-slate-800 rounded-card p-4 mb-6 shadow-low border border-surface-border dark:border-dark-border flex items-center gap-4"
                >
                  <div
                    class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0"
                  >
                    <span
                      class="material-symbols-outlined text-[24px]"
                      style="font-variation-settings: &quot;FILL&quot; 1"
                      >perm_media</span
                    >
                  </div>
                  <div class="flex-grow">
                    <div
                      class="text-base font-bold text-text-primary dark:text-white"
                    >
                      {{ t("copilot.assets.uploaded", { count: imageCount }) }}
                    </div>
                    <div
                      class="text-sm text-text-secondary dark:text-slate-400 font-medium"
                    >
                      {{
                        t("copilot.assets.totalSize", { size: totalSizeStr })
                      }}
                    </div>
                  </div>
                  <div
                    class="text-right flex items-center gap-2 text-sm font-medium text-text-secondary dark:text-slate-400"
                  >
                    <span
                      class="material-symbols-outlined text-[18px] text-success"
                      style="font-variation-settings: &quot;FILL&quot; 1"
                      >check_circle</span
                    >
                    {{ t("copilot.assets.ready") }}
                  </div>
                </div>

                <!-- 缩略图网格 -->
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <!-- 前 7 张缩略图 -->
                  <div
                    v-for="(url, idx) in thumbnailUrls.slice(0, 7)"
                    :key="idx"
                    :class="[
                      'aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 relative group',
                      idx >= 4 ? 'hidden sm:block' : '',
                    ]"
                  >
                    <img
                      :src="url"
                      :alt="`Product ${idx + 1}`"
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"
                    />
                  </div>

                  <!-- "+N" 溢出指示器 -->
                  <div
                    v-if="extraCount > 0"
                    class="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 relative flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <img
                      v-if="thumbnailUrls[7]"
                      :src="thumbnailUrls[7]"
                      alt="More products"
                      class="w-full h-full object-cover opacity-40"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center"
                    >
                      <span
                        class="text-xl font-bold text-text-primary dark:text-white"
                      >
                        {{ t("copilot.assets.more", { count: extraCount }) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <!-- ── 右栏：Processing Intent（5列） ── -->
          <div
            class="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-[100px]"
          >
            <div
              class="bg-[#FBFCFF] dark:bg-dark-card rounded-card p-5 md:p-6 flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-surface-border/50 dark:border-dark-border/50"
            >
              <h2
                class="text-xl font-bold text-text-primary dark:text-white mb-2"
              >
                {{ t("copilot.intent.title") }}
              </h2>
              <p class="text-sm text-text-secondary dark:text-slate-400 mb-6">
                {{ t("copilot.intent.desc") }}
              </p>

              <!-- 输入区域（Floating Label） -->
              <div class="relative group mb-8">
                <label
                  class="absolute -top-2.5 left-4 px-1 bg-surface dark:bg-dark-card text-xs font-medium text-primary z-10"
                  for="copilot-intent-input"
                >
                  {{ t("copilot.intent.label") }}
                </label>
                <textarea
                  id="copilot-intent-input"
                  v-model="goalText"
                  :maxlength="GOAL_MAX_LEN"
                  style="outline: none"
                  class="w-full rounded-xl bg-white dark:bg-slate-800 border-2 border-primary/50 px-4 py-4 pb-8 text-base text-text-primary dark:text-white font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all duration-200 placeholder:text-slate-400"
                  :placeholder="t('copilot.intent.placeholder')"
                  rows="4"
                />
                <!-- 底部栏：字符计数 + AI Sparkle -->
                <div
                  class="absolute bottom-3 right-3 flex items-center gap-2"
                >
                  <span
                    v-if="goalText.length > 0"
                    :class="[
                      'text-[11px] font-medium tabular-nums transition-colors',
                      goalText.length >= GOAL_MAX_LEN
                        ? 'text-red-500'
                        : goalText.length >= GOAL_MAX_LEN * 0.8
                          ? 'text-amber-500'
                          : 'text-slate-400',
                    ]"
                  >
                    {{ goalText.length }}/{{ GOAL_MAX_LEN }}
                  </span>
                  <span
                    class="material-symbols-outlined text-[18px] text-primary animate-pulse"
                    style="font-variation-settings: &quot;FILL&quot; 1"
                    >auto_awesome</span
                  >
                </div>
              </div>

              <!-- 建议标签（Chips） -->
              <div class="mb-8">
                <div
                  class="text-xs font-medium text-text-secondary dark:text-slate-400 mb-3 uppercase tracking-wider"
                >
                  {{ t("copilot.suggestions.title") }}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="chip in suggestions"
                    :key="chip.label"
                    class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-surface-border dark:border-dark-border text-sm font-medium text-text-secondary dark:text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                    @click="appendSuggestion(chip.label)"
                  >
                    <span class="material-symbols-outlined text-[16px]">{{
                      chip.icon
                    }}</span>
                    {{ chip.label }}
                  </button>
                </div>
              </div>

              <!-- Generate 按钮 -->
              <div
                class="mt-auto pt-6 border-t border-surface-border/50 dark:border-dark-border/50"
              >
                <button
                  @click="handleGenerate"
                  :disabled="!canGenerate"
                  :class="[
                    'w-full text-white rounded-xl px-6 py-3 font-bold text-base flex justify-center items-center gap-2 transition-all duration-300 shadow-[0_8px_16px_rgba(37,99,235,0.2)] group',
                    canGenerate
                      ? 'bg-primary hover:bg-primary-dark hover:scale-[1.02] active:scale-95'
                      : 'bg-primary/50 cursor-not-allowed opacity-70',
                  ]"
                >
                  <span
                    class="material-symbols-outlined text-[20px]"
                    style="font-variation-settings: &quot;FILL&quot; 1"
                    >account_tree</span
                  >
                  {{ t("copilot.generate") }}
                </button>
                <p
                  class="text-xs text-center text-text-secondary dark:text-slate-400 mt-3"
                >
                  {{ t("copilot.generateHint") }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Execution State -->
        <ExecutionCore
          v-else
          :intent="goalText"
          :files="uploadedFiles"
          @reset="handleReset"
        />
      </transition>
    </main>
  </div>
</template>

<style scoped>
/* 页面进入动画 */
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
main > section:first-child {
  animation: fadeIn 0.5s ease-out;
}

/* Copilot 页面定制：隐藏 FileUploader 的虚线边框和蓝色按钮，背景透明 */
.file-uploader :deep(.el-upload-dragger) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
.file-uploader :deep(.el-upload-dragger .hidden.md\:flex) {
  display: none !important;
}
</style>
