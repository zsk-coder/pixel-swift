/**
 * Browser Capabilities Detection
 *
 * Detects browser support for key APIs used in image processing.
 * Results are cached after first detection.
 */

let _webpEncodeSupport: boolean | null = null;

/**
 * Detect whether the browser can encode WebP via Canvas.
 * Safari does NOT support WebP encoding via canvas.convertToBlob/toDataURL.
 */
async function detectWebPEncode(): Promise<boolean> {
  if (_webpEncodeSupport !== null) return _webpEncodeSupport;

  try {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f00";
    ctx.fillRect(0, 0, 1, 1);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.5 });
    // Safari silently falls back to PNG when WebP is unsupported
    _webpEncodeSupport = blob.type === "image/webp";
  } catch {
    _webpEncodeSupport = false;
  }

  return _webpEncodeSupport;
}

/**
 * Detect OffscreenCanvas support (required for all processing)
 */
function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== "undefined";
}

export function useBrowserCapabilities() {
  const canEncodeWebP = ref<boolean | null>(null);
  const hasOffscreenCanvas = ref(true);

  // Run detection on mount
  onMounted(async () => {
    hasOffscreenCanvas.value = supportsOffscreenCanvas();

    if (hasOffscreenCanvas.value) {
      canEncodeWebP.value = await detectWebPEncode();
    } else {
      canEncodeWebP.value = false;
    }
  });

  return {
    /** null = still detecting, true/false = result */
    canEncodeWebP: readonly(canEncodeWebP),
    hasOffscreenCanvas: readonly(hasOffscreenCanvas),
  };
}
