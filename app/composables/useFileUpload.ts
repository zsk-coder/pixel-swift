/**
 * File Upload Composable
 *
 * Manages file upload state, validation, and previews.
 */
import { runWithConcurrency } from "~/utils/concurrency";

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  format: string;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  error?: string;
}

export interface UploadConfig {
  maxFileSize: number; // bytes
  maxFileCount: number;
  acceptFormats: string[]; // MIME types
}

const DEFAULT_CONFIG: UploadConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFileCount: 100,
  acceptFormats: ["image/jpeg", "image/png", "image/webp"],
};

export function useFileUpload(config: Partial<UploadConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const files = ref<UploadFile[]>([]);

  async function addFiles(rawFiles: File[]): Promise<void> {
    const remaining = finalConfig.maxFileCount - files.value.length;
    const toAdd = rawFiles.slice(0, remaining);
    const tasks: (() => Promise<void>)[] = [];

    for (const file of toAdd) {
      const validation = validateFile(file);
      if (!validation.valid) {
        console.warn(`File rejected: ${file.name} - ${validation.error}`);
        continue;
      }

      const id = generateId();
      files.value.push({
        id,
        file,
        name: file.name,
        size: file.size,
        format: getExtension(file.name),
        preview: "",
        status: "pending",
        progress: 0,
      });

      tasks.push(async () => {
        const preview = await blobToDataUrl(file);
        const item = files.value.find((f) => f.id === id);
        if (item) item.preview = preview;
      });
    }

    runWithConcurrency(tasks, 3).catch(console.error);
  }

  function validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > finalConfig.maxFileSize) {
      return {
        valid: false,
        error: `File exceeds ${finalConfig.maxFileSize / 1024 / 1024}MB limit`,
      };
    }

    // Check by extension
    const ext = getExtension(file.name).toLowerCase();
    const validExtensions = ["jpg", "jpeg", "png", "webp"];
    if (!validExtensions.includes(ext)) {
      return { valid: false, error: `Unsupported format: ${ext}` };
    }

    return { valid: true };
  }

  function removeFile(id: string): void {
    const index = files.value.findIndex((f) => f.id === id);
    if (index !== -1) {
      files.value.splice(index, 1);
    }
  }

  function updateFileStatus(id: string, updates: Partial<UploadFile>): void {
    const file = files.value.find((f) => f.id === id);
    if (file) Object.assign(file, updates);
  }

  function clearAll(): void {
    files.value = [];
  }

  return {
    files: readonly(files),
    addFiles,
    removeFile,
    updateFileStatus,
    clearAll,
    config: finalConfig,
  };
}

function generateId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getExtension(filename: string): string {
  return filename.split(".").pop() || "";
}
