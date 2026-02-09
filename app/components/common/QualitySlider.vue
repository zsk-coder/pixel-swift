<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    presets?: Array<{ label: string; value: number }>;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  change: [value: number];
}>();

const isDragging = ref(false);
let debounceTimer: ReturnType<typeof setTimeout>;

function onInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  isDragging.value = true;
  emit("update:modelValue", value);
}

function onRelease() {
  isDragging.value = false;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit("change", props.modelValue);
  }, 300);
}

function selectPreset(value: number) {
  emit("update:modelValue", value);
  // Presets trigger immediately (PRD 2.2.5)
  nextTick(() => emit("change", value));
}

const percentage = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100;
});
</script>

<template>
  <div class="space-y-3">
    <!-- Slider -->
    <div class="relative">
      <input
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-mid [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-125"
        role="slider"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue"
        @input="onInput"
        @mouseup="onRelease"
        @touchend="onRelease"
      />
      <!-- Value tooltip -->
      <div
        class="absolute -top-8 bg-brand text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity"
        :class="isDragging ? 'opacity-100' : 'opacity-0'"
        :style="{ left: `calc(${percentage}% - 16px)` }"
      >
        {{ modelValue }}%
      </div>
    </div>

    <!-- Presets -->
    <div v-if="presets?.length" class="flex flex-wrap gap-2">
      <button
        v-for="preset in presets"
        :key="preset.value"
        class="px-3 py-1.5 rounded-btn text-sm font-medium border transition-all duration-150"
        :class="[
          modelValue === preset.value
            ? 'bg-brand text-white border-brand'
            : 'bg-transparent text-text-secondary border-surface-border dark:border-dark-border hover:border-brand hover:text-brand',
        ]"
        @click="selectPreset(preset.value)"
      >
        {{ preset.label }}
      </button>
    </div>
  </div>
</template>
