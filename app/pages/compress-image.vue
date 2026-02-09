<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: t("seo.compressor.title"),
  meta: [{ name: "description", content: t("seo.compressor.description") }],
});

// ─── State ─────────────────────────────────────
const quality = ref(80);
const outputFormat = ref("keep"); // "keep" | "png" | "webp" | "jpg"
const isBusy = ref(false);
const isDone = ref(false);

// File refs
const rawFile = ref<File | null>(null);
const originalPreview = ref("");
const compressedPreview = ref("");
const processedBlob = ref<Blob | null>(null);

// Original file info
const originalSize = ref(0);
const originalWidth = ref(0);
const originalHeight = ref(0);
const originalFormat = ref("");

// Compressed file info
const compressedSize = ref(0);

// Presets with hints
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

// Active preset
const activePreset = ref(80); // matches "Light" default

// Savings
const savingsPercent = computed(() => {
  if (!originalSize.value || !compressedSize.value) return 0;
  return Math.round(
    ((originalSize.value - compressedSize.value) / originalSize.value) * 100,
  );
});

// Detect format from filename
function detectFormat(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  if (["png", "webp", "jpg", "jpeg"].includes(ext))
    return ext === "jpeg" ? "jpg" : ext;
  return "jpg";
}

// Output format options
const formatOptions = computed(() => {
  const fmt = originalFormat.value.toUpperCase() || "JPG";
  return [
    { value: "keep", label: t("compressor.keepOriginal", { format: fmt }) },
    { value: "png", label: t("compressor.convertTo", { format: "PNG" }) },
    { value: "webp", label: t("compressor.convertTo", { format: "WebP" }) },
    { value: "jpg", label: t("compressor.convertTo", { format: "JPG" }) },
  ];
});

// Actual output format
// PNG is lossless — quality slider has no effect. Auto-convert to WebP for real compression.
const actualOutputFormat = computed(() => {
  let fmt =
    outputFormat.value === "keep"
      ? originalFormat.value || "jpg"
      : outputFormat.value;
  // PNG cannot be quality-compressed via Canvas API, auto-switch to webp
  if (fmt === "png") fmt = "webp";
  return fmt;
});

// Whether the original format is lossless (for UI hints)
const isOriginalPng = computed(() => originalFormat.value === "png");

// Composables
const { processImage } = useImageProcessor();
const { downloadFile, generateFileName } = useDownload();

// ─── Actions ───────────────────────────────────
async function onFilesAdded(newFiles: File[]) {
  if (newFiles.length === 0) return;
  const file = newFiles[0]; // Single file for compressor

  // Reset state
  rawFile.value = file;
  originalSize.value = file.size;
  originalFormat.value = detectFormat(file.name);
  isDone.value = false;
  processedBlob.value = null;
  compressedPreview.value = "";
  compressedSize.value = 0;

  // Generate preview
  originalPreview.value = URL.createObjectURL(file);

  // Get original dimensions
  const img = await createImageBitmap(file);
  originalWidth.value = img.width;
  originalHeight.value = img.height;

  // Auto-process
  await doCompress();
}

async function doCompress() {
  if (!rawFile.value || isBusy.value) return;
  isBusy.value = true;

  try {
    const result = await processImage(rawFile.value, {
      action: "compress",
      outputFormat: actualOutputFormat.value as "jpg" | "png" | "webp",
      quality: quality.value,
    });

    // Safety net: if compressed is larger than original, use original
    if (result.processedSize >= rawFile.value.size) {
      processedBlob.value = rawFile.value;
      compressedSize.value = rawFile.value.size;
      compressedPreview.value = originalPreview.value;
    } else {
      processedBlob.value = result.blob;
      compressedSize.value = result.processedSize;
      compressedPreview.value = URL.createObjectURL(result.blob);
    }
    isDone.value = true;
  } catch {
    // Error handled by composable
  } finally {
    isBusy.value = false;
  }
}

function onDownload() {
  if (!processedBlob.value || !rawFile.value || isBusy.value) return;
  const ext = actualOutputFormat.value;
  const filename = generateFileName(rawFile.value.name, "compress", {
    format: ext,
  });
  downloadFile(processedBlob.value, filename);
}

function startOver() {
  if (originalPreview.value) URL.revokeObjectURL(originalPreview.value);
  if (compressedPreview.value) URL.revokeObjectURL(compressedPreview.value);

  rawFile.value = null;
  originalPreview.value = "";
  compressedPreview.value = "";
  processedBlob.value = null;
  originalSize.value = 0;
  originalWidth.value = 0;
  originalHeight.value = 0;
  compressedSize.value = 0;
  isDone.value = false;
  quality.value = 80;
  activePreset.value = 80;
  outputFormat.value = "keep";
}

let fromPreset = false;

function selectPreset(value: number) {
  fromPreset = true;
  quality.value = value;
  activePreset.value = value;
  if (isDone.value) doCompress();
}

