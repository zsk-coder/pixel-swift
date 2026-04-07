<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { UploadInstance } from "element-plus";
import { MAX_FILE_COUNT } from "~/utils/constants";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    accept?: string;
    maxSize?: number;
    maxCount?: number;
    multiple?: boolean;
    hint?: string;
  }>(),
  {
    accept: "image/jpeg,image/png,image/webp",
    maxSize: 50,
    maxCount: MAX_FILE_COUNT,
    multiple: true,
    hint: "",
  },
);

const emit = defineEmits<{
  files: [files: File[]];
}>();

const uploadRef = ref<UploadInstance>();

// Parse accepted MIME types into a lookup set for validation
const acceptedMimeTypes = computed(() => {
  return new Set(
    props.accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
});

// Map common MIME types to user-friendly extensions for error messages
const acceptedExtensions = computed(() => {
  // If wildcard like "image/*", no need to list specific formats
  if ([...acceptedMimeTypes.value].some((m) => m.endsWith("/*"))) {
    return "JPG, PNG, WEBP, BMP, GIF, TIFF, AVIF...";
  }
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WEBP",
    "image/bmp": "BMP",
    "image/gif": "GIF",
    "image/tiff": "TIFF",
    "image/avif": "AVIF",
  };
  return [...acceptedMimeTypes.value].map((m) => mimeToExt[m] || m).join(", ");
});

/** Check if a file's type is in the accepted list */
function isFileAccepted(file: File): boolean {
  if (!props.accept) return true;
  const mime = file.type.toLowerCase();

  // Support wildcard patterns like "image/*"
  for (const accepted of acceptedMimeTypes.value) {
    if (accepted.endsWith("/*")) {
      const prefix = accepted.slice(0, -1); // "image/*" → "image/"
      if (mime.startsWith(prefix)) return true;
    } else if (accepted === mime) {
      return true;
    }
  }

  // Fallback: check by extension (some browsers report empty type)
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const extMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    bmp: "image/bmp",
    gif: "image/gif",
    tif: "image/tiff",
    tiff: "image/tiff",
    avif: "image/avif",
    ico: "image/x-icon",
    svg: "image/svg+xml",
  };
  const mappedMime = extMime[ext];
  if (mappedMime) {
    for (const accepted of acceptedMimeTypes.value) {
      if (accepted.endsWith("/*")) {
        if (mappedMime.startsWith(accepted.slice(0, -1))) return true;
      } else if (accepted === mappedMime) {
        return true;
      }
    }
  }

  return false;
}

/** Filter files and show warning for rejected ones */
function filterAcceptedFiles(files: File[]): File[] {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (isFileAccepted(file)) {
      accepted.push(file);
    } else {
      rejected.push(file.name);
    }
  }
  if (rejected.length > 0) {
    ElMessage.warning(
      t("errors.unsupportedFormat", {
        formats: acceptedExtensions.value,
      }),
    );
  }
  return accepted;
}

// 超出文件数量限制时，给出明确提示（ElUpload 默认行为是静默丢弃）
function onExceed() {
  ElMessage.warning(t("errors.maxFilesExceeded", { count: props.maxCount }));
}

function clearFiles() {
  uploadRef.value?.clearFiles();
}

defineExpose({ clearFiles });

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files: File[] = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  const accepted = filterAcceptedFiles(files);
  if (accepted.length) emit("files", accepted);
}

// Listen for paste globally
onMounted(() => {
  document.addEventListener("paste", onPaste);
});

onUnmounted(() => {
  document.removeEventListener("paste", onPaste);
});
</script>

<template>
  <ElUpload
    ref="uploadRef"
    class="file-uploader"
    drag
    action="#"
    :accept="accept"
    :multiple="multiple"
    :show-file-list="false"
    :auto-upload="false"
    :on-change="
      (file: any) => {
        if (file?.raw) {
          const accepted = filterAcceptedFiles([file.raw as File]);
          if (accepted.length) emit('files', accepted);
        }
      }
    "
    :limit="maxCount"
    :on-exceed="onExceed"
  >
    <!-- Upload Icon -->
    <div
      class="h-12 w-12 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto"
    >
      <span
        aria-hidden="true"
        class="material-symbols-outlined text-3xl md:text-4xl"
        >cloud_upload</span
      >
    </div>

    <!-- Text -->
    <div
      class="flex flex-col items-center gap-1 md:gap-2 text-center mt-4 md:mt-6"
    >
      <!-- Web text -->
      <p
        class="hidden md:block text-xl font-bold leading-tight text-slate-900 dark:text-white"
      >
        {{ t("upload.dragTitle") }}
      </p>
      <p class="hidden md:block text-sm text-slate-500 dark:text-slate-400">
        {{ t("upload.orBrowse") }}
      </p>
      <!-- Mobile text -->
      <p
        class="md:hidden text-sm font-semibold text-slate-700 dark:text-slate-200"
      >
        {{ t("upload.tapToUpload") }}
      </p>
      <p class="md:hidden text-xs text-slate-500 dark:text-slate-400">
        {{ t("upload.selectFromAlbum") }}
      </p>
    </div>

    <!-- Select Images Button (web only) -->
    <div class="hidden md:flex justify-center mt-4 md:mt-6">
      <span
        class="inline-flex items-center justify-center gap-2 rounded-lg h-11 px-6 bg-primary text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
      >
        <span aria-hidden="true" class="material-symbols-outlined text-lg"
          >add_photo_alternate</span
        >
        <span>{{ t("upload.selectImages") }}</span>
      </span>
    </div>

    <!-- Supported formats hint -->
    <p
      class="text-xs text-slate-500 dark:text-slate-400 mt-3 md:mt-4 text-center"
    >
      {{ hint || t("upload.supportedFormats") }}
    </p>
  </ElUpload>
</template>

<style scoped>
/* Override el-upload drag zone styles to match our design */
.file-uploader :deep(.el-upload) {
  width: 100%;
}

.file-uploader :deep(.el-upload-dragger) {
  width: 100%;
  border: 2px dashed rgba(37, 99, 235, 0.3);
  border-radius: 1rem;
  background: white;
  padding: 3rem 1.5rem;
  transition: all 0.2s;
}

html.dark .file-uploader :deep(.el-upload-dragger) {
  background: #1e293b;
  border-color: #334155;
}

.file-uploader :deep(.el-upload-dragger:hover) {
  border-color: #2563eb;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

html.dark .file-uploader :deep(.el-upload-dragger:hover) {
  border-color: #2563eb;
}

.file-uploader :deep(.el-upload-dragger.is-dragover) {
  border-color: #2563eb;
  border-style: solid;
  background: rgba(37, 99, 235, 0.05);
}

html.dark .file-uploader :deep(.el-upload-dragger.is-dragover) {
  background: rgba(37, 99, 235, 0.1);
}

/* Remove el-upload default icon and text */
.file-uploader :deep(.el-upload-dragger .el-upload__text),
.file-uploader :deep(.el-upload-dragger .el-icon--upload) {
  display: none;
}

@media (min-width: 768px) {
  .file-uploader :deep(.el-upload-dragger) {
    padding: 4rem 1.5rem;
  }
}
</style>
