/**
 * Batch Process Composable
 *
 * Orchestrates batch processing of multiple files,
 * coordinating between upload state and image processor.
 */

import type { ProcessOptions, ProcessResult } from "./useImageProcessor";
import type { UploadFile } from "./useFileUpload";

export function useBatchProcess() {
  const { processImage } = useImageProcessor();
  const { downloadAsZip, generateFileName, generateZipName } = useDownload();

  const isProcessing = ref(false);
  const currentIndex = ref(0);
  const results = ref<Map<string, ProcessResult>>(new Map());

  /**
   * Process all pending files
   */
  async function processAll(
    files: UploadFile[],
    options: ProcessOptions,
    onFileUpdate: (id: string, updates: Partial<UploadFile>) => void,
  ): Promise<void> {
    isProcessing.value = true;
    currentIndex.value = 0;
    results.value.clear();

    const pending = files.filter((f) => f.status === "pending");

    for (let i = 0; i < pending.length; i++) {
      const file = pending[i];
      currentIndex.value = i;

      try {
        onFileUpdate(file.id, { status: "processing", progress: 0 });

        const result = await processImage(file.file, options);
        results.value.set(file.id, result);

        onFileUpdate(file.id, {
          status: "done",
          progress: 100,
        });
      } catch (err) {
        onFileUpdate(file.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Processing failed",
        });
      }
    }

    isProcessing.value = false;
  }

  /**
   * Download all completed results as ZIP
   */
  async function downloadAll(
    files: UploadFile[],
    action: ProcessOptions["action"],
  ): Promise<void> {
    const completed = files
      .filter((f) => f.status === "done" && results.value.has(f.id))
      .map((f) => {
        const result = results.value.get(f.id)!;
        return {
          blob: result.blob,
          name: generateFileName(f.name, action, {
            format: result.format,
            width: result.width,
            height: result.height,
          }),
        };
      });

    if (completed.length > 0) {
      await downloadAsZip(completed, generateZipName(action));
    }
  }

  return {
    isProcessing: readonly(isProcessing),
    currentIndex: readonly(currentIndex),
    results: readonly(results),
    processAll,
    downloadAll,
  };
}
