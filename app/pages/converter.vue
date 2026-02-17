<script setup lang="ts">
import type { FileItem as BaseFileItem } from "~/components/common/FileList.vue";

interface FileItem extends BaseFileItem {
  outputFormat?: string;
}

const { t } = useI18n();

useHead({
  title: t("seo.converter.title"),
  meta: [
    { name: "description", content: t("seo.converter.description") },
    { property: "og:title", content: t("seo.converter.title") },
    { property: "og:description", content: t("seo.converter.description") },
    { property: "og:type", content: "website" },
  ],
});

// Output format options with labels
const formatOptions = computed(() => [
  { value: "jpg", label: "JPG - Joint Photographic Experts Group" },
  { value: "png", label: "PNG - Portable Network Graphics" },
  { value: "webp", label: "WebP - Web Picture Format" },
]);
type OutputFormat = "jpg" | "png" | "webp";

const selectedFormat = ref<OutputFormat>("webp");
const quality = ref(85);
const showQuality = computed(() => selectedFormat.value !== "png");

// Raw files from uploader
const rawFiles = ref<File[]>([]);
// Processed results mapped by ID
const processedBlobs = ref<Map<string, Blob>>(new Map());
// File list state
const fileItems = ref<FileItem[]>([]);
// Is currently processing
const isBusy = ref(false);

const hasFiles = computed(() => fileItems.value.length > 0);
const allDone = computed(
  () =>
    fileItems.value.length > 0 &&
    fileItems.value.every((f) => f.status === "done"),
);

// Total size savings
const totalSavings = computed(() => {
  let savings = 0;
  for (const item of fileItems.value) {
    if (item.status === "done" && item.processedSize) {
      savings += item.originalSize - item.processedSize;
    }
  }
  return savings;
});

// Composables
const { processImage } = useImageProcessor();
const { downloadFile, downloadAsZip, generateFileName, generateZipName } =
  useDownload();

function formatSize(bytes: number): string {
  if (bytes < 0) bytes = 0;
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function onFilesAdded(newFiles: File[]) {
  for (const file of newFiles) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    rawFiles.value.push(file);
    fileItems.value.push({
      id,
      name: file.name,
      originalSize: file.size,
      status: "pending",
      progress: 0,
      preview: URL.createObjectURL(file),
    });
  }
}

async function onProcess() {
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
      const result = await processImage(file, {
        action: "convert",
        outputFormat: selectedFormat.value,
        quality: showQuality.value ? quality.value : 100,
      });

      item.status = "done";
      item.progress = 100;
      item.processedSize = result.processedSize;
      item.width = result.width;
      item.height = result.height;
      item.outputFormat = selectedFormat.value;

      processedBlobs.value.set(item.id, result.blob);
    } catch {
      item.status = "error";
      item.error = t("errors.processFailed");
    }
  }

  isBusy.value = false;
}

function onDownload(id: string) {
  const item = fileItems.value.find((f) => f.id === id);
  const blob = processedBlobs.value.get(id);
  if (!item || !blob) return;

  const filename = generateFileName(item.name, "convert", {
    format: (item.outputFormat as any) || selectedFormat.value,
  });
  downloadFile(blob, filename);
}

async function onDownloadAll() {
  const zipFiles: Array<{ blob: Blob; name: string }> = [];
  for (const item of fileItems.value) {
    if (!item) continue;
    const blob = processedBlobs.value.get(item.id);
    if (blob) {
      zipFiles.push({
        blob,
        name: generateFileName(item.name, "convert", {
          format: (item.outputFormat as any) || selectedFormat.value,
        }),
      });
    }
  }
  if (zipFiles.length > 0) {
    await downloadAsZip(zipFiles, generateZipName("convert"));
  }
}

function onRemove(id: string) {
  const idx = fileItems.value.findIndex((f) => f.id === id);
  if (idx === -1) return;

  const item = fileItems.value[idx];
  if (item?.preview) URL.revokeObjectURL(item.preview);
  processedBlobs.value.delete(id);
  fileItems.value.splice(idx, 1);
  rawFiles.value.splice(idx, 1);
}

function onClearAll() {
  for (const item of fileItems.value) {
    if (item?.preview) URL.revokeObjectURL(item.preview);
  }
  processedBlobs.value.clear();
  fileItems.value = [];
  rawFiles.value = [];
}

