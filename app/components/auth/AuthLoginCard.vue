<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    badgeLabel?: string;
    title: string;
    description: string;
    actionLabel: string;
    secondaryHelperLabel?: string;
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    badgeLabel: "",
    secondaryHelperLabel: "",
    disabled: false,
    loading: false,
  },
);

const emit = defineEmits<{
  google: [];
}>();
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-center text-center">
    <h2
      class="mb-4 text-[2.25rem] font-bold tracking-tight text-slate-950 dark:text-white"
    >
      {{ title }}
    </h2>
    <div
      v-if="badgeLabel"
      class="mb-5 inline-flex items-center rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/12"
    >
      {{ badgeLabel }}
    </div>
    <p
      class="mb-8 max-w-sm text-[15px] leading-7 text-slate-500 dark:text-slate-400"
    >
      {{ description }}
    </p>

    <button
      type="button"
      class="group relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-3.5 font-medium text-slate-900 transition-all duration-200 hover:bg-slate-50 hover:shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      :disabled="disabled || loading"
      @click="emit('google')"
    >
      <span class="relative z-10 flex items-center justify-center gap-3">
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z"
          />
          <path
            fill="#34A853"
            d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.58C14.73 18.24 13.48 18.64 12 18.64C9.13 18.64 6.7 16.7 5.84 14.08H2.15V16.94C3.96 20.54 7.69 23 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.08C5.62 13.43 5.49 12.73 5.49 12C5.49 11.27 5.62 10.57 5.84 9.92V7.06H2.15C1.41 8.54 1 10.21 1 12C1 13.79 1.41 15.46 2.15 16.94L5.84 14.08Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.36C13.62 5.36 15.06 5.92 16.2 7.01L19.36 3.85C17.46 2.08 14.97 1 12 1C7.69 1 3.96 3.46 2.15 7.06L5.84 9.92C6.7 7.3 9.13 5.36 12 5.36Z"
          />
        </svg>
        <span>{{ actionLabel }}</span>
        <span
          v-if="loading"
          class="material-symbols-outlined animate-spin text-[18px]"
          >progress_activity</span
        >
      </span>
    </button>

    <p
      v-if="secondaryHelperLabel"
      class="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400"
    >
      <span
        class="material-symbols-outlined text-[16px] text-primary"
        :style="{ fontVariationSettings: '\'FILL\' 1' }"
        >verified</span
      >
      <span>{{ secondaryHelperLabel }}</span>
    </p>
  </div>
</template>
