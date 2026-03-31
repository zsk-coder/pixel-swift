/**
 * Composable for browser extension integration.
 * Handles URL parameter detection and image fetching via server proxy.
 *
 * Usage:
 *   const { isFetching } = useExtensionImage(onFilesAdded)
 */
export function useExtensionImage(
  onFilesAdded: (files: File[]) => void,
  options?: { onStart?: () => void; onEnd?: () => void },
) {
  const route = useRoute();
  const router = useRouter();
  const isFetching = ref(false);

  onMounted(async () => {
    const imageUrl = route.query.url as string;
    if (!imageUrl) return;

    try {
      isFetching.value = true;
      options?.onStart?.();

      const response = await fetch(
        `/api/fetch-image?url=${encodeURIComponent(imageUrl)}`,
      );
      if (!response.ok) throw new Error("Failed to fetch image from URL");

      const blob = await response.blob();

      // Extract filename from URL or use a default
      let filename = "downloaded-image";
      try {
        const urlObj = new URL(imageUrl);
        const nameMatch = urlObj.pathname.match(/\/([^/?#]+)$/);
        filename = nameMatch?.[1] || filename;
      } catch {}

      if (!filename.includes(".")) {
        const ext = blob.type.split("/")[1] || "jpg";
        filename += `.${ext}`;
      }

      const file = new File([blob], filename, { type: blob.type });
      onFilesAdded([file]);

      // Clean up the URL so F5 doesn't re-trigger
      const query = { ...route.query };
      delete query.url;
      router.replace({ query });
    } catch (error) {
      console.error("Extension integration error:", error);
    } finally {
      isFetching.value = false;
      options?.onEnd?.();
    }
  });

  return { isFetching };
}
