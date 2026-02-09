<script setup lang="ts">
const { t } = useI18n();

export interface FileItem {
  id: string;
  name: string;
  originalSize: number;
  processedSize?: number;
  width?: number;
  height?: number;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  preview?: string;
  error?: string;
}

const props = defineProps<{
  files: FileItem[];
}>();

const emit = defineEmits<{
  download: [id: string];
  preview: [id: string];
  remove: [id: string];
  cancel: [id: string];
}>();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getReduction(original: number, processed: number): string {
  const pct = Math.round(((original - processed) / original) * 100);
  return `-${pct}%`;
}

const statusConfig = {
  pending: { icon: "⏳", color: "text-gray-400" },
  processing: { icon: "🔄", color: "text-brand" },
  done: { icon: "✅", color: "text-success" },
  error: { icon: "❌", color: "text-danger" },
};
</script>

<template>
  <div v-if="files.length" class="space-y-2">
    <div
      v-for="file in files"
      :key="file.id"
      class="card flex items-center gap-4 p-4"
    >
      <!-- Thumbnail -->
      <div
        class="w-12 h-12 rounded-btn bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0"
      >
        <img
          v-if="file.preview"
          :src="file.preview"
          :alt="file.name"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-xl">🖼️</span>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <p class="font-medium truncate text-text-primary dark:text-dark-text">
          {{ file.name }}
        </p>
        <div class="flex items-center gap-2 text-caption text-text-secondary">
          <span>{{ formatSize(file.originalSize) }}</span>
          <template v-if="file.processedSize">
            <span>→</span>
            <span class="text-success">{{
              formatSize(file.processedSize)
            }}</span>
            <span class="text-success"
              >({{ getReduction(file.originalSize, file.processedSize) }})</span
            >
          </template>
        </div>
        <!-- Progress bar -->
        <div v-if="file.status === 'processing'" class="mt-1">
          <ProgressBar :percent="file.progress" />
        </div>
      </div>

      <!-- Status + Actions -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span :class="statusConfig[file.status].color">
          {{ statusConfig[file.status].icon }}
        </span>

        <template v-if="file.status === 'done'">
          <button class="btn-text text-sm" @click="emit('preview', file.id)">
            {{ t("common.preview") }}
          </button>
          <button
            class="btn-primary text-sm px-3 py-1.5"
            @click="emit('download', file.id)"
          >
            {{ t("common.download") }}
          </button>
        </template>

        <template v-if="file.status === 'processing'">
          <button
            class="btn-text text-sm text-danger"
            @click="emit('cancel', file.id)"
          >
            {{ t("common.cancel") }}
          </button>
        </template>

        <button
          v-if="file.status !== 'processing'"
          class="text-text-secondary hover:text-danger transition-colors"
          :aria-label="t('common.delete')"
          @click="emit('remove', file.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
