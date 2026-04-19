<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    description: string;
    actionLabel: string;
    badgeLabel?: string;
    helperLabel?: string;
    secondaryHelperLabel?: string;
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    badgeLabel: "",
    helperLabel: "",
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
  <div
    class="relative mx-auto w-full max-w-[29rem] overflow-hidden rounded-[13px] border border-slate-200/80 bg-white/92 px-7 py-10 shadow-[0_20px_54px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all duration-300 dark:border-slate-700/70 dark:bg-slate-900/88 dark:shadow-[0_24px_68px_rgba(2,6,23,0.55)] sm:px-9 sm:py-16"
  >
    <div class="relative flex flex-col items-center text-center">
      <div class="max-w-sm space-y-5">
        <h2 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {{ title }}
        </h2>
        <p class="text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
          {{ description }}
        </p>
      </div>
      <div
        v-if="badgeLabel"
        class="mt-6 mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
      >
        <span class="material-symbols-outlined text-[15px]" style="font-variation-settings: &quot;FILL&quot; 1"> auto_awesome </span>
        <span>{{ badgeLabel }}</span>
      </div>
      <div :class="badgeLabel ? 'mt-2' : 'mt-10'" class="w-full max-w-sm">
        <button
          type="button"
          class="group inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-[18px] text-base font-semibold text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600"
          :disabled="disabled || loading"
          @click="emit('google')"
        >
          <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6A9.4 9.4 0 0 0 2.6 12 9.4 9.4 0 0 0 12 21.4c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1.1-.2-1.6H12Z"
            />
            <path fill="#34A853" d="M3.7 7.5l3.2 2.3A5.6 5.6 0 0 1 12 6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6c-3.6 0-6.7 2-8.3 4.9Z" />
            <path fill="#4A90E2" d="M12 21.4c2.5 0 4.6-.8 6.1-2.3l-2.8-2.3c-.8.6-1.8 1.1-3.3 1.1a5.6 5.6 0 0 1-5.3-3.9L3.5 16.4A9.4 9.4 0 0 0 12 21.4Z" />
            <path fill="#FBBC05" d="M6.7 14a5.8 5.8 0 0 1 0-4L3.5 7.6a9.4 9.4 0 0 0 0 8.8L6.7 14Z" />
          </svg>

          <span>{{ actionLabel }}</span>

          <span v-if="loading" class="material-symbols-outlined animate-spin text-[18px]"> progress_activity </span>
        </button>

        <div class="mt-8 space-y-3 text-center">
          <p v-if="helperLabel" class="text-sm font-medium text-slate-500 dark:text-slate-400">
            {{ helperLabel }}
          </p>

          <div v-if="secondaryHelperLabel" class="inline-flex items-center gap-2 px-1 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span class="material-symbols-outlined text-[15px]" style="font-variation-settings: &quot;FILL&quot; 1"> lock </span>
            <span>{{ secondaryHelperLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
