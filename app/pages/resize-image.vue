<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: t("seo.resizer.title"),
  meta: [
    { name: "description", content: t("seo.resizer.description") },
    { property: "og:title", content: t("seo.resizer.title") },
    { property: "og:description", content: t("seo.resizer.description") },
    { property: "og:type", content: "website" },
  ],
});

// ─── Resize Settings ────────────────────────────
type ResizeMode = "pixel" | "percent";

const mode = ref<ResizeMode>("pixel");
const width = ref(1920);
const height = ref(1080);
const scale = ref(100);
const keepRatio = ref(true);
const selectedPreset = ref("");
const modes: ResizeMode[] = ["pixel", "percent"];
const modeIndex = computed(() => modes.indexOf(mode.value));

// ─── Transform State ────────────────────────────
const rotation = ref(0); // 0, 90, 180, 270
const flipH = ref(false);
const flipV = ref(false);

// ─── File State ─────────────────────────────────
const rawFile = ref<File | null>(null);
const previewUrl = ref("");
const isBusy = ref(false);
const isDone = ref(false);
const processedBlob = ref<Blob | null>(null);

// Original dimensions (read from uploaded image)
const originalWidth = ref(0);
const originalHeight = ref(0);
const originalSize = ref(0);
const originalFormat = ref("");

// ─── Composables ────────────────────────────────
const { processImage } = useImageProcessor();
const { downloadFile, generateFileName } = useDownload();

// ─── Quick Presets ──────────────────────────────
const quickPresets = computed(() => [
  { label: t("resizer.presets.square"), value: "1:1", icon: "crop_square" },
  { label: t("resizer.presets.standard"), value: "4:3", icon: "crop_3_2" },
  { label: t("resizer.presets.hd"), value: "16:9", icon: "crop_16_9" },
  { label: t("resizer.presets.story"), value: "9:16", icon: "crop_portrait" },
  { label: t("resizer.presets.cover"), value: "cover", icon: "panorama" },
]);

// ─── Computed ───────────────────────────────────
const hasFile = computed(() => !!rawFile.value);

const targetWidth = computed(() => {
  if (mode.value === "percent")
    return Math.round((originalWidth.value * scale.value) / 100);
  return width.value;
});

const targetHeight = computed(() => {
  if (mode.value === "percent")
    return Math.round((originalHeight.value * scale.value) / 100);
  return height.value;
});

const estimatedSize = computed(() => {
  if (!originalSize.value || !originalWidth.value || !originalHeight.value)
    return 0;
  const origPixels = originalWidth.value * originalHeight.value;
  const newPixels = targetWidth.value * targetHeight.value;
  const ratio = newPixels / origPixels;
  // Rough estimate: size scales roughly with pixel count (not perfect but useful)
  return Math.round(originalSize.value * ratio);
});

const sizeChangePercent = computed(() => {
  if (!originalSize.value || !estimatedSize.value) return 0;
  return Math.round(
    ((estimatedSize.value - originalSize.value) / originalSize.value) * 100,
  );
});

const displayFormat = computed(() => {
  const fmt = originalFormat.value || "jpg";
  return fmt.toUpperCase();
});

// ─── Helpers ────────────────────────────────────
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

// ─── Dimension Helpers ──────────────────────────
function onWidthChange(val: number) {
  width.value = val;
  if (keepRatio.value && originalWidth.value) {
    height.value = Math.round(
      (val / originalWidth.value) * originalHeight.value,
    );
  }
}

function onHeightChange(val: number) {
  height.value = val;
  if (keepRatio.value && originalHeight.value) {
    width.value = Math.round(
      (val / originalHeight.value) * originalWidth.value,
    );
  }
}

function applyPreset(presetValue: string) {
  selectedPreset.value =
    selectedPreset.value === presetValue ? "" : presetValue;
  if (!selectedPreset.value) return;

  if (presetValue === "cover") {
    // Social cover photo: 1200x630 (Open Graph standard)
    width.value = 1200;
    height.value = 630;
    mode.value = "pixel";
    return;
  }

  const [rw, rh] = presetValue.split(":").map(Number);
  if (!rw || !rh || !originalWidth.value) return;
  // Calculate based on original width
  width.value = originalWidth.value;
  height.value = Math.round(originalWidth.value * (rh / rw));
  mode.value = "pixel";
}

