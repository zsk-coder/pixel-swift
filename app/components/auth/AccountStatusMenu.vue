<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const { user, avatarUrl, displayName, userInitials, planType, remainingTrialCount, quota, signOut } = useAccountStatus();
const currentPlanLabel = computed(() => (planType.value === "pro" ? t("auth.menu.pro") : t("auth.menu.free")));

const quotaProgress = computed(() => {
  if (!quota.value.trialTotal) {
    return 0;
  }

  return Math.max(0, Math.min(100, (quota.value.trialRemaining / quota.value.trialTotal) * 100));
});

const quotaLabel = computed(() => t("auth.menu.trialLeft").replace("{used}", String(quota.value.trialRemaining)).replace("{total}", String(quota.value.trialTotal || 3)));
</script>

<template>
  <ElDropdown trigger="click" placement="bottom-end" :hide-on-click="false">
    <button
      class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
      :aria-label="t('auth.menu.account')"
    >
      <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="h-full w-full object-cover" />
      <span v-else class="text-sm font-semibold">{{ userInitials }}</span>
    </button>

    <template #dropdown>
      <div class="w-[320px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-start gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-200">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="h-full w-full object-cover" />
            <span v-else class="text-sm font-semibold">{{ userInitials }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {{ displayName }}
              </p>
              <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                {{ currentPlanLabel }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ t("auth.menu.emailLabel") }}
            </p>
            <p class="truncate text-sm text-slate-600 dark:text-slate-300">
              {{ user?.email }}
            </p>
          </div>
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/80">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ quotaLabel }}
            </p>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400"> {{ remainingTrialCount }} / {{ quota.trialTotal || 3 }} </span>
          </div>
          <div class="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
            <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: `${quotaProgress}%` }" />
          </div>
        </div>

        <NuxtLink
          :to="localePath('/contact')"
          class="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {{ t("auth.menu.upgrade") }}
        </NuxtLink>

        <button
          type="button"
          class="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          @click="signOut"
        >
          {{ t("auth.menu.signOut") }}
        </button>
      </div>
    </template>
  </ElDropdown>
</template>
