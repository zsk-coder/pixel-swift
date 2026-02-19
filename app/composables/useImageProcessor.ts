/**
 * Image Processing Composable
 *
 * Core image processing logic using Canvas API.
 * When Canvas cannot encode WebP (Safari/iOS), automatically falls back
 * to a WASM-based encoder (@jsquash/webp) via lazy loading.
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

// ─── WebP WASM Fallback ─────────────────────────
// Cached detection result: null = not tested, true/false = result
let _canvasWebPSupport: boolean | null = null;

/**
 * Test if the browser's Canvas API can actually encode WebP.
 * Safari returns a PNG blob even when asked for image/webp.
 */
async function canCanvasEncodeWebP(): Promise<boolean> {
  if (_canvasWebPSupport !== null) return _canvasWebPSupport;
  try {
    const c = new OffscreenCanvas(1, 1);
    const blob = await c.convertToBlob({ type: "image/webp" });
    _canvasWebPSupport = blob.type === "image/webp";
  } catch {
    _canvasWebPSupport = false;
  }
  return _canvasWebPSupport;
}

/**
 * Encode ImageData to WebP using @jsquash/webp (WASM).
 * The module is lazily imported — zero cost for browsers that don't need it.
 */
async function wasmEncodeWebP(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const { default: encode } = await import("@jsquash/webp/encode");
  const buffer = await encode(imageData, { quality });
  return new Blob([buffer], { type: "image/webp" });
}

export function useImageProcessor() {
  const isProcessing = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  /**
   * Process a single image file
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
      // 1. Load image
      progress.value = 10;
      const imageBitmap = await createImageBitmap(file);

      // 2. Calculate output dimensions
      let outWidth = options.width || imageBitmap.width;
      let outHeight = options.height || imageBitmap.height;

      if (
        options.keepAspectRatio !== false &&
        (options.width || options.height)
      ) {
        const ratio = imageBitmap.width / imageBitmap.height;
        if (options.width && !options.height) {
          outHeight = Math.round(options.width / ratio);
        } else if (options.height && !options.width) {
          outWidth = Math.round(options.height * ratio);
        }
      }

      progress.value = 30;

      // 3. Draw to canvas
      const canvas = new OffscreenCanvas(outWidth, outHeight);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(imageBitmap, 0, 0, outWidth, outHeight);

      progress.value = 60;

      // 4. Encode output
      const outputFormat = options.outputFormat || "jpg";
      const qualityPercent = options.quality ?? 85;
      let blob: Blob;

      if (outputFormat === "webp" && !(await canCanvasEncodeWebP())) {
        // Safari/iOS: use WASM encoder
        const imageData = ctx.getImageData(0, 0, outWidth, outHeight);
        blob = await wasmEncodeWebP(imageData, qualityPercent);
      } else {
        // Standard path: use Canvas API
        const mimeType = getMimeType(outputFormat);
        const quality = qualityPercent / 100;
        blob = await canvas.convertToBlob({ type: mimeType, quality });
      }

      progress.value = 100;

      const duration = Math.round(performance.now() - startTime);

      return {
        blob,
        originalSize: file.size,
        processedSize: blob.size,
        width: outWidth,
        height: outHeight,
        format: outputFormat,
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

function getMimeType(format: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[format] || "image/jpeg";
}
