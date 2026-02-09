/**
 * Download Composable
 *
 * Handles single file download and batch ZIP packaging.
 */

export function useDownload() {
  /**
   * Download a single Blob as a file
   */
  function downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download multiple files as a ZIP archive
   * JSZip is dynamically imported to avoid bundling it upfront
   */
  async function downloadAsZip(
    files: Array<{ blob: Blob; name: string }>,
    zipName: string,
  ): Promise<void> {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.name, file.blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    downloadFile(content, zipName);
  }

  /**
   * Generate output filename based on PRD naming rules (section 3.2.2)
   */
  function generateFileName(
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
        if (meta?.width && meta?.height) {
          return `${baseName}_${meta.width}x${meta.height}.${ext}`;
        }
        return `${baseName}_resized.${ext}`;

      default:
        return `${baseName}.${ext}`;
    }
  }

  /**
   * Generate batch ZIP filename
   */
  function generateZipName(action: string): string {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    return `pixelswift_${action}_${date}.zip`;
  }

  return {
    downloadFile,
    downloadAsZip,
    generateFileName,
    generateZipName,
  };
}