// Watch quality for re-compress (debounced)
let qualityTimer: ReturnType<typeof setTimeout>;
watch(quality, () => {
  if (fromPreset) {
    fromPreset = false;
    return;
  }
  activePreset.value = -1; // Deselect presets when manually changing slider
  if (!isDone.value) return;
  clearTimeout(qualityTimer);
  qualityTimer = setTimeout(() => doCompress(), 500);
});

// Watch format change
watch(outputFormat, () => {
  if (isDone.value) doCompress();
});

function formatSize(bytes: number): string {
  if (bytes < 0) bytes = 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center w-full px-4 py-6 md:py-8 lg:px-8"
  >
    <div class="w-full max-w-[1024px] flex flex-col gap-6 md:gap-8">
      <!-- Hero Text -->
      <div class="text-center max-w-2xl mx-auto mb-8 md:mb-10">
        <h1
          class="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-3"
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
      <div v-if="!rawFile">
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          @files="onFilesAdded"
        />
      </div>

      <!-- ================== RESULT STATE ================== -->
      <div v-else>
        <!-- ===== DESKTOP LAYOUT (lg+) ===== -->
        <div class="hidden lg:grid grid-cols-12 gap-6 items-start">
          <!-- Left Column: Preview Area (col-span-8) -->
          <div class="col-span-8 flex flex-col gap-4">
            <!-- Image Comparison Container -->
            <div
              class="relative w-full max-h-[600px] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
            >
              <template v-if="isDone && compressedPreview">
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
                <!-- Loading / Original only -->
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

            <!-- Comparison Stats Bar -->
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
                  v-if="isDone && savingsPercent > 0"
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
                    {{ isDone ? formatSize(compressedSize) : "—" }}
                  </span>
                  <span
                    v-if="isDone"
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

          <!-- Right Column: Controls (col-span-4) -->
          <div class="col-span-4 flex flex-col gap-6">
            <!-- Control Panel Card -->
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

              <!-- Output Format -->
              <div class="space-y-3 pt-2">
                <label
                  class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >{{ t("compressor.outputFormat") }}</label
                >
                <ElSelect v-model="outputFormat" class="w-full">
                  <ElOption
                    v-for="opt in formatOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </ElSelect>
              </div>

              <!-- Actions -->
              <div class="pt-4 flex flex-col gap-3">
                <button
                  class="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!isDone || isBusy"
                  @click="onDownload"
                >
                  <span class="material-symbols-outlined">download</span>
                  {{ t("compressor.downloadImage") }}
                </button>
                <!-- or divider -->
                <div class="relative py-2">
                  <div class="absolute inset-0 flex items-center">
                    <div
                      class="w-full border-t border-slate-200 dark:border-slate-700"
                    ></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span class="bg-white dark:bg-slate-900 px-2 text-slate-400"
                      >or</span
                    >
                  </div>
                </div>
                <button
                  class="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2"
                  @click="startOver"
                >
                  <span class="material-symbols-outlined text-lg"
                    >restart_alt</span
                  >
                  {{ t("compressor.startOver") }}
                </button>
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

        <!-- ===== MOBILE LAYOUT (<lg) ===== -->
        <div class="lg:hidden flex flex-col gap-6">
          <!-- Compare Viewer -->
          <div
            class="relative w-full max-h-[500px] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center"
          >
            <template v-if="isDone && compressedPreview">
              <CompareSlider
                :original-src="originalPreview"
                :compressed-src="compressedPreview"
                :original-label="t('compressor.original')"
                :compressed-label="t('compressor.compressed')"
                max-height="500px"
                class="!rounded-none"
              />
              <!-- Size badges -->
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

          <!-- Compression Level Presets -->
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

          <!-- Output Format -->
          <div class="space-y-3">
            <label
              class="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-primary text-lg"
                >image</span
              >
              {{ t("compressor.outputFormat") }}
            </label>
            <ElSelect v-model="outputFormat" class="w-full">
              <ElOption
                v-for="opt in formatOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
          </div>
        </div>

        <!-- Mobile Bottom Bar -->
        <div
          class="lg:hidden sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 pb-8 -mx-4 mt-6 z-30"
        >
          <div class="flex flex-col gap-3">
            <!-- Savings summary -->
            <div
              class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              <span
                >{{ t("compressor.totalSavings") }}
                <span class="text-green-600 font-bold">{{
                  isDone
                    ? `${formatSize(originalSize - compressedSize)} (${savingsPercent}%)`
                    : "—"
                }}</span></span
              >
              <span
                >{{ t("compressor.format") }}
                <span class="font-medium text-slate-700 dark:text-slate-300">{{
                  actualOutputFormat.toUpperCase()
                }}</span></span
              >
            </div>
            <!-- Download button -->
            <button
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!isDone || isBusy"
              @click="onDownload"
            >
              <span class="material-symbols-outlined">download</span>
              {{ t("compressor.downloadImage") }}
            </button>
            <!-- Compress another -->
            <button
              class="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              @click="startOver"
            >
              {{ t("compressor.compressAnother") }}
            </button>
          </div>
        </div>

        <!-- Desktop: Process Another Image (bottom upload zone) -->
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
              @files="onFilesAdded"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
