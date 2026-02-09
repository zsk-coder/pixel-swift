<script setup lang="ts">
const props = defineProps<{
  originalSrc: string;
  compressedSrc: string;
  originalLabel?: string;
  compressedLabel?: string;
  maxHeight?: string; // e.g. "600px"
}>();

const containerRef = ref<HTMLDivElement>();
const sliderPosition = ref(50);
const isDragging = ref(false);

function onPointerDown(e: PointerEvent) {
  isDragging.value = true;
  containerRef.value?.setPointerCapture(e.pointerId);
  updatePosition(e);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  updatePosition(e);
}

function onPointerUp() {
  isDragging.value = false;
}

function updatePosition(e: PointerEvent) {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  sliderPosition.value = (x / rect.width) * 100;
}

const containerStyle = computed(() => {
  return props.maxHeight ? { maxHeight: props.maxHeight } : {};
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden rounded-card select-none cursor-col-resize flex items-center justify-center bg-slate-100 dark:bg-slate-800"
    :style="containerStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <!-- Original image (full width, contain for tall images) -->
    <img
      :src="originalSrc"
      class="block max-w-full max-h-full object-contain"
      :style="containerStyle"
      alt="original"
      draggable="false"
    />

    <!-- Compressed image (clipped) -->
    <img
      :src="compressedSrc"
      class="absolute inset-0 w-full h-full block object-contain"
      :style="{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }"
      alt="compressed"
      draggable="false"
    />

    <!-- Labels -->
    <div
      class="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded z-20"
    >
      {{ originalLabel || "Original" }}
    </div>
    <div
      class="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded z-20"
    >
      {{ compressedLabel || "Compressed" }}
    </div>

    <!-- Slider line -->
    <div
      class="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
      :style="{ left: `${sliderPosition}%` }"
    >
      <!-- Handle -->
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-high flex items-center justify-center text-sm font-bold text-text-primary"
      >
        ↔
      </div>
    </div>
  </div>
</template>