// ─── Transform Actions ──────────────────────────
function rotateLeft() {
  rotation.value = (rotation.value - 90 + 360) % 360;
}
function rotateRight() {
  rotation.value = (rotation.value + 90) % 360;
}
function toggleFlipH() {
  flipH.value = !flipH.value;
}
function toggleFlipV() {
  flipV.value = !flipV.value;
}

// CSS transform for visual preview
const previewTransform = computed(() => {
  const transforms: string[] = [];
  if (rotation.value) transforms.push(`rotate(${rotation.value}deg)`);
  if (flipH.value) transforms.push("scaleX(-1)");
  if (flipV.value) transforms.push("scaleY(-1)");
  return transforms.length ? transforms.join(" ") : "none";
});

// Preview aspect ratio simulation — CSS only, zero processing cost
const previewAspectStyle = computed(() => {
  const tw = targetWidth.value;
  const th = targetHeight.value;
  if (!tw || !th) return {};
  return { aspectRatio: `${tw} / ${th}` };
});

// Whether dimensions differ from original
const hasDimensionChanged = computed(() => {
  return (
    targetWidth.value !== originalWidth.value ||
    targetHeight.value !== originalHeight.value ||
    rotation.value !== 0 ||
    flipH.value ||
    flipV.value
  );
});

// ─── Actions ────────────────────────────────────
async function onFilesAdded(newFiles: File[]) {
  if (!newFiles.length) return;
  const file = newFiles[0];
  if (!file) return;

  // Clean up old preview
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);

  rawFile.value = file;
  originalSize.value = file.size;
  originalFormat.value = detectFormat(file.name);
  previewUrl.value = URL.createObjectURL(file);
  isDone.value = false;
  processedBlob.value = null;
  rotation.value = 0;
  flipH.value = false;
  flipV.value = false;

  try {
    const bitmap = await createImageBitmap(file);
    originalWidth.value = bitmap.width;
    originalHeight.value = bitmap.height;
    width.value = bitmap.width;
    height.value = bitmap.height;
  } catch {
    originalWidth.value = 1920;
    originalHeight.value = 1080;
  }
}

async function doResize() {
  if (!rawFile.value || isBusy.value) return;
  isBusy.value = true;

  try {
    const file = rawFile.value;
    const outFormat =
      originalFormat.value === "jpeg"
        ? "jpg"
        : (["jpg", "png", "webp"].includes(originalFormat.value)
            ? originalFormat.value
            : "jpg");

    // Step 1: Apply transforms (rotate/flip) if needed
    let sourceFile: File | Blob = file;
    if (rotation.value !== 0 || flipH.value || flipV.value) {
      sourceFile = await applyTransforms(file);
    }

    const tw = targetWidth.value;
    const th = targetHeight.value;
    console.log(`[Resize] target: ${tw}×${th}, source: ${file.name}, format: ${outFormat}`);

    // Step 2: Resize
    const result = await processImage(sourceFile as File, {
      action: "resize",
      width: tw,
      height: th,
      keepAspectRatio: false,
      outputFormat: outFormat as "jpg" | "png" | "webp",
      quality: 92,
    });

    console.log(`[Resize] output: ${result.width}×${result.height}, size: ${result.processedSize}`);

    processedBlob.value = result.blob;
    isDone.value = true;

    // Auto download
    const filename = generateFileName(file.name, "resize", {
      format: outFormat,
      width: tw,
      height: th,
    });
    downloadFile(result.blob, filename);

    // Show success confirmation with actual output dimensions
    ElMessage.success(
      `✓ ${result.width}×${result.height} px · ${formatSize(result.processedSize)}`,
    );
  } catch (e) {
    console.error("Resize failed:", e);
    ElMessage.error(String(e));
  } finally {
    isBusy.value = false;
  }
}

async function applyTransforms(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;

  // For 90/270 rotations, swap dimensions
  const isRotated90 = rotation.value === 90 || rotation.value === 270;
  const canvasW = isRotated90 ? h : w;
  const canvasH = isRotated90 ? w : h;

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d")!;

  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((rotation.value * Math.PI) / 180);
  if (flipH.value) ctx.scale(-1, 1);
  if (flipV.value) ctx.scale(1, -1);
  ctx.drawImage(bitmap, -w / 2, -h / 2);

  const mimeType =
    originalFormat.value === "png"
      ? "image/png"
      : originalFormat.value === "webp"
        ? "image/webp"
        : "image/jpeg";
  return await canvas.convertToBlob({ type: mimeType, quality: 0.92 });
}