function onReset() {
  onClearAll();
  selectedFormat.value = "webp";
  quality.value = 85;
}
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center w-full px-4 py-6 md:py-8 lg:px-8"
  >
    <div class="w-full max-w-[1024px] flex flex-col gap-6 md:gap-8">
      <!-- Hero / Title Section -->
      <div class="text-center space-y-2 md:space-y-3 mb-2 md:mb-4">
        <h1
          class="text-2xl md:text-3xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white"
        >
          {{ t("converter.title") }}
        </h1>
        <!-- Web subtitle -->
        <p
          class="hidden md:block text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto"
        >
          {{ t("converter.subtitle") }}
        </p>
        <!-- Mobile subtitle -->
        <p class="md:hidden text-sm text-slate-500 dark:text-slate-400">
          {{ t("converter.subtitleMobile") }}
        </p>
      </div>

      <!-- Upload Area -->
      <FileUploader :hint="t('converter.uploadHint')" @files="onFilesAdded" />

      <!-- Conversion Settings Card -->
      <div
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-6 shadow-sm"
      >
        <!-- Web layout: horizontal -->
        <div
          class="hidden md:flex items-start md:items-center justify-between gap-6"
        >
          <!-- Left: title & desc -->
          <div class="flex flex-col gap-1 flex-shrink-0">
            <h2
              class="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white"
            >
              <span class="material-symbols-outlined text-primary">tune</span>
              {{ t("converter.settingsTitle") }}
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ t("converter.settingsDesc") }}
            </p>
          </div>

          <!-- Right: format + quality -->
          <div class="flex gap-6 flex-1 justify-end">
            <!-- Format Selection -->
            <div class="flex flex-col gap-2 min-w-[280px]">
              <label
                class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {{ t("converter.outputFormat") }}
              </label>
              <ElSelect
                v-model="selectedFormat"
                size="large"
                class="w-full"
                :suffix-icon="''"
              >
                <ElOption
                  v-for="fmt in formatOptions"
                  :key="fmt.value"
                  :label="fmt.label"
                  :value="fmt.value"
                />
              </ElSelect>
            </div>

            <!-- Quality Area (always present, content changes) -->
            <div class="flex flex-col gap-2 min-w-[240px] flex-1">
              <div class="flex justify-between items-center">
                <label
                  class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  {{ t("converter.quality") }}
                </label>
                <span
                  v-if="showQuality"
                  class="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded"
                >
                  {{ quality }}%
                </span>
                <span
                  v-else
                  class="text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-0.5 rounded-full"
                >
                  {{ t("converter.lossless") }}
                </span>
              </div>
              <div class="flex items-center h-[42px]">
                <ElSlider
                  v-if="showQuality"
                  v-model="quality"
                  :min="1"
                  :max="100"
                  :show-tooltip="true"
                  :format-tooltip="(val: number) => `${val}%`"
                />
                <p
                  v-else
                  class="text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5"
                >
                  <span class="material-symbols-outlined text-[16px]"
                    >verified</span
                  >
                  {{ t("converter.losslessHint") }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile layout: vertical stack -->
        <div class="md:hidden space-y-4">
          <h2
            class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            {{ t("converter.settingsMobile") }}
          </h2>
          <div class="grid gap-4">
            <!-- Format -->
            <div>
              <label
                class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {{ t("converter.outputFormat") }}
              </label>
              <ElSelect v-model="selectedFormat" class="w-full">
                <ElOption
                  v-for="fmt in formatOptions"
                  :key="fmt.value"
                  :label="fmt.label"
                  :value="fmt.value"
                />
              </ElSelect>
            </div>

          </div>
        </div>
      </div>

      <!-- File Queue -->
      <div v-if="hasFiles" class="flex flex-col gap-3 md:gap-4">
        <!-- Queue Header -->
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

        <!-- Web: unified card container -->
        <div
          class="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm"
        >
          <div
            v-for="(file, idx) in fileItems"
            :key="file.id"
            class="group flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            :class="{
              'border-b border-slate-200 dark:border-slate-700':
                idx < fileItems.length - 1,
              'opacity-70': file.status === 'pending',
            }"
          >
            <!-- Thumbnail -->
            <div
              class="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden"
              :class="{ grayscale: file.status === 'pending' }"
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
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400"
              >
                <span class="material-symbols-outlined text-xl">image</span>
              </div>
            </div>

            <!-- Info -->
            <div class="flex flex-col min-w-0 flex-1">
              <!-- Done status: name + size info -->
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
                  <span class="font-medium text-slate-900 dark:text-white"
                    >{{ formatSize(file.processedSize || 0) }} ({{
                      (file.outputFormat || selectedFormat).toUpperCase()
                    }})</span
                  >
                </div>
              </template>

              <!-- Processing status: name + progress bar -->
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
                    {{ t("converter.converting") }}
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

              <!-- Pending status: name + size -->
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

            <!-- Status badge + actions -->
            <div class="flex items-center gap-4 md:gap-6 flex-shrink-0">
              <!-- Status badges -->
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
                <span
                  class="material-symbols-outlined text-sm mr-1"
                  style="vertical-align: -2px"
                  >error</span
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

              <!-- Action buttons -->
              <div class="flex items-center gap-1">
                <ElButton
                  v-if="file.status === 'done'"
                  circle
                  text
                  @click="onDownload(file.id)"
                >
                  <span class="material-symbols-outlined">download</span>
                </ElButton>
                <ElButton v-else circle text disabled>
                  <span class="material-symbols-outlined">download</span>
                </ElButton>
                <ElButton circle text @click="onRemove(file.id)">
                  <span class="material-symbols-outlined">close</span>
                </ElButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: separate cards -->
        <div class="md:hidden space-y-3">
          <div
            v-for="file in fileItems"
            :key="file.id"
            class="relative flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            :class="{ 'opacity-75': file.status === 'pending' }"
          >
            <!-- Progress bar at bottom for processing -->
            <template v-if="file.status === 'processing'">
              <div
                class="absolute bottom-0 left-0 h-1 bg-blue-100 dark:bg-blue-900/30 w-full"
              >
                <div class="h-full bg-primary animate-pulse w-2/3" />
              </div>
            </template>

            <!-- Thumbnail -->
            <div
              class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md"
              :class="{ grayscale: file.status === 'pending' }"
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
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400"
              >
                <span class="material-symbols-outlined text-xl">image</span>
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium text-slate-900 dark:text-white truncate"
              >
                {{ file.name }}
              </p>
              <div class="flex items-center gap-1 mt-0.5">
                <!-- Done -->
                <template v-if="file.status === 'done'">
                  <ElTag type="success" size="small" round effect="light">{{
                    t("converter.complete")
                  }}</ElTag>
                  <span class="text-xs text-slate-400"
                    >• {{ formatSize(file.processedSize || 0) }}</span
                  >
                </template>
                <!-- Processing -->
                <template v-else-if="file.status === 'processing'">
                  <ElTag type="primary" size="small" round effect="light">{{
                    t("common.processing")
                  }}</ElTag>
                  <span class="text-xs text-slate-400">{{
                    t("converter.converting")
                  }}</span>
                </template>
                <!-- Pending -->
                <template v-else>
                  <ElTag type="info" size="small" round effect="light">{{
                    t("converter.waiting")
                  }}</ElTag>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-0 flex-shrink-0">
              <ElButton
                v-if="file.status === 'done'"
                circle
                text
                size="small"
                @click="onDownload(file.id)"
              >
                <span class="material-symbols-outlined text-[20px]"
                  >download</span
                >
              </ElButton>
              <ElButton circle text size="small" @click="onRemove(file.id)">
                <span class="material-symbols-outlined text-[20px]">{{
                  file.status === "processing" ? "close" : "delete"
                }}</span>
              </ElButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Global Action Bar (visible when files exist) -->
      <!-- Web: sticky bar -->
      <div v-if="hasFiles" class="hidden md:block sticky bottom-4 z-40">
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
                {{ t("converter.totalSavings") }}
                <span class="font-bold text-green-600 dark:text-green-400">{{
                  formatSize(totalSavings)
                }}</span>
              </span>
            </div>
          </div>
          <div class="flex gap-3">
            <ElButton @click="onReset">
              <span class="material-symbols-outlined text-sm mr-1"
                >restart_alt</span
              >
              {{ t("common.reset") }}
            </ElButton>
            <ElButton
              type="primary"
              :disabled="isBusy"
              @click="allDone ? onDownloadAll() : onProcess()"
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
    </div>

    <!-- Mobile: fixed bottom bar -->
    <div
      v-if="hasFiles"
      class="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40"
    >
      <ElButton
        type="primary"
        size="large"
        class="!w-full !rounded-xl !py-5 !text-base !font-bold"
        :disabled="isBusy"
        @click="allDone ? onDownloadAll() : onProcess()"
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
  </div>
</template>
