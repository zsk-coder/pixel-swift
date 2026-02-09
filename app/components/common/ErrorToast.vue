<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    message: string;
    type?: "error" | "warning" | "success" | "info";
    duration?: number;
  }>(),
  {
    type: "error",
    duration: 5000,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const isVisible = ref(true);

const iconMap = {
  error: "❌",
  warning: "⚠️",
  success: "✅",
  info: "ℹ️",
};

const colorMap = {
  error: "bg-red-50 dark:bg-red-900/20 border-danger text-danger",
  warning: "bg-yellow-50 dark:bg-yellow-900/20 border-warning text-warning",
  success: "bg-green-50 dark:bg-green-900/20 border-success text-success",
  info: "bg-blue-50 dark:bg-blue-900/20 border-brand text-brand",
};

let timer: ReturnType<typeof setTimeout>;

onMounted(() => {
  if (props.duration > 0) {
    timer = setTimeout(() => {
      isVisible.value = false;
      emit("close");
    }, props.duration);
  }
});

onUnmounted(() => {
  clearTimeout(timer);
});

function close() {
  isVisible.value = false;
  emit("close");
}
</script>

<template>
  <Transition name="toast">
    <div
      v-if="isVisible"
      class="fixed top-20 right-4 z-50 max-w-sm border rounded-card p-4 shadow-high flex items-start gap-3"
      :class="colorMap[type]"
      role="alert"
    >
      <span class="flex-shrink-0 text-lg">{{ iconMap[type] }}</span>
      <p class="flex-1 text-sm">{{ message }}</p>
      <button class="flex-shrink-0 opacity-60 hover:opacity-100" @click="close">
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 200ms ease-out;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
