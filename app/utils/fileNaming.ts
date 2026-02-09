/**
 * File naming rules (PRD section 3.2.2)
 */

export function generateOutputName(
  original: string,
  action: "convert" | "compress" | "resize",
  meta?: { format?: string; width?: number; height?: number },
): string {
  const baseName = original.replace(/\.[^.]+$/, "");
  const ext = meta?.format || original.split(".").pop() || "jpg";

  switch (action) {
    case "convert":
      return `${baseName}.${ext}`;
    case "compress":
      return `${baseName}_compressed.${ext}`;
    case "resize":
      return meta?.width && meta?.height
        ? `${baseName}_${meta.width}x${meta.height}.${ext}`
        : `${baseName}_resized.${ext}`;
    default:
      return `${baseName}.${ext}`;
  }
}

export function generateZipName(action: string): string {
  const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  return `pixelswift_${action}_${dateStr}.zip`;
}
