<script setup lang="ts">
import type { FileItem } from "~/components/common/FileList.vue";

const { t } = useI18n();

useHead({
  title: t("seo.compressor.title"),
  meta: [
    { name: "description", content: t("seo.compressor.description") },
    { property: "og:title", content: t("seo.compressor.title") },
    { property: "og:description", content: t("seo.compressor.description") },
    { property: "og:type", content: "website" },
  ],
});

// ─── Settings (shared across modes) ─────────────
const quality = ref(80);

const activePreset = ref(80);

const presets = computed(() => [
  {
    label: t("compressor.presets.extreme"),
    hint: t("compressor.presets.extremeHint"),
    value: 30,
  },
  {
    label: t("compressor.presets.recommended"),
    hint: t("compressor.presets.recommendedHint"),
    value: 60,
  },
  {
    label: t("compressor.presets.light"),
    hint: t("compressor.presets.lightHint"),
    value: 80,
  },
  {
    label: t("compressor.presets.lossless"),
    hint: t("compressor.presets.losslessHint"),
    value: 95,
  },
]);

// ─── Batch State ────────────────────────────────
const rawFiles = ref<File[]>([]);
const processedBlobs = ref<Map<string, Blob>>(new Map());
const fileItems = ref<FileItem[]>([]);
const isBusy = ref(false);

// ─── Single-file comparison state ───────────────
const originalPreview = ref("");
const compressedPreview = ref("");
const originalSize = ref(0);
const compressedSize = ref(0);
const originalWidth = ref(0);
const originalHeight = ref(0);
const originalFormat = ref("");

// ─── Batch detail comparison state ──────────────
const selectedFileId = ref<string | null>(null);
const compressedPreviews = ref<Map<string, string>>(new Map());

// ─── Computed ───────────────────────────────────
const hasFiles = computed(() => fileItems.value.length > 0);
const isSingleMode = computed(() => fileItems.value.length === 1);
const isBatchMode = computed(() => fileItems.value.length > 1);
const allDone = computed(
  () => hasFiles.value && fileItems.value.every((f) => f.status === "done"),
);

const singleDone = computed(
  () => isSingleMode.value && fileItems.value[0]?.status === "done",
);

const savingsPercent = computed(() => {
  if (!originalSize.value || !compressedSize.value) return 0;
  return Math.round(
    ((originalSize.value - compressedSize.value) / originalSize.value) * 100,
  );
});

// Batch totals
const totalSavings = computed(() => {
  let savings = 0;
  for (const item of fileItems.value) {
    if (item.status === "done" && item.processedSize) {
      savings += item.originalSize - item.processedSize;
    }
  }
  return savings;
});

const totalSavingsPercent = computed(() => {
  let totalOrig = 0;
  let totalProc = 0;
  for (const item of fileItems.value) {
    if (item.status === "done" && item.processedSize) {
      totalOrig += item.originalSize;
      totalProc += item.processedSize;
    }
  }
  if (!totalOrig) return 0;
  return Math.round(((totalOrig - totalProc) / totalOrig) * 100);
});



// Selected file for batch detail view
const selectedFile = computed(() => {
  if (!selectedFileId.value) return null;
  return fileItems.value.find((f) => f.id === selectedFileId.value) || null;
});

const selectedOriginalPreview = computed(() => {
  if (!selectedFile.value) return "";
  return selectedFile.value.preview || "";
});

const selectedCompressedPreview = computed(() => {
  if (!selectedFileId.value) return "";
  return compressedPreviews.value.get(selectedFileId.value) || "";
});

const selectedOriginalSize = computed(() => selectedFile.value?.originalSize || 0);
const selectedCompressedSize = computed(
  () => selectedFile.value?.processedSize || 0,
);
const selectedSavingsPercent = computed(() => {
  if (!selectedOriginalSize.value || !selectedCompressedSize.value) return 0;
  return Math.round(
    ((selectedOriginalSize.value - selectedCompressedSize.value) /
      selectedOriginalSize.value) *
      100,
  );
});

// ─── Helpers ────────────────────────────────────
const { processImage } = useImageProcessor();
const { downloadFile, downloadAsZip, generateFileName, generateZipName } =
  useDownload();


