/**
 * Image Processing Composable
 *
 * Professional-grade image processing using WASM encoders:
 * - JPG:  MozJPEG via @jsquash/jpeg  (superior to Canvas API)
 * - PNG:  @jsquash/png + OxiPNG      (lossless PNG optimization)
 * - WebP: @jsquash/webp              (with Canvas API fallback)
 *
 * All heavy processing runs in a Web Worker to keep UI responsive.
 */

export interface ProcessOptions {
  action: "convert" | "compress" | "resize";
  outputFormat?: "jpg" | "png" | "webp" | "pdf";
  quality?: number;
  width?: number;
  height?: number;
  keepAspectRatio?: boolean;
  progressive?: boolean;
}

export interface ProcessResult {
  blob: Blob;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
  format: string;
  duration: number;
}

// ─── Singleton Worker ───────────────────────────
let _worker: Worker | null = null;
let _messageId = 0;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("../workers/imageProcessor.worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return _worker;
}

function getMimeType(format: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[format] || "image/jpeg";
}

export function useImageProcessor() {
  const isProcessing = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  /**
   * Process a single image file via Web Worker
   */
  async function processImage(
    file: File,
    options: ProcessOptions,
  ): Promise<ProcessResult> {
    isProcessing.value = true;
    progress.value = 0;
    error.value = null;

    const startTime = performance.now();

    try {
      const worker = getWorker();
      const id = String(++_messageId);
      const buffer = await file.arrayBuffer();

      const result = await new Promise<{
        buffer: ArrayBuffer;
        width: number;
        height: number;
        format: string;
      }>((resolve, reject) => {
        function handler(e: MessageEvent) {
          const data = e.data;
          if (data.id !== id) return;

          if (data.type === "progress") {
            progress.value = data.progress ?? 0;
          } else if (data.type === "complete") {
            worker.removeEventListener("message", handler);
            resolve(data.result);
          } else if (data.type === "error") {
            worker.removeEventListener("message", handler);
            reject(new Error(data.error || "Processing failed"));
          }
        }

        worker.addEventListener("message", handler);

        // Transfer the buffer to the worker (zero-copy)
        worker.postMessage(
          {
            id,
            action: options.action,
            buffer,
            options: {
              outputFormat: options.outputFormat,
              quality: options.quality,
              width: options.width,
              height: options.height,
              keepAspectRatio: options.keepAspectRatio,
            },
          },
          [buffer],
        );
      });

      progress.value = 100;

      const blob = new Blob([result.buffer], {
        type: getMimeType(result.format),
      });
      const duration = Math.round(performance.now() - startTime);

      return {
        blob,
        originalSize: file.size,
        processedSize: blob.size,
        width: result.width,
        height: result.height,
        format: result.format,
        duration,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Processing failed";
      throw err;
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Process multiple files in batch
   */
  async function processBatch(
    files: File[],
    options: ProcessOptions,
    onProgress?: (index: number, result: ProcessResult) => void,
  ): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const result = await processImage(files[i]!, options);
      results.push(result);
      onProgress?.(i, result);
    }

    return results;
  }

  return {
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    error: readonly(error),
    processImage,
    processBatch,
  };
}
