import { useAuthConfig } from "./useAuthConfig";

/**
 * 账号状态管理组合式函数
 * 提供关于当前用户的完整的视图状态（个人资料，配额，计划，认证服务是否可用状态）。
 * 内置对用户登录/登出状态自动侦听并立刻刷新配额的功能。
 */
export function useAccountStatus() {
  const { isConfigured } = useAuthConfig();
  const user = useSupabaseUser(); // 引用 Supabase 提供的全局响应式 JWT User State
  const route = useRoute();
  const localePath = useLocalePath();
  const {
    quota,
    pending,
    errorMessage,
    refreshQuota,
    resetQuota,
    remainingTrialCount,
    planType,
    hasTrialRemaining,
    isLocked,
    authAvailable,
  } = useTrialQuota(); // 获取用户可用配额模块状态

  // 提取用户头像，优先使用在 provider 里配置的通用变量名
  const avatarUrl = computed(
    () =>
      user.value?.user_metadata?.avatar_url ||
      user.value?.user_metadata?.picture ||
      null,
  );

  // 提取用户显示名称：如果有全称用全称，没有全称用邮箱兜底
  const displayName = computed(() => {
    return (
      user.value?.user_metadata?.full_name ||
      user.value?.user_metadata?.name ||
      user.value?.email ||
      "PixelSwift User"
    );
  });

  // 生成用户名首字母（用于头像未加载，或是加载失败时作为 Fallback 图形显示）
  const userInitials = computed(() => {
    const source = displayName.value.trim();
    if (!source) {
      return "P";
    }

    // 将首两个字母组合（例如 "Zhang Shuaikang" -> "ZS"）
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2);
  });

  /**
   * 按需手动刷新账号的状态（配额为主）
   * 比如客户端从后台恢复到了前台 (visibilitychange 触发) 时重新拉取数据
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
   * 执行退出登录流程，并重置配额信息
   */
  async function signOut() {
    if (!isConfigured.value) {
      resetQuota();
      return;
    }

    const client = useSupabaseClient();
    await client.auth.signOut(); // 触发 SDK 内置清理逻辑
    resetQuota();

    // 如果登出并非在首页，则路由重定向回首页
    const targetPath = localePath("/");
    if (route.path !== targetPath) {
      await navigateTo(targetPath);
    }
  }

  // 自动侦察当前用户状态变更（Supabase 的 onAuthStateChange 也是改这个 user ID 引用）
  // 以保证 JWT 的任何变更都会同步影响配额状态
  watch(
    () => user.value?.id,
    async (nextUserId, previousUserId) => {
      if (!isConfigured.value) {
        resetQuota();
        return;
      }

      // 监听到不同 UID 进来说明发生账号切换或者首次完成登陆
      if (nextUserId && nextUserId !== previousUserId) {
        await refreshQuota();
        return;
      }

      // UID 取不到说明彻底下线，清空配额避免展示旧数据
      if (!nextUserId) {
        resetQuota();
      }
    },
    { immediate: true }, // 在组件 setup 初始化时自执行一次
  );

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
    signOut,
  };
}
