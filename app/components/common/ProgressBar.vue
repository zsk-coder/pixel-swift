<script setup lang="ts">
withDefaults(
  defineProps<{
    percent: number;
    showLabel?: boolean;
  }>(),
  {
    showLabel: true,
  },
);
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
    >
      <div
        class="h-full bg-brand rounded-full transition-all duration-300 ease-out"
        :style="{ width: `${Math.min(100, Math.max(0, percent))}%` }"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </div>
    <span
      v-if="showLabel"
      class="text-caption text-text-secondary w-10 text-right"
    >
      {{ Math.round(percent) }}%
    </span>
  </div>
</template>
