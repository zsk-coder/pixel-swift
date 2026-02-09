<script setup lang="ts">
const { t } = useI18n();

defineProps<{
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    :class="[
      variant === 'secondary' ? 'btn-secondary' : 'btn-primary',
      { 'opacity-50 cursor-not-allowed': disabled || loading },
    ]"
    :disabled="disabled || loading"
    @click="emit('click')"
  >
    <span v-if="loading" class="mr-2 inline-block animate-spin">⏳</span>
    <slot>{{ label || t("common.download") }}</slot>
  </button>
</template>