function resetToOriginal() {
  if (originalWidth.value) {
    width.value = originalWidth.value;
    height.value = originalHeight.value;
  }
  scale.value = 100;
  selectedPreset.value = "";
  rotation.value = 0;
  flipH.value = false;
  flipV.value = false;
  mode.value = "pixel";
}

function startOver() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  rawFile.value = null;
  previewUrl.value = "";
  originalSize.value = 0;
  originalWidth.value = 0;
  originalHeight.value = 0;
  originalFormat.value = "";
  isDone.value = false;
  processedBlob.value = null;
  resetToOriginal();
}
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center w-full px-4 py-6 md:py-8 lg:px-8"
  >
    <div class="w-full max-w-[1024px] flex flex-col gap-6 md:gap-8">
      <!-- Hero / Title -->
      <div class="text-center max-w-2xl mx-auto mb-2 md:mb-4">
        <h1
          class="text-2xl md:text-3xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3"
        >
          {{ t("resizer.title") }}
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg hidden md:block">
          {{ t("seo.resizer.description") }}
        </p>
        <p class="text-slate-500 dark:text-slate-400 text-sm md:hidden">
          {{ t("seo.resizer.description") }}
        </p>
      </div>

      <!-- ================== UPLOAD STATE ================== -->
      <div v-if="!hasFile">
        <FileUploader :hint="t('resizer.uploadHint')" @files="onFilesAdded" />
      </div>

      <!-- ================== EDITOR STATE ================== -->
      <template v-if="hasFile">
        <!-- ===== DESKTOP (lg+): 2-column ===== -->
        <div class="hidden lg:grid grid-cols-12 gap-8 items-start">
          <!-- Left: Image Preview Stage (7 col) -->
          <div class="col-span-7 flex flex-col gap-4">
            <!-- Preview Container -->
            <div
              class="relative w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[500px] overflow-hidden group"
            >
              <!-- Dot pattern background -->
              <div
                class="absolute inset-0 z-0 opacity-30 dark:opacity-10"
                style="
                  background-image: radial-gradient(
                    #cbd5e1 1px,
                    transparent 1px
                  );
                  background-size: 20px 20px;
                "
              />

              <!-- Image with live aspect ratio preview -->
              <div
                class="relative z-10 flex items-center justify-center p-4 transition-all duration-300 ease-out"
                :style="{ ...previewAspectStyle, maxHeight: '400px', maxWidth: '100%' }"
              >
                <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  class="w-full h-full object-cover rounded-lg shadow-lg border border-white/20 transition-all duration-300"
                  :style="{ transform: previewTransform }"
                  alt="preview"
                />
              </div>

              <!-- Info overlay badge — live target dimensions -->
              <div
                class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-3 shadow-lg whitespace-nowrap transition-colors duration-200"
                :class="hasDimensionChanged ? 'bg-primary/85' : 'bg-black/75'"
              >
                <span class="truncate max-w-[120px]">{{
                  rawFile?.name
                }}</span>
                <span class="w-px h-3 bg-white/30" />
                <span class="flex items-center gap-1">
                  <span v-if="hasDimensionChanged" class="material-symbols-outlined text-[14px]">open_with</span>
                  {{ targetWidth }} × {{ targetHeight }} px
                </span>
                <span class="w-px h-3 bg-white/30" />
                <span>~{{ formatSize(estimatedSize) }}</span>
              </div>

              <!-- Hover overlay to replace image -->
              <div
                class="absolute inset-0 bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                @click="startOver"
              >
                <div
                  class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-primary"
                    >upload</span
                  >
                  {{ t("resizer.replaceImage") }}
                </div>
              </div>
            </div>

            <!-- Rotate/Flip Toolbar -->
            <div class="flex gap-2 justify-center">
              <button
                class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:text-primary hover:border-primary/30 transition-all"
                @click="rotateLeft"
              >
                <span class="material-symbols-outlined text-lg"
                  >rotate_left</span
                >
                {{ t("resizer.rotateLeft") }}
              </button>
              <button
                class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:text-primary hover:border-primary/30 transition-all"
                @click="rotateRight"
              >
                <span class="material-symbols-outlined text-lg"
                  >rotate_right</span
                >
                {{ t("resizer.rotateRight") }}
              </button>
              <button
                class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:text-primary hover:border-primary/30 transition-all"
                @click="toggleFlipH"
              >
                <span class="material-symbols-outlined text-lg">flip</span>
                {{ t("resizer.flipH") }}
              </button>
              <button
                class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:text-primary hover:border-primary/30 transition-all"
                @click="toggleFlipV"
              >
                <span class="material-symbols-outlined text-lg -rotate-90">flip</span>
                {{ t("resizer.flipV") }}
              </button>
            </div>
          </div>

          <!-- Right: Settings Panel (5 col) -->
          <div class="col-span-5 flex flex-col gap-6">
            <div
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between mb-6"
              >
                <h3
                  class="font-bold text-lg text-slate-900 dark:text-white"
                >
                  {{ t("resizer.settings") }}
                </h3>
                <button
                  class="text-xs font-medium text-primary hover:underline"
                  @click="resetToOriginal"
                >
                  {{ t("common.reset") }}
                </button>
              </div>

              <!-- Mode Segmented Control -->
              <div class="mb-6">
                <label
                  class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3"
                  >{{ t("resizer.resizeBy") }}</label
                >
                <div
                  class="relative flex p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <!-- Sliding indicator -->
                  <div
                    class="absolute top-1 bottom-1 rounded bg-white dark:bg-slate-700 shadow-sm transition-all duration-300 ease-out"
                    :style="{
                      width: `calc((100% - 8px) / 2)`,
                      left: `calc(4px + ${modeIndex} * (100% - 8px) / 2)`,
                    }"
                  />
                  <button
                    v-for="m in (['pixel', 'percent'] as ResizeMode[])"
                    :key="m"
                    class="relative z-10 flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors duration-200"
                    :class="[
                      mode === m
                        ? 'text-primary'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                    ]"
                    @click="mode = m"
                  >
                    {{ t(`resizer.mode.${m}`) }}
                  </button>
                </div>
              </div>

              <!-- Pixel Mode -->
              <div
                v-if="mode === 'pixel'"
                class="mb-6 space-y-4"
              >
                <div class="flex items-end gap-3">
                  <div class="flex-1">
                    <label
                      class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"
                      >{{ t("resizer.width") }} (PX)</label
                    >
                    <input
                      :value="width"
                      type="number"
                      min="1"
                      max="10000"
                      class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      @input="
                        onWidthChange(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                  </div>
                  <!-- Link Button -->
                  <div
                    class="flex flex-col items-center justify-center pb-0.5 pt-4"
                  >
                    <button
                      class="p-1.5 rounded-full transition-colors"
                      :class="
                        keepRatio
                          ? 'text-primary'
                          : 'text-slate-400 hover:text-primary'
                      "
                      :title="t('resizer.keepRatio')"
                      @click="keepRatio = !keepRatio"
                    >
                      <span class="material-symbols-outlined text-xl">{{
                        keepRatio ? "link" : "link_off"
                      }}</span>
                    </button>
                  </div>
                  <div class="flex-1">
                    <label
                      class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"
                      >{{ t("resizer.height") }} (PX)</label
                    >
                    <input
                      :value="height"
                      type="number"
                      min="1"
                      max="10000"
                      class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      @input="
                        onHeightChange(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                  </div>
                </div>
                <!-- Lock Aspect Ratio Checkbox -->
                <div class="flex items-center gap-2">
                  <input
                    id="lockRatio"
                    v-model="keepRatio"
                    type="checkbox"
                    class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  <label
                    for="lockRatio"
                    class="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer"
                    >{{ t("resizer.lockRatio") }}</label
                  >
                </div>
              </div>

              <!-- Percent Mode -->
              <div
                v-if="mode === 'percent'"
                class="mb-6 space-y-3"
              >
                <div class="flex justify-between items-center">
                  <label
                    class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    >{{ t("resizer.scale") }}</label
                  >
                  <span
                    class="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded"
                    >{{ scale }}%</span
                  >
                </div>
                <ElSlider v-model="scale" :min="1" :max="500" />
                <div
                  class="text-xs text-slate-500 dark:text-slate-400 text-center"
                >
                  {{ targetWidth }} × {{ targetHeight }} px
                </div>
              </div>



              <!-- Quick Presets (pixel mode only) -->
              <div v-if="mode === 'pixel'" class="mb-6">
                <label
                  class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3"
                  >{{ t("resizer.quickPresets") }}</label
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="preset in quickPresets"
                    :key="preset.value"
                    class="px-3 py-1.5 border rounded-full text-xs font-medium transition-colors"
                    :class="[
                      selectedPreset === preset.value
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary',
                    ]"
                    @click="applyPreset(preset.value)"
                  >
                    {{ preset.label }}
                  </button>
                </div>
              </div>

              <!-- Divider -->
              <div
                class="h-px w-full bg-slate-200 dark:bg-slate-700 mb-6"
              />

              <!-- Estimated Output Info -->
              <div
                class="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50"
              >
                <div>
                  <p
                    class="text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {{ t("resizer.estimatedSize") }}
                  </p>
                  <p
                    class="font-bold text-slate-900 dark:text-white"
                  >
                    ~{{ formatSize(estimatedSize) }}
                    <span
                      v-if="sizeChangePercent !== 0"
                      class="text-xs font-normal ml-1"
                      :class="
                        sizeChangePercent < 0
                          ? 'text-green-600'
                          : 'text-orange-500'
                      "
                    >
                      ({{ sizeChangePercent > 0 ? "+" : ""
                      }}{{ sizeChangePercent }}%)
                    </span>
                  </p>
                </div>
                <div class="text-right">
                  <p
                    class="text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {{ t("resizer.outputFormat") }}
                  </p>
                  <div
                    class="flex items-center gap-1 text-sm font-medium text-slate-900 dark:text-white justify-end"
                  >
                    <span class="material-symbols-outlined text-base"
                      >image</span
                    >
                    {{ displayFormat }}
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-col gap-3">
                <ElButton
                  type="primary"
                  size="large"
                  :loading="isBusy"
                  class="!w-full !h-10 !rounded-lg !text-sm !font-bold"
                  @click="doResize"
                >
                  <span v-if="!isBusy" class="material-symbols-outlined text-lg mr-1">download</span>
                  {{
                    isBusy
                      ? t("common.processing")
                      : t("resizer.resizeAndDownload")
                  }}
                </ElButton>
                <button
                  class="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium py-3 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  @click="startOver"
                >
                  {{ t("resizer.startOver") }}
                </button>
              </div>
            </div>

            <!-- Security Note -->
            <div
              class="flex items-center justify-center gap-2 text-xs text-slate-400"
            >
              <span class="material-symbols-outlined text-sm">lock</span>
              {{ t("resizer.securityNote") }}
            </div>
          </div>
        </div>

        <!-- ===== MOBILE (<lg): stacked ===== -->
        <div class="lg:hidden flex flex-col gap-0">
          <!-- Image Preview (edge to edge) -->
          <div
            class="relative bg-slate-100 dark:bg-slate-800 w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
            style="aspect-ratio: 4/3"
          >
            <img
              v-if="previewUrl"
              :src="previewUrl"
              class="w-full h-full object-contain transition-transform duration-300"
              :style="{ transform: previewTransform }"
              alt="preview"
            />

            <!-- Dimensions badge -->
            <div
              class="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded z-10"
            >
              {{ originalWidth }} × {{ originalHeight }}
            </div>

            <!-- Rotate/Flip floating toolbar -->
            <div
              class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full p-1 shadow-lg border border-slate-200 dark:border-slate-600 z-10"
            >
              <button
                class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                @click="rotateLeft"
              >
                <span class="material-symbols-outlined text-[20px]"
                  >rotate_left</span
                >
              </button>
              <button
                class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                @click="rotateRight"
              >
                <span class="material-symbols-outlined text-[20px]"
                  >rotate_right</span
                >
              </button>
              <div class="w-px bg-slate-200 dark:bg-slate-600 my-1" />
              <button
                class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                @click="toggleFlipH"
              >
                <span class="material-symbols-outlined text-[20px]"
                  >flip</span
                >
              </button>
              <button
                class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                @click="toggleFlipV"
              >
                <span
                  class="material-symbols-outlined text-[20px] -rotate-90"
                  >flip</span
                >
              </button>
            </div>
          </div>

          <!-- Settings Section -->
          <div class="p-0 pt-6 space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <h2
                class="text-lg font-bold text-slate-900 dark:text-white"
              >
                {{ t("resizer.settings") }}
              </h2>
              <button
                class="text-sm text-primary font-medium"
                @click="resetToOriginal"
              >
                {{ t("common.reset") }}
              </button>
            </div>

            <!-- Mode Segmented Control -->
            <div
              class="relative p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex border border-slate-200 dark:border-slate-700"
            >
              <!-- Sliding indicator -->
              <div
                class="absolute top-1 bottom-1 rounded-md bg-white dark:bg-slate-700 shadow-sm transition-all duration-300 ease-out"
                :style="{
                  width: `calc((100% - 8px) / 2)`,
                  left: `calc(4px + ${modeIndex} * (100% - 8px) / 2)`,
                }"
              />
              <button
                v-for="m in (['pixel', 'percent'] as ResizeMode[])"
                :key="m"
                class="relative z-10 flex-1 py-1.5 text-sm font-medium rounded-md transition-colors duration-200"
                :class="[
                  mode === m
                    ? 'text-primary'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ]"
                @click="mode = m"
              >
                {{ t(`resizer.mode.${m}`) }}
              </button>
            </div>

            <!-- Pixel Mode -->
            <div
              v-if="mode === 'pixel'"
              class="space-y-4"
            >
              <div class="flex items-end gap-3">
                <div class="flex-1 space-y-1.5">
                  <label
                    class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    >{{ t("resizer.width") }}</label
                  >
                  <div class="relative">
                    <input
                      :value="width"
                      type="number"
                      min="1"
                      max="10000"
                      class="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm"
                      @input="
                        onWidthChange(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                    <span
                      class="absolute right-3 top-2.5 text-xs text-slate-400 font-medium"
                      >PX</span
                    >
                  </div>
                </div>
                <div class="flex h-[42px] items-center justify-center">
                  <button
                    class="p-1.5 rounded-md transition-colors"
                    :class="
                      keepRatio
                        ? 'text-primary'
                        : 'text-slate-400 hover:text-primary'
                    "
                    @click="keepRatio = !keepRatio"
                  >
                    <span class="material-symbols-outlined text-[20px]">{{
                      keepRatio ? "link" : "link_off"
                    }}</span>
                  </button>
                </div>
                <div class="flex-1 space-y-1.5">
                  <label
                    class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    >{{ t("resizer.height") }}</label
                  >
                  <div class="relative">
                    <input
                      :value="height"
                      type="number"
                      min="1"
                      max="10000"
                      class="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm"
                      @input="
                        onHeightChange(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                    <span
                      class="absolute right-3 top-2.5 text-xs text-slate-400 font-medium"
                      >PX</span
                    >
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="lockRatioMobile"
                  v-model="keepRatio"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                />
                <label
                  for="lockRatioMobile"
                  class="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >{{ t("resizer.lockRatio") }}</label
                >
              </div>
            </div>

            <!-- Percent Mode -->
            <div
              v-if="mode === 'percent'"
              class="space-y-3"
            >
              <div class="flex justify-between items-center">
                <label
                  class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >{{ t("resizer.scale") }}</label
                >
                <span
                  class="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >{{ scale }}%</span
                >
              </div>
              <ElSlider v-model="scale" :min="1" :max="500" />
              <div class="text-xs text-slate-500 text-center">
                {{ targetWidth }} × {{ targetHeight }} px
              </div>
            </div>



            <!-- Quick Presets (pixel mode only) -->
            <div v-if="mode === 'pixel'">
              <label
                class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block"
                >{{ t("resizer.quickPresets") }}</label
              >
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in quickPresets"
                  :key="preset.value"
                  class="px-3 py-1.5 rounded-full border text-sm font-medium transition-colors"
                  :class="[
                    selectedPreset === preset.value
                      ? 'border-primary bg-blue-50 dark:bg-blue-900/20 text-primary'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
                  ]"
                  @click="applyPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <hr class="border-slate-100 dark:border-slate-800" />

            <!-- Estimated Info -->
            <div
              class="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-slate-600 dark:text-slate-400">{{
                  t("resizer.estimatedSize")
                }}</span>
                <span
                  class="text-sm font-bold text-slate-900 dark:text-white"
                  >~{{ formatSize(estimatedSize) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-slate-400">{{
                  t("resizer.outputFormat")
                }}</span>
                <span
                  class="text-sm font-medium text-slate-900 dark:text-white"
                  >{{ displayFormat }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Bottom CTA -->
        <div
          class="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40"
        >
          <ElButton
            type="primary"
            size="large"
            :loading="isBusy"
            class="!w-full !h-12 !rounded-xl !text-base !font-bold"
            @click="doResize"
          >
            <span v-if="!isBusy" class="material-symbols-outlined text-[20px] mr-1">download</span>
            {{
              isBusy
                ? t("common.processing")
                : t("resizer.resizeAndDownload")
            }}
          </ElButton>
          <button
            class="w-full text-slate-500 text-sm font-medium py-2 mt-1"
            @click="startOver"
          >
            {{ t("resizer.startOver") }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
