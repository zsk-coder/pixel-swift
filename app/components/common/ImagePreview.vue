<script setup lang="ts">
defineProps<{
  src: string;
  alt?: string;
}>();
</script>

<template>
  <div class="rounded-card overflow-hidden bg-gray-100 dark:bg-gray-800">
    <img
      v-if="src"
      :src="src"
      :alt="alt || 'Preview'"
      class="w-full h-auto object-contain max-h-96"
    />
    <div
      v-else
      class="flex items-center justify-center h-48 text-text-secondary"
    >
      <span class="text-4xl">🖼️</span>
    </div>
  </div>
</template>
