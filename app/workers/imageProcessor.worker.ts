/**
 * Image Processor Web Worker
 *
 * Handles image processing in a separate thread to avoid UI blocking.
 * Communicates with main thread via structured messages.
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

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { id, action, buffer, options } = e.data;

  try {
    // Report progress
    postMessage({ id, type: "progress", progress: 10 } satisfies WorkerOutput);

    // Create image bitmap from buffer
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    postMessage({ id, type: "progress", progress: 30 } satisfies WorkerOutput);

    // Calculate dimensions
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

    // Draw to OffscreenCanvas
    const canvas = new OffscreenCanvas(outWidth, outHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);

    postMessage({ id, type: "progress", progress: 60 } satisfies WorkerOutput);

    // Encode
    const mimeType = getMimeType(options.outputFormat || "jpg");
    const quality = (options.quality ?? 85) / 100;
    const resultBlob = await canvas.convertToBlob({ type: mimeType, quality });
    const resultBuffer = await resultBlob.arrayBuffer();

    postMessage({ id, type: "progress", progress: 90 } satisfies WorkerOutput);

    // Send result (transfer buffer for zero-copy)
    postMessage(
      {
        id,
        type: "complete",
        result: {
          buffer: resultBuffer,
          width: outWidth,
          height: outHeight,
          format: options.outputFormat || "jpg",
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

function getMimeType(format: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[format] || "image/jpeg";
}
