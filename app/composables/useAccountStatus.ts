import { useAuthConfig } from "./useAuthConfig";

/**
 * 账号状态管理组合式函数
 * 提供当前用户资料、套餐、配额与认证状态的统一视图。
 * 内置登录态侦听，确保登录、登出与刷新页面后都能同步到最新配额。
 */
export function useAccountStatus() {
  const { isConfigured } = useAuthConfig();
  const user = useSupabaseUser();
  const route = useRoute();
  const localePath = useLocalePath();
  const {
    quota,
    pending,
    errorMessage,
    lastFetchedAt,
    refreshQuota,
    ensureQuotaFresh,
    resetQuota,
    remainingTrialCount,
    planType,
    hasTrialRemaining,
    isLocked,
    authAvailable,
  } = useTrialQuota();
  const watchRegistered = useState<boolean>(
    "account-status-watch-registered",
    () => false,
  );

  // 提取用户头像，优先使用 provider 常见字段。
  const avatarUrl = computed(
    () =>
      user.value?.user_metadata?.avatar_url ||
      user.value?.user_metadata?.picture ||
      null,
  );

  // 优先显示全名，没有全名时回退到邮箱。
  const displayName = computed(() => {
    return (
      user.value?.user_metadata?.full_name ||
      user.value?.user_metadata?.name ||
      user.value?.email ||
      "PixelSwift User"
    );
  });

  // 头像缺失或加载失败时，展示用户首字母作为占位。
  const userInitials = computed(() => {
    const source = displayName.value.trim();
    if (!source) {
      return "P";
    }

    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2);
  });

  /**
   * 手动强制刷新账号状态，主要用于登录回调等必须取服务端真值的场景。
   */
  async function refreshStatus() {
    if (!isConfigured.value) {
      resetQuota();
      return quota.value;
    }

    if (!user.value) {
      resetQuota();
      return quota.value;
    }

    return refreshQuota();
  }

  /**
   * 执行退出登录，并同步清空前端缓存的配额状态。
   */
  async function signOut() {
    if (!isConfigured.value) {
      resetQuota();
      return;
    }

    const client = useSupabaseClient();
    await client.auth.signOut();
    resetQuota();

    const targetPath = localePath("/");
    if (route.path !== targetPath) {
      await navigateTo(targetPath);
    }
  }

  if (import.meta.client && !watchRegistered.value) {
    watchRegistered.value = true;

    watch(
      () => user.value?.id,
      async (nextUserId, previousUserId) => {
        if (!isConfigured.value) {
          resetQuota();
          return;
        }

        // 用户首次恢复会话或发生账号切换时，立即重新拉取服务端 quota 真值。
        if (nextUserId && nextUserId !== previousUserId) {
          await refreshQuota();
          return;
        }

        if (!nextUserId) {
          resetQuota();
        }
      },
      { immediate: true },
    );
  }

  onMounted(async () => {
    // 刷新页面时，Supabase 可能已经恢复了用户，但 watcher 没踩到首个有效值；
    // 这里用 lastFetchedAt 兜底，保证首屏已登录用户至少拉取一次 quota。
    if (user.value && !lastFetchedAt.value) {
      await refreshQuota();
    }
  });

  return {
    user,
    quota,
    pending,
    errorMessage,
    avatarUrl,
    displayName,
    userInitials,
    planType,
    remainingTrialCount,
    hasTrialRemaining,
    isLocked,
    authAvailable,
    isConfigured,
    refreshStatus,
    ensureQuotaFresh,
    signOut,
  };
}