function formatSize(bytes: number): string {
  if (bytes < 0) bytes = 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectFormat(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  if (["png", "webp", "jpg", "jpeg"].includes(ext))
    return ext === "jpeg" ? "jpg" : ext;
  return "jpg";
}

function getActualFormat(originalName: string): string {
  return detectFormat(originalName);
}

// ─── Actions ────────────────────────────────────
// ElUpload on-change fires ONCE PER FILE, so selecting 7 files
// calls onFilesAdded 7 times with 1 file each. We must defer
// mode detection until all files in the batch have been collected.
let pendingModeCheck: ReturnType<typeof setTimeout> | null = null;

function onFilesAdded(newFiles: File[]) {
  // Add files to the list
  newFiles.forEach((file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    rawFiles.value.push(file);
    fileItems.value.push({
      id,
      name: file.name,
      originalSize: file.size,
      status: "pending",
      progress: 0,
      preview: URL.createObjectURL(file), // Used for batch list thumbnails
    });
  });

  // Defer mode decision — wait for all on-change events to finish
  if (pendingModeCheck) clearTimeout(pendingModeCheck);
  pendingModeCheck = setTimeout(() => {
    pendingModeCheck = null;
    afterAllFilesAdded();
  }, 100);
}

async function afterAllFilesAdded() {
  // Safety check
  if (fileItems.value.length === 0) return;

  // Multiple files → stay in batch mode, no auto-process
  if (fileItems.value.length > 1) {
    // If first file was somehow processed (e.g. user added file after single mode), reset it
    const first = fileItems.value[0];
    if (first && first.status === "done") {
      first.status = "pending";
      first.progress = 0;
      first.processedSize = undefined;
      processedBlobs.value.delete(first.id);
    }
    // Clear single-mode comparison state
    if (compressedPreview.value && compressedPreview.value !== originalPreview.value) {
      URL.revokeObjectURL(compressedPreview.value);
    }
    originalPreview.value = "";
    compressedPreview.value = "";
    compressedSize.value = 0;
    return;
  }

  // Exactly 1 file → single mode, auto-compress with comparison
  if (fileItems.value.length === 1) {
    const file = rawFiles.value[0];
    if (!file) {
      console.error("No file found in rawFiles");
      return;
    }
    
    // Set up single mode preview
    originalSize.value = file.size;
    originalFormat.value = detectFormat(file.name);
    originalPreview.value = URL.createObjectURL(file);

    try {
      const img = await createImageBitmap(file);
      originalWidth.value = img.width;
      originalHeight.value = img.height;
      
      // Start compression
      await doSingleCompress();
    } catch (e) {
      console.error("Failed to load image for comparison:", e);
      // Even if createImageBitmap fails, we created originalPreview URL above
      // so user should see the image.
    }
  }
}

// Single-file compress with comparison
let pendingRecompress = false;

async function doSingleCompress() {
  if (!rawFiles.value[0]) return;

  // If already compressing, queue a re-compress after current finishes
  if (isBusy.value) {
    pendingRecompress = true;
    return;
  }

  isBusy.value = true;
  pendingRecompress = false;
  const item = fileItems.value[0];
  // Only show "processing" state on first compress; during re-compress
  // keep "done" so the CompareSlider stays visible with the old preview
  const isRecompress = item?.status === "done";
  if (item && !isRecompress) item.status = "processing";

  try {
    const file = rawFiles.value[0];
    const fmt = getActualFormat(file.name);
    const result = await processImage(file, {
      action: "compress",
      outputFormat: fmt as "jpg" | "png" | "webp",
      quality: quality.value,
    });

    // Save old URL for deferred revocation
    const oldPreview = compressedPreview.value;

    if (result.processedSize >= file.size) {
      processedBlobs.value.set(item!.id, file);
      compressedSize.value = file.size;
      compressedPreview.value = originalPreview.value;
      if (item) item.processedSize = file.size;
    } else {
      processedBlobs.value.set(item!.id, result.blob);
      compressedSize.value = result.processedSize;
      compressedPreview.value = URL.createObjectURL(result.blob);
      if (item) item.processedSize = result.processedSize;
    }

    // Revoke old preview AFTER the new one is set (avoid flash)
    if (oldPreview && oldPreview !== originalPreview.value && oldPreview !== compressedPreview.value) {
      URL.revokeObjectURL(oldPreview);
    }

    if (item) {
      item.width = result.width;
      item.height = result.height;
      item.status = "done";
      item.progress = 100;
    }
  } catch {
    if (item) item.status = "error";
  } finally {
    isBusy.value = false;
    // If a re-compress was requested while we were busy, run it now
    if (pendingRecompress) {
      pendingRecompress = false;
      doSingleCompress();
    }
  }
}

// Batch process all pending files
async function onBatchProcess() {
  if (!hasFiles.value || isBusy.value) return;
  isBusy.value = true;

  for (let i = 0; i < fileItems.value.length; i++) {
    const item = fileItems.value[i];
    if (!item || item.status === "done") continue;

    item.status = "processing";
    item.progress = 0;

    try {
      const file = rawFiles.value[i];
      if (!file) continue;

      const fmt = getActualFormat(file.name);
      const result = await processImage(file, {
        action: "compress",
        outputFormat: fmt as "jpg" | "png" | "webp",
        quality: quality.value,
      });

      if (result.processedSize >= file.size) {
        processedBlobs.value.set(item.id, file);
        item.processedSize = file.size;
      } else {
        processedBlobs.value.set(item.id, result.blob);
        item.processedSize = result.processedSize;
        // Store compressed preview for detail view
        compressedPreviews.value.set(
          item.id,
          URL.createObjectURL(result.blob),
        );
      }
      item.width = result.width;
      item.height = result.height;
      item.status = "done";
      item.progress = 100;
    } catch {
      item.status = "error";
      item.error = t("errors.processFailed");
    }
  }


  isBusy.value = false;
}

function onDownloadSingle() {
  if (!processedBlobs.value.size || !rawFiles.value[0]) return;
  const item = fileItems.value[0];
  if (!item) return;
  const blob = processedBlobs.value.get(item.id);
  if (!blob) return;
  const fmt = getActualFormat(item.name);
  downloadFile(blob, generateFileName(item.name, "compress", { format: fmt }));
}

function onDownload(id: string) {
  const item = fileItems.value.find((f) => f.id === id);
  const blob = processedBlobs.value.get(id);
  if (!item || !blob) return;
  const fmt = getActualFormat(item.name);
  downloadFile(blob, generateFileName(item.name, "compress", { format: fmt }));
}

async function onDownloadAll() {
  const zipFiles: Array<{ blob: Blob; name: string }> = [];
  for (const item of fileItems.value) {
    const blob = processedBlobs.value.get(item.id);
    if (blob) {
      const fmt = getActualFormat(item.name);
      zipFiles.push({
        blob,
        name: generateFileName(item.name, "compress", { format: fmt }),
      });
    }
  }
  if (zipFiles.length > 0) {
    await downloadAsZip(zipFiles, generateZipName("compress"));
  }
}

function onRemove(id: string) {
  const idx = fileItems.value.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const item = fileItems.value[idx];
  if (item?.preview) URL.revokeObjectURL(item.preview);
  const cp = compressedPreviews.value.get(id);
  if (cp) URL.revokeObjectURL(cp);
  compressedPreviews.value.delete(id);
  processedBlobs.value.delete(id);
  fileItems.value.splice(idx, 1);
  rawFiles.value.splice(idx, 1);
  if (selectedFileId.value === id) selectedFileId.value = null;
}

function startOver() {
  // Revoke all URLs
  if (originalPreview.value) URL.revokeObjectURL(originalPreview.value);
  if (compressedPreview.value && compressedPreview.value !== originalPreview.value)
    URL.revokeObjectURL(compressedPreview.value);
  for (const item of fileItems.value) {
    if (item?.preview) URL.revokeObjectURL(item.preview);
  }
  for (const url of compressedPreviews.value.values()) {
    URL.revokeObjectURL(url);
  }

  // Reset all
  rawFiles.value = [];
  fileItems.value = [];
  processedBlobs.value.clear();
  compressedPreviews.value.clear();
  originalPreview.value = "";
  compressedPreview.value = "";
  originalSize.value = 0;
  compressedSize.value = 0;
  originalWidth.value = 0;
  originalHeight.value = 0;
  originalFormat.value = "";
  quality.value = 80;
  activePreset.value = 80;

  selectedFileId.value = null;
}

function onClearAll() {
  startOver();
}

let fromPreset = false;

function selectPreset(value: number) {
  fromPreset = true;
  quality.value = value;
  activePreset.value = value;
  // In single mode, re-compress immediately
  if (isSingleMode.value && singleDone.value) doSingleCompress();
}

// Watch quality changes — re-compress in single mode (debounced)
let qualityTimer: ReturnType<typeof setTimeout>;
watch(quality, () => {
  if (fromPreset) {
    fromPreset = false;
    return;
  }
  activePreset.value = -1;
  if (!isSingleMode.value || !singleDone.value) return;
  clearTimeout(qualityTimer);
  qualityTimer = setTimeout(() => doSingleCompress(), 500);
});



// Select a file for detail comparison in batch mode
function selectFile(id: string) {
  selectedFileId.value = selectedFileId.value === id ? null : id;
}

// Actual output format label
const actualOutputFormat = computed(() => {
  return originalFormat.value || "jpg";
});
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center w-full px-4 py-6 md:py-8 lg:px-8"
  >
    <div class="w-full max-w-[1024px] flex flex-col gap-6 md:gap-8">
      <!-- Hero -->
      <div class="text-center max-w-2xl mx-auto mb-2 md:mb-4">
        <h1
          class="text-2xl md:text-3xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3"
        >
          {{ t("compressor.title") }}
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg hidden md:block">
          {{ t("compressor.subtitle") }}
        </p>
        <p class="text-slate-500 dark:text-slate-400 text-sm md:hidden">
          {{ t("compressor.subtitleMobile") }}
        </p>
      </div>

      <!-- ================== UPLOAD STATE ================== -->
      <div v-if="!hasFiles">
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          :hint="t('compressor.uploadHint')"
          @files="onFilesAdded"
        />
      </div>

      <!-- ================== SINGLE FILE: COMPARISON MODE ================== -->
      <template v-if="isSingleMode">
        <!-- ===== DESKTOP (lg+) ===== -->
        <div class="hidden lg:grid grid-cols-12 gap-6 items-start">
          <!-- Left: CompareSlider (8 col) -->
          <div class="col-span-8 flex flex-col gap-4">
            <!-- Comparison Container -->
            <div
              class="relative w-full max-h-[600px] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
            >
              <template v-if="singleDone && compressedPreview">
                <CompareSlider
                  :original-src="originalPreview"
                  :compressed-src="compressedPreview"
                  :original-label="t('compressor.original')"
                  :compressed-label="t('compressor.compressed')"
                  max-height="600px"
                  class="!rounded-none"
                />
              </template>
              <template v-else>
                <div class="absolute inset-0 flex items-center justify-center">
                  <img
                    v-if="originalPreview"
                    :src="originalPreview"
                    class="max-w-full max-h-full object-contain"
                    alt="original"
                  />
                  <div
                    v-if="isBusy"
                    class="absolute inset-0 bg-black/30 flex items-center justify-center"
                  >
                    <div
                      class="bg-white dark:bg-slate-800 rounded-lg px-6 py-3 shadow-lg flex items-center gap-3"
                    >
                      <span
                        class="material-symbols-outlined text-primary animate-spin"
                        >progress_activity</span
                      >
                      <span class="text-sm font-medium">{{
                        t("compressor.compressing")
                      }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Stats Bar -->
            <div class="grid grid-cols-2 gap-4">
              <div
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex flex-col"
              >
                <span
                  class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1"
                  >{{ t("compressor.originalFile") }}</span
                >
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-xl font-bold text-slate-900 dark:text-white"
                    >{{ formatSize(originalSize) }}</span
                  >
                  <span class="text-xs text-slate-400"
                    >{{ originalWidth }} × {{ originalHeight }}px</span
                  >
                </div>
              </div>
              <div
                class="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-4 rounded-lg flex flex-col relative overflow-hidden"
              >
                <div
                  v-if="singleDone && savingsPercent > 0"
                  class="absolute right-0 top-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg"
                >
                  -{{ savingsPercent }}%
                </div>
                <span
                  class="text-xs text-green-700 dark:text-green-400 font-medium uppercase tracking-wider mb-1"
                  >{{ t("compressor.compressedFile") }}</span
                >
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-xl font-bold text-green-700 dark:text-green-400"
                  >
                    {{ singleDone ? formatSize(compressedSize) : "—" }}
                  </span>
                  <span
                    v-if="singleDone"
                    class="text-xs text-green-600/70 dark:text-green-400/60"
                    >{{ t("compressor.readyToDownload") }}</span
                  >
                  <span v-else class="text-xs text-slate-400">{{
                    t("compressor.compressing")
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Controls (4 col) -->
          <div class="col-span-4 flex flex-col gap-6">
            <div
              class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 sticky top-24"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4"
              >
                <h3
                  class="font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-primary"
                    >tune</span
                  >
                  {{ t("compressor.settings") }}
                </h3>
                <button
                  class="text-xs font-medium text-slate-500 hover:text-primary transition-colors"
                  @click="startOver"
                >
                  {{ t("compressor.reset") }}
                </button>
              </div>

              <!-- Quality Slider -->
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <label
                    class="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >{{ t("compressor.quality") }}</label
                  >
                  <span
                    class="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded"
                    >{{ quality }}%</span
                  >
                </div>
                <ElSlider
                  v-model="quality"
                  :min="1"
                  :max="100"
                  :show-tooltip="true"
                  :format-tooltip="(val: number) => `${val}%`"
                />
                <div
                  class="flex justify-between text-[10px] text-slate-400 uppercase font-medium"
                >
                  <span>{{ t("compressor.lowSize") }}</span>
                  <span>{{ t("compressor.highQuality") }}</span>
                </div>
              </div>

              <!-- Presets -->
              <div class="space-y-3">
                <label
                  class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >{{ t("compressor.compressionLevel") }}</label
                >
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="preset in presets"
                    :key="preset.value"
                    class="px-3 py-2 text-xs font-medium rounded border transition-all"
                    :class="[
                      activePreset === preset.value
                        ? 'bg-primary/10 text-primary border-primary/20 shadow-sm ring-1 ring-primary/20 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary',
                    ]"
                    @click="selectPreset(preset.value)"
                  >
                    {{ preset.label }}
                  </button>
                </div>
              </div>



              <!-- Actions -->
              <div class="pt-4 flex flex-col gap-3">
                <ElButton
                  type="primary"
                  size="large"
                  class="!w-full !h-10 !rounded-lg !text-sm !font-bold"
                  :disabled="!singleDone || isBusy"
                  @click="onDownloadSingle"
                >
                  <span class="material-symbols-outlined mr-1">download</span>
                  {{ t("compressor.downloadImage") }}
                </ElButton>
                <div class="relative py-2">
                  <div class="absolute inset-0 flex items-center">
                    <div
                      class="w-full border-t border-slate-200 dark:border-slate-700"
                    ></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span
                      class="bg-white dark:bg-slate-900 px-2 text-slate-400"
                      >or</span
                    >
                  </div>
                </div>
                <ElButton
                  class="!w-full"
                  size="large"
                  @click="startOver"
                >
                  <span class="material-symbols-outlined text-lg mr-1"
                    >restart_alt</span
                  >
                  {{ t("compressor.startOver") }}
                </ElButton>
              </div>
            </div>

            <!-- Pro Tip -->
            <div
              class="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 border border-primary/10"
            >
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-primary mt-0.5"
                  >info</span
                >
                <p
                  class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
                >
                  <strong class="text-slate-900 dark:text-white">{{
                    t("compressor.proTip")
                  }}</strong>
                  {{ t("compressor.proTipText") }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== MOBILE (<lg) ===== -->
        <div class="lg:hidden flex flex-col gap-6">
          <!-- Compare Viewer -->
          <div
            class="relative w-full max-h-[500px] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center"
          >
            <template v-if="singleDone && compressedPreview">
              <CompareSlider
                :original-src="originalPreview"
                :compressed-src="compressedPreview"
                :original-label="t('compressor.original')"
                :compressed-label="t('compressor.compressed')"
                max-height="500px"
                class="!rounded-none"
              />
              <div
                class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white z-20"
              >
                {{ formatSize(originalSize) }}
              </div>
              <div
                class="absolute bottom-3 right-3 bg-primary/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white z-20"
              >
                {{ formatSize(compressedSize) }}
              </div>
            </template>
            <template v-else>
              <div class="absolute inset-0 flex items-center justify-center">
                <img
                  v-if="originalPreview"
                  :src="originalPreview"
                  class="max-w-full max-h-full object-contain"
                  alt="original"
                />
                <div
                  v-if="isBusy"
                  class="absolute inset-0 bg-black/30 flex items-center justify-center"
                >
                  <div
                    class="bg-white dark:bg-slate-800 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2"
                  >
                    <span
                      class="material-symbols-outlined text-primary animate-spin text-lg"
                      >progress_activity</span
                    >
                    <span class="text-xs font-medium">{{
                      t("compressor.compressing")
                    }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Quality -->
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <label
                class="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <span class="material-symbols-outlined text-primary text-lg"
                  >tune</span
                >
                {{ t("compressor.quality") }}
              </label>
              <span
                class="text-sm font-bold text-primary bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded"
                >{{ quality }}%</span
              >
            </div>
            <ElSlider
              v-model="quality"
              :min="1"
              :max="100"
              :show-tooltip="true"
              :format-tooltip="(val: number) => `${val}%`"
            />
            <div
              class="flex justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wide"
            >
              <span>{{ t("compressor.lowSize") }}</span>
              <span>{{ t("compressor.highQuality") }}</span>
            </div>
          </div>

          <!-- Compression Presets (mobile) -->
          <div class="space-y-3">
            <label
              class="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-primary text-lg"
                >temp_preferences_custom</span
              >
              {{ t("compressor.compressionLevel") }}
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="preset in presets"
                :key="preset.value"
                class="flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left relative overflow-hidden"
                :class="[
                  activePreset === preset.value
                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700',
                ]"
                @click="selectPreset(preset.value)"
              >
                <div
                  v-if="activePreset === preset.value"
                  class="absolute top-0 right-0 p-[2px] bg-primary rounded-bl-lg"
                >
                  <span
                    class="material-symbols-outlined text-white text-[10px] block"
                    >check</span
                  >
                </div>
                <span
                  class="text-xs font-bold"
                  :class="
                    activePreset === preset.value
                      ? 'text-primary'
                      : 'text-slate-900 dark:text-white'
                  "
                  >{{ preset.label }}</span
                >
                <span class="text-[10px] text-slate-500 mt-1">{{
                  preset.hint
                }}</span>
              </button>
            </div>
          </div>


        </div>

        <!-- Mobile Bottom Bar (single mode) -->
        <div
          class="lg:hidden sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 pb-8 -mx-4 mt-6 z-30"
        >
          <div class="flex flex-col gap-3">
            <div
              class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              <span
                >{{ t("compressor.totalSavings") }}
                <span class="text-green-600 font-bold">{{
                  singleDone
                    ? `${formatSize(originalSize - compressedSize)} (${savingsPercent}%)`
                    : "—"
                }}</span></span
              >
              <span
                >{{ t("compressor.format") }}
                <span
                  class="font-medium text-slate-700 dark:text-slate-300"
                  >{{ actualOutputFormat.toUpperCase() }}</span
                ></span
              >
            </div>
            <button
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!singleDone || isBusy"
              @click="onDownloadSingle"
            >
              <span class="material-symbols-outlined">download</span>
              {{ t("compressor.downloadImage") }}
            </button>
            <button
              class="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              @click="startOver"
            >
              {{ t("compressor.compressAnother") }}
            </button>
          </div>
        </div>

        <!-- Desktop: Process Another (bottom upload) -->
        <div
          class="hidden lg:block w-full mt-12 border-t border-dashed border-slate-200 dark:border-slate-800 pt-8 pb-12"
        >
          <div class="flex flex-col items-center gap-6 w-full">
            <h3
              class="text-slate-400 dark:text-slate-500 text-sm font-medium uppercase tracking-widest"
            >
              {{ t("compressor.processAnother") }}
            </h3>
            <FileUploader
              class="w-full"
              accept="image/jpeg,image/png,image/webp"
              :hint="t('compressor.uploadHint')"
              @files="onFilesAdded"
            />
          </div>
        </div>
      </template>

      <!-- ================== BATCH MODE (≥2 files) ================== -->
      <template v-if="isBatchMode">
        <!-- Upload more (above settings) -->
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          :hint="t('compressor.uploadHint')"
          @files="onFilesAdded"
        />

        <!-- Settings Bar -->
        <div
          class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-6 shadow-sm"
        >
          <!-- Desktop: horizontal -->
          <div
            class="hidden md:flex items-start md:items-center justify-between gap-6"
          >
            <div class="flex flex-col gap-1 flex-shrink-0">
              <h2
                class="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white"
              >
                <span class="material-symbols-outlined text-primary"
                  >tune</span
                >
                {{ t("compressor.settings") }}
              </h2>
            </div>
            <div class="flex gap-6 flex-1 justify-end">
              <div class="flex flex-col gap-2 min-w-[240px] flex-1">
                <div class="flex justify-between items-center">
                  <label
                    class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {{ t("compressor.quality") }}
                  </label>
                  <span
                    class="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >
                    {{ quality }}%
                  </span>
                </div>
                <div class="flex items-center h-[42px]">
                  <ElSlider
                    v-model="quality"
                    :min="1"
                    :max="100"
                    :show-tooltip="true"
                    :format-tooltip="(val: number) => `${val}%`"
                  />
                </div>
              </div>

            </div>
          </div>

          <!-- Mobile: vertical -->
          <div class="md:hidden space-y-4">
            <h2
              class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ t("compressor.settings") }}
            </h2>
            <div class="grid gap-4">
              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label
                    class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {{ t("compressor.quality") }}
                  </label>
                  <span
                    class="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400"
                  >
                    {{ quality }}%
                  </span>
                </div>
                <ElSlider
                  v-model="quality"
                  :min="1"
                  :max="100"
                  :show-tooltip="true"
                  :format-tooltip="(val: number) => `${val}%`"
                />
              </div>

            </div>
          </div>

          <!-- Presets row -->
          <div
            class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700"
          >
            <label
              class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 block"
            >
              {{ t("compressor.compressionLevel") }}
            </label>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                v-for="preset in presets"
                :key="preset.value"
                class="flex flex-col items-start p-3 rounded-lg border transition-all text-left"
                :class="[
                  activePreset === preset.value
                    ? 'bg-primary/10 text-primary border-primary/20 shadow-sm ring-1 ring-primary/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary',
                ]"
                @click="selectPreset(preset.value)"
              >
                <span
                  class="text-xs font-bold"
                  :class="
                    activePreset === preset.value
                      ? 'text-primary'
                      : 'text-slate-900 dark:text-white'
                  "
                  >{{ preset.label }}</span
                >
                <span class="text-[10px] text-slate-500 mt-0.5">{{
                  preset.hint
                }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Queue -->
        <div class="flex flex-col gap-3 md:gap-4">
          <div class="flex items-center justify-between px-1">
            <h3
              class="text-sm md:text-lg font-bold uppercase md:normal-case tracking-wider md:tracking-normal text-slate-500 md:text-slate-900 dark:text-slate-400 md:dark:text-white"
            >
              {{ t("converter.queue") }} ({{ fileItems.length }})
            </h3>
            <ElButton type="danger" link @click="onClearAll">
              {{ t("converter.clearAll") }}
            </ElButton>
          </div>

          <!-- Desktop queue -->
          <div
            class="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm"
          >
            <div
              v-for="(file, idx) in fileItems"
              :key="file.id"
              class="group flex items-center gap-4 p-4 transition-colors cursor-pointer"
              :class="{
                'border-b border-slate-200 dark:border-slate-700':
                  idx < fileItems.length - 1,
                'opacity-70': file.status === 'pending',
                'bg-primary/5 dark:bg-primary/10':
                  selectedFileId === file.id,
                'hover:bg-slate-50 dark:hover:bg-slate-700/50':
                  selectedFileId !== file.id,
              }"
              @click="file.status === 'done' ? selectFile(file.id) : null"
            >
              <div
                class="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden"
                :class="{ grayscale: file.status === 'pending' }"
                @click.stop
              >
                <ElImage
                  v-if="file.preview"
                  :src="file.preview"
                  :alt="file.name"
                  fit="cover"
                  class="w-full h-full"
                  :preview-src-list="[file.preview]"
                  preview-teleported
                />
              </div>
              <div class="flex flex-col min-w-0 flex-1">
                <template v-if="file.status === 'done'">
                  <p
                    class="truncate font-semibold text-sm text-slate-900 dark:text-white"
                  >
                    {{ file.name }}
                  </p>
                  <div
                    class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span>{{ formatSize(file.originalSize) }}</span>
                    <span class="material-symbols-outlined text-[10px]"
                      >arrow_forward</span
                    >
                    <span
                      class="font-medium text-slate-900 dark:text-white"
                      >{{ formatSize(file.processedSize || 0) }}</span
                    >
                    <span
                      v-if="
                        file.processedSize &&
                        file.processedSize < file.originalSize
                      "
                      class="text-green-600 dark:text-green-400 font-medium"
                    >
                      (-{{
                        Math.round(
                          ((file.originalSize - file.processedSize) /
                            file.originalSize) *
                            100,
                        )
                      }}%)
                    </span>
                  </div>
                </template>
                <template v-else-if="file.status === 'processing'">
                  <div class="flex justify-between items-baseline mb-1">
                    <p
                      class="truncate font-semibold text-sm text-slate-900 dark:text-white"
                    >
                      {{ file.name }}
                    </p>
                    <span
                      class="text-xs font-medium text-primary flex-shrink-0 ml-2"
                    >
                      {{ t("compressor.compressing") }}
                    </span>
                  </div>
                  <ElProgress
                    :percentage="65"
                    :show-text="false"
                    :stroke-width="6"
                    :indeterminate="true"
                    :duration="2"
                  />
                </template>
                <template v-else>
                  <p
                    class="truncate font-semibold text-sm text-slate-900 dark:text-white"
                  >
                    {{ file.name }}
                  </p>
                  <div
                    class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span>{{ formatSize(file.originalSize) }}</span>
                    <span class="material-symbols-outlined text-[10px]"
                      >arrow_forward</span
                    >
                    <span>{{ t("common.pending") }}</span>
                  </div>
                </template>
              </div>
              <div class="flex items-center gap-4 md:gap-6 flex-shrink-0">
                <ElTag
                  v-if="file.status === 'done'"
                  type="success"
                  round
                  effect="light"
                >
                  <span
                    class="material-symbols-outlined text-sm mr-1"
                    style="vertical-align: -2px"
                    >check_circle</span
                  >
                  {{ t("converter.complete") }}
                </ElTag>
                <ElTag
                  v-else-if="file.status === 'processing'"
                  type="primary"
                  round
                  effect="light"
                >
                  <span
                    class="material-symbols-outlined text-sm mr-1 animate-spin"
                    style="vertical-align: -2px"
                    >progress_activity</span
                  >
                  {{ t("common.processing") }}
                </ElTag>
                <ElTag
                  v-else-if="file.status === 'error'"
                  type="danger"
                  round
                  effect="light"
                >
                  {{ t("common.error") }}
                </ElTag>
                <ElTag v-else type="info" round effect="light">
                  <span
                    class="material-symbols-outlined text-sm mr-1"
                    style="vertical-align: -2px"
                    >schedule</span
                  >
                  {{ t("converter.waiting") }}
                </ElTag>
                <div class="flex items-center gap-1">
                  <ElButton
                    v-if="file.status === 'done'"
                    circle
                    text
                    @click.stop="onDownload(file.id)"
                  >
                    <span class="material-symbols-outlined"
                      >download</span
                    >
                  </ElButton>
                  <ElButton circle text @click.stop="onRemove(file.id)">
                    <span class="material-symbols-outlined">close</span>
                  </ElButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile queue -->
          <div class="md:hidden space-y-3">
            <div
              v-for="file in fileItems"
              :key="file.id"
              class="relative flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm overflow-hidden"
              :class="[
                selectedFileId === file.id
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-slate-200 dark:border-slate-700',
                { 'opacity-75': file.status === 'pending' },
              ]"
              @click="file.status === 'done' ? selectFile(file.id) : null"
            >
              <template v-if="file.status === 'processing'">
                <div
                  class="absolute bottom-0 left-0 h-1 bg-blue-100 dark:bg-blue-900/30 w-full"
                >
                  <div class="h-full bg-primary animate-pulse w-2/3" />
                </div>
              </template>
              <div
                class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md"
                :class="{ grayscale: file.status === 'pending' }"
                @click.stop
              >
                <ElImage
                  v-if="file.preview"
                  :src="file.preview"
                  :alt="file.name"
                  fit="cover"
                  class="w-full h-full"
                  :preview-src-list="[file.preview]"
                  preview-teleported
                />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium text-slate-900 dark:text-white truncate"
                >
                  {{ file.name }}
                </p>
                <div class="flex items-center gap-1 mt-0.5">
                  <template v-if="file.status === 'done'">
                    <ElTag
                      type="success"
                      size="small"
                      round
                      effect="light"
                      >{{ t("converter.complete") }}</ElTag
                    >
                    <span class="text-xs text-slate-400"
                      >• {{ formatSize(file.processedSize || 0) }}</span
                    >
                  </template>
                  <template v-else-if="file.status === 'processing'">
                    <ElTag
                      type="primary"
                      size="small"
                      round
                      effect="light"
                      >{{ t("common.processing") }}</ElTag
                    >
                  </template>
                  <template v-else>
                    <ElTag
                      type="info"
                      size="small"
                      round
                      effect="light"
                      >{{ t("converter.waiting") }}</ElTag
                    >
                  </template>
                </div>
              </div>
              <div class="flex items-center gap-0 flex-shrink-0">
                <ElButton
                  v-if="file.status === 'done'"
                  circle
                  text
                  size="small"
                  @click.stop="onDownload(file.id)"
                >
                  <span class="material-symbols-outlined text-[20px]"
                    >download</span
                  >
                </ElButton>
                <ElButton
                  circle
                  text
                  size="small"
                  @click.stop="onRemove(file.id)"
                >
                  <span class="material-symbols-outlined text-[20px]"
                    >delete</span
                  >
                </ElButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Batch Detail Comparison (when a completed file is selected) -->
        <div
          v-if="selectedFile && selectedFile.status === 'done'"
          class="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 md:p-6"
        >
          <div class="flex items-center justify-between mb-4">
            <h3
              class="font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0 flex-1"
            >
              <span class="material-symbols-outlined text-primary flex-shrink-0"
                >compare</span
              >
              <span class="flex-shrink-0">{{ t("compressor.compareMode") }}:</span>
              <span class="text-primary truncate">{{
                selectedFile.name
              }}</span>
            </h3>
            <button
              class="text-xs text-slate-500 hover:text-primary"
              @click="selectedFileId = null"
            >
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div
            class="relative w-full max-h-[500px] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center"
          >
            <CompareSlider
              v-if="selectedOriginalPreview && selectedCompressedPreview"
              :original-src="selectedOriginalPreview"
              :compressed-src="selectedCompressedPreview"
              :original-label="t('compressor.original')"
              :compressed-label="t('compressor.compressed')"
              max-height="500px"
            />
            <div
              v-else
              class="py-12 text-center text-slate-400 text-sm"
            >
              {{ t("common.preview") }}
            </div>
          </div>
          <!-- Stats -->
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg"
            >
              <span
                class="text-[10px] text-slate-500 font-medium uppercase tracking-wider"
                >{{ t("compressor.originalFile") }}</span
              >
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {{ formatSize(selectedOriginalSize) }}
              </p>
            </div>
            <div
              class="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-3 rounded-lg relative overflow-hidden"
            >
              <div
                v-if="selectedSavingsPercent > 0"
                class="absolute right-0 top-0 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg"
              >
                -{{ selectedSavingsPercent }}%
              </div>
              <span
                class="text-[10px] text-green-700 dark:text-green-400 font-medium uppercase tracking-wider"
                >{{ t("compressor.compressedFile") }}</span
              >
              <p
                class="text-lg font-bold text-green-700 dark:text-green-400"
              >
                {{ formatSize(selectedCompressedSize) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Batch Action Bar (desktop) -->
        <div class="hidden md:block sticky bottom-4 z-40">
          <div
            class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 shadow-lg flex items-center justify-between gap-4"
          >
            <div
              class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400"
            >
              <div v-if="totalSavings > 0" class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary"
                  >folder_zip</span
                >
                <span>
                  {{ t("compressor.totalSavings") }}
                  <span
                    class="font-bold text-green-600 dark:text-green-400"
                    >{{ formatSize(totalSavings) }} ({{
                      totalSavingsPercent
                    }}%)</span
                  >
                </span>
              </div>
            </div>
            <div class="flex gap-3">
              <ElButton @click="onClearAll">
                <span class="material-symbols-outlined text-sm mr-1"
                  >restart_alt</span
                >
                {{ t("common.reset") }}
              </ElButton>
              <ElButton
                type="primary"
                :disabled="isBusy"
                @click="allDone ? onDownloadAll() : onBatchProcess()"
              >
                <span class="material-symbols-outlined mr-1">{{
                  allDone ? "download" : "play_arrow"
                }}</span>
                {{
                  isBusy
                    ? t("common.processing")
                    : allDone
                      ? t("converter.downloadAllZip")
                      : t("common.process")
                }}
              </ElButton>
            </div>
          </div>
        </div>

        <!-- Mobile bottom bar (batch) -->
        <div
          class="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40"
        >
          <ElButton
            type="primary"
            size="large"
            class="!w-full !rounded-xl !py-5 !text-base !font-bold"
            :disabled="isBusy"
            @click="allDone ? onDownloadAll() : onBatchProcess()"
          >
            <span class="material-symbols-outlined text-[24px] mr-1">{{
              allDone ? "folder_zip" : "play_arrow"
            }}</span>
            {{
              isBusy
                ? t("common.processing")
                : allDone
                  ? t("converter.downloadAllZip")
                  : t("common.process")
            }}
          </ElButton>
        </div>
      </template>
    </div>
  </div>
</template>
