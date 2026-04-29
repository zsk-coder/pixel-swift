<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const {
  user,
  avatarUrl,
  displayName,
  userInitials,
  planType,
  remainingTrialCount,
  quota,
  ensureQuotaFresh,
  signOut,
} = useAccountStatus();
const currentPlanLabel = computed(() =>
  planType.value === "pro" ? t("auth.menu.pro") : t("auth.menu.free"),
);

// 头像加载失败时回退显示用户名首字母
const avatarBroken = ref(false);
const showAvatar = computed(() => avatarUrl.value && !avatarBroken.value);
function handleAvatarError() {
  avatarBroken.value = true;
}

const quotaProgress = computed(() => {
  if (!quota.value.trialTotal) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, (quota.value.trialRemaining / quota.value.trialTotal) * 100),
  );
});

const quotaLabel = computed(() =>
  t("auth.menu.trialLeft")
    .replace("{used}", String(quota.value.trialRemaining))
    .replace("{total}", String(quota.value.trialTotal)),
);

async function handleVisibilityChange(visible: boolean) {
  if (!visible) {
    return;
  }

  await ensureQuotaFresh(60000);
}

// 点击升级按钮时先关闭下拉菜单再跳转
const dropdownRef = ref();
function handleUpgradeClick() {
  dropdownRef.value?.handleClose?.();
}
</script>

<template>
  <ElDropdown
    ref="dropdownRef"
    trigger="click"
    placement="bottom"
    :hide-on-click="false"
    @visible-change="handleVisibilityChange"
  >
    <!-- 触发按钮：头像圆形按钮 -->
    <button
      class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200/50 transition-all hover:ring-2 hover:ring-primary-100 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700/50 dark:hover:ring-primary/20"
      :aria-label="t('auth.menu.account')"
    >
      <img
        v-if="showAvatar"
        :src="avatarUrl"
        :alt="displayName"
        referrerpolicy="no-referrer"
        class="h-full w-full object-cover"
        @error="handleAvatarError"
      />
      <span
        v-else
        class="flex h-full w-full items-center justify-center bg-primary-50 text-xs font-semibold text-primary dark:bg-primary/10 dark:text-primary-100"
        >{{ userInitials }}</span
      >
    </button>

    <template #dropdown>
      <div
        class="w-72 overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:bg-slate-900"
      >
        <!-- 用户信息区域 -->
        <div class="bg-slate-50/50 p-4 dark:bg-slate-800/50">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
            >
              <img
                v-if="showAvatar"
                :src="avatarUrl"
                :alt="displayName"
                referrerpolicy="no-referrer"
                class="h-full w-full object-cover"
                @error="handleAvatarError"
              />
              <span
                v-else
                class="flex h-full w-full items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary dark:bg-primary/10 dark:text-primary-100"
                >{{ userInitials }}</span
              >
            </div>
            <div class="flex min-w-0 flex-col">
              <span
                class="truncate text-sm font-bold text-slate-900 dark:text-white"
                >{{ displayName }}</span
              >
              <span
                class="w-40 truncate text-xs text-slate-500 dark:text-slate-400"
                >{{ user?.email }}</span
              >
            </div>
          </div>
        </div>

        <!-- 套餐状态区域 -->
        <div class="border-t border-slate-200/50 p-4 dark:border-slate-700/50">
          <!-- Current Plan 行 -->
          <div class="mb-3 flex items-center justify-between">
            <span
              class="text-sm font-medium text-slate-900 dark:text-slate-200"
              >{{ t("auth.menu.currentPlan") }}</span
            >
            <span
              class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >{{ currentPlanLabel }}</span
            >
          </div>

          <!-- 配额指示卡片 -->
          <div
            class="mb-4 rounded-lg border border-primary-100/50 bg-primary-50/30 p-3 dark:border-primary/20 dark:bg-primary/5"
          >
            <div class="flex items-start gap-2">
              <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-900 dark:text-white"
                  >{{ remainingTrialCount }} / {{ quota.trialTotal }}</span
                >
                <span class="text-xs text-slate-500 dark:text-slate-400">{{
                  quotaLabel
                }}</span>
              </div>
            </div>
            <!-- 进度条 -->
            <div
              class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            >
              <div
                class="h-1.5 rounded-full bg-primary transition-[width] duration-300"
                :style="{ width: `${quotaProgress}%` }"
              />
            </div>
          </div>

          <!-- Upgrade CTA 按钮（仅 Free 用户可见） -->
          <NuxtLink
            v-if="planType !== 'pro'"
            :to="localePath('/pricing')"
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02] hover:bg-primary-dark active:scale-95"
            @click="handleUpgradeClick"
          >
            {{ t("auth.menu.upgrade") }}
          </NuxtLink>
        </div>

        <!-- 底部链接区域 -->
        <div class="border-t border-slate-200/50 p-2 dark:border-slate-700/50">
          <button
            type="button"
            class="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50/50 dark:text-red-400 dark:hover:bg-red-500/10"
            @click="signOut"
          >
            <span class="material-symbols-outlined text-lg">logout</span>
            {{ t("auth.menu.signOut") }}
          </button>
        </div>
      </div>
    </template>
  </ElDropdown>
</template>
