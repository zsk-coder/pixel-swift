<script setup lang="ts">
const props = defineProps<{
  slot: "top-banner" | "sidebar" | "bottom-banner" | "interstitial";
}>();

const adRef = ref<HTMLDivElement>();
const isLoaded = ref(false);

// Placeholder: in production, this would load Google AdSense
// Ad loading is deferred via IntersectionObserver
onMounted(() => {
  if (!adRef.value) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        // TODO: Load actual ad script here
        isLoaded.value = true;
        observer.disconnect();
      }
    },
    { rootMargin: "200px" },
  );

  observer.observe(adRef.value);
});

const sizeClasses: Record<string, string> = {
  "top-banner": "h-[50px] md:h-[90px]",
  sidebar: "hidden md:flex h-[250px] w-[300px]",
  "bottom-banner": "h-[100px] md:h-[90px]",
  interstitial: "h-[250px] w-[300px]",
};
</script>

<template>
  <div
    ref="adRef"
    class="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-card overflow-hidden"
    :class="sizeClasses[slot]"
  >
    <span v-if="!isLoaded" class="text-xs text-text-secondary/40">Ad</span>
    <!-- Ad content will be injected here -->
  </div>
</template>
