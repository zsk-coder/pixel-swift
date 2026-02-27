/**
 * Image Processor Web Worker
 *
 * Handles image processing in a separate thread to avoid UI blocking.
 * Uses professional WASM encoders for compress mode:
 * - JPG:  MozJPEG via @jsquash/jpeg
 * - PNG:  upng-js quantization (like TinyPNG)
 * - WebP: @jsquash/webp
 */

export interface WorkerInput {
  id: string;
  action: "convert" | "compress" | "resize";
  buffer: ArrayBuffer;
  options: {
    outputFormat?: string;
    quality?: number;
    width?: number;
    height?: number;
    keepAspectRatio?: boolean;
  };
}

export interface WorkerOutput {
  id: string;
  type: "progress" | "complete" | "error";
  progress?: number;
  result?: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}

// ─── WASM Encoders (only used in compress mode) ─────────
async function wasmEncodeJPEG(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  const { default: encode } = await import("@jsquash/jpeg/encode");
  return encode(imageData, { quality });
}

async function wasmEncodeWebP(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  const { default: encode } = await import("@jsquash/webp/encode");
  return encode(imageData, { quality });
}

async function wasmEncodePNG(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  const UPNG = (await import("upng-js")).default;

  // Lossy quantization via upng-js (like TinyPNG)
  // Map quality 1-100 → color count 16-256
  const cnum = Math.round(16 + (quality / 100) * (256 - 16));
  return UPNG.encode(
    [imageData.data.buffer],
    imageData.width,
    imageData.height,
    cnum,
  );
}

// ─── Canvas WebP Detection ──────────────────────
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

function getMimeType(format: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[format] || "image/jpeg";
}

// ─── Main Handler ───────────────────────────────
self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { id, action, buffer, options } = e.data;

  try {
    postMessage({ id, type: "progress", progress: 10 } satisfies WorkerOutput);

    // 1. Decode image
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    postMessage({ id, type: "progress", progress: 20 } satisfies WorkerOutput);

    // 2. Calculate dimensions
    let outWidth = options.width || bitmap.width;
    let outHeight = options.height || bitmap.height;

    if (
      options.keepAspectRatio !== false &&
      (options.width || options.height)
    ) {
      const ratio = bitmap.width / bitmap.height;
      if (options.width && !options.height) {
        outHeight = Math.round(options.width / ratio);
      } else if (options.height && !options.width) {
        outWidth = Math.round(options.height * ratio);
      }
    }

    // 3. Draw to OffscreenCanvas
    const canvas = new OffscreenCanvas(outWidth, outHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);

    postMessage({ id, type: "progress", progress: 40 } satisfies WorkerOutput);

    // 4. Encode
    const outputFormat = options.outputFormat || "jpg";
    const qualityPercent = options.quality ?? 85;
    let resultBuffer: ArrayBuffer;

    if (action === "compress") {
      // Compress mode: use professional WASM encoders
      const imageData = ctx.getImageData(0, 0, outWidth, outHeight);

      postMessage({
        id,
        type: "progress",
        progress: 50,
      } satisfies WorkerOutput);

      if (outputFormat === "jpg") {
        resultBuffer = await wasmEncodeJPEG(imageData, qualityPercent);
      } else if (outputFormat === "png") {
        resultBuffer = await wasmEncodePNG(imageData, qualityPercent);
      } else if (outputFormat === "webp") {
        resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
      } else {
        const resultBlob = await canvas.convertToBlob({
          type: getMimeType(outputFormat),
        });
        resultBuffer = await resultBlob.arrayBuffer();
      }
    } else {
      // Convert / Resize: Canvas API (fast) with WASM fallback for WebP
      if (outputFormat === "webp" && !(await canCanvasEncodeWebP())) {
        const imageData = ctx.getImageData(0, 0, outWidth, outHeight);
        resultBuffer = await wasmEncodeWebP(imageData, qualityPercent);
      } else {
        const mimeType = getMimeType(outputFormat);
        const quality = qualityPercent / 100;
        const resultBlob = await canvas.convertToBlob({
          type: mimeType,
          quality,
        });
        resultBuffer = await resultBlob.arrayBuffer();
      }
    }

    postMessage({ id, type: "progress", progress: 90 } satisfies WorkerOutput);

    // 5. Send result (transfer buffer for zero-copy)
    postMessage(
      {
        id,
        type: "complete",
        result: {
          buffer: resultBuffer,
          width: outWidth,
          height: outHeight,
          format: outputFormat,
        },
      } satisfies WorkerOutput,
      [resultBuffer] as any,
    );
  } catch (err) {
    postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    } satisfies WorkerOutput);
  }
};
