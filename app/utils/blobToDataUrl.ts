/**
 * Convert a Blob or File to a Data URL (base64-encoded string).
 *
 * Unlike `URL.createObjectURL()`, Data URLs are plain strings stored in JS
 * memory and will never be garbage-collected by the browser while the
 * reference is alive. This prevents the "broken image" issue that can occur
 * when a page is left idle for a long time and the browser reclaims blob
 * URL references.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob as data URL"));
    reader.readAsDataURL(blob);
  });
}
