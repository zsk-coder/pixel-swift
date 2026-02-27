/**
 * Image Processing Composable
 *
 * Professional-grade image processing using WASM encoders:
 * - JPG:  MozJPEG via @jsquash/jpeg  (superior to Canvas API)
 * - PNG:  @jsquash/png + OxiPNG      (lossless PNG optimization)
 * - WebP: @jsquash/webp              (with Canvas API fallback)
 *
 * All WASM modules are lazily imported for zero initial cost.
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

// ─── WebP Canvas Detection ──────────────────────
let _canvasWebPSupport: boolean | null = null;

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

// ─── WASM Encoder: WebP (@jsquash/webp) ─────────
async function wasmEncodeWebP(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const { default: encode } = await import("@jsquash/webp/encode");
  const buffer = await encode(imageData, { quality });
  return new Blob([buffer], { type: "image/webp" });
}

// ─── WASM Encoder: JPEG (MozJPEG via @jsquash/jpeg) ──
async function wasmEncodeJPEG(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const { default: encode } = await import("@jsquash/jpeg/encode");
  const buffer = await encode(imageData, { quality });
  return new Blob([buffer], { type: "image/jpeg" });
}

// ─── WASM Encoder: PNG (upng-js quantization + OxiPNG optimization) ──
async function wasmEncodePNG(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const UPNG = (await import("upng-js")).default;
  const { default: oxipngOptimise } = await import("@jsquash/oxipng/optimise");

  // Step 1: Lossy quantization via upng-js (like TinyPNG)
  // Map quality 1-100 → color count 16-256
  const cnum = Math.round(16 + (quality / 100) * (256 - 16));
  const quantizedBuffer = UPNG.encode(
    [imageData.data.buffer],
    imageData.width,
    imageData.height,
    cnum,
  );

  // Step 2: Lossless optimization via OxiPNG (only if it shrinks the result)
  try {
    const optimisedBuffer = await oxipngOptimise(quantizedBuffer, {
      level: 3,
      optimiseAlpha: true,
    });
    if (optimisedBuffer.byteLength < quantizedBuffer.byteLength) {
      return new Blob([optimisedBuffer], { type: "image/png" });
    }
  } catch {
    // OxiPNG failed, fall through to quantized result
  }

  return new Blob([quantizedBuffer], { type: "image/png" });
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
      const imageData = ctx.getImageData(0, 0, outWidth, outHeight);

      if (options.action === "compress") {
        // ── Compress mode: use professional WASM encoders ──
        if (outputFormat === "jpg") {
          blob = await wasmEncodeJPEG(imageData, qualityPercent);
        } else if (outputFormat === "png") {
          blob = await wasmEncodePNG(imageData, qualityPercent);
        } else if (outputFormat === "webp") {
          blob = await wasmEncodeWebP(imageData, qualityPercent);
        } else {
          // Fallback for unknown formats
          blob = await canvas.convertToBlob({
            type: getMimeType(outputFormat),
          });
        }
      } else {
        // ── Convert / Resize mode: use Canvas API (fast) or WASM where needed ──
        if (outputFormat === "webp" && !(await canCanvasEncodeWebP())) {
          blob = await wasmEncodeWebP(imageData, qualityPercent);
        } else {
          const mimeType = getMimeType(outputFormat);
          const quality = qualityPercent / 100;
          blob = await canvas.convertToBlob({ type: mimeType, quality });
        }
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
