import { useAuthConfig } from "./useAuthConfig";

export function useAccountStatus() {
  const { isConfigured } = useAuthConfig();
  const user = useSupabaseUser();
  const route = useRoute();
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
  } = useTrialQuota();

  const avatarUrl = computed(
    () =>
      user.value?.user_metadata?.avatar_url ||
      user.value?.user_metadata?.picture ||
      null,
  );

  const displayName = computed(() => {
    return (
      user.value?.user_metadata?.full_name ||
      user.value?.user_metadata?.name ||
      user.value?.email ||
      "PixelSwift User"
    );
  });

  const userInitials = computed(() => {
    const source = displayName.value.trim();
    if (!source) {
      return "P";
    }

    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2);
  });

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

  async function signOut() {
    if (!isConfigured.value) {
      resetQuota();
      return;
    }

    const client = useSupabaseClient();
    await client.auth.signOut();
    resetQuota();

    if (route.path !== "/") {
      await navigateTo("/");
    }
  }

  watch(
    () => user.value?.id,
    async (nextUserId, previousUserId) => {
      if (!isConfigured.value) {
        resetQuota();
        return;
      }

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
