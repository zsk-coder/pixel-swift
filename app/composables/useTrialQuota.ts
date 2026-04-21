import { useAuthConfig } from "./useAuthConfig";

interface TrialQuota {
  authAvailable: boolean;
  authenticated: boolean;
  canGenerate: boolean;
  isLocked: boolean;
  planType: "free" | "pro";
  subscriptionStatus: "inactive" | "active";
  trialRemaining: number;
  trialTotal: number;
  trialUsed: number;
}

const DEFAULT_TRIAL_QUOTA: TrialQuota = {
  authAvailable: false,
  authenticated: false,
  canGenerate: false,
  isLocked: true,
  planType: "free",
  subscriptionStatus: "inactive",
  trialRemaining: 0,
  trialTotal: 0,
  trialUsed: 0,
};

let refreshPromise: Promise<TrialQuota> | null = null;
let refreshNonce = 0;

export function useTrialQuota() {
  const { isConfigured } = useAuthConfig();
  const user = useSupabaseUser();
  // Capture cookies during SSR setup so they can be forwarded to internal $fetch calls
  const ssrHeaders = useRequestHeaders(["cookie"]);
  const quota = useState<TrialQuota>("trial-quota", () => ({
    ...DEFAULT_TRIAL_QUOTA,
  }));
  const pending = useState<boolean>("trial-quota-pending", () => false);
  const errorMessage = useState<string | null>("trial-quota-error", () => null);
  const lastFetchedAt = useState<number | null>(
    "trial-quota-last-fetched-at",
    () => null,
  );

  async function refreshQuota() {
    if (!isConfigured.value) {
      resetQuota();
      return quota.value;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    pending.value = true;
    const currentNonce = refreshNonce;

    // 复用进行中的请求，避免多个组件同时读取账号状态时重复打接口
    let request!: Promise<TrialQuota>;
    request = (async () => {
      try {
        const nextQuota = await $fetch<TrialQuota>("/api/workflow-copilot/quota", {
          headers: import.meta.server
            ? (ssrHeaders as Record<string, string>)
            : undefined,
          credentials: "include",
        });

        if (currentNonce === refreshNonce) {
          quota.value = nextQuota;
          errorMessage.value = null;
          lastFetchedAt.value = Date.now();
        }

        return quota.value;
      } catch (error) {
        if (currentNonce === refreshNonce) {
          errorMessage.value =
            error instanceof Error ? error.message : "Failed to load trial quota.";
          quota.value = { ...DEFAULT_TRIAL_QUOTA };
          lastFetchedAt.value = null;
        }

        return quota.value;
      } finally {
        if (refreshPromise === request) {
          refreshPromise = null;
        }

        if (currentNonce === refreshNonce) {
          pending.value = false;
        }
      }
    })();

    refreshPromise = request;
    return request;
  }

  async function ensureQuotaFresh(maxAgeMs = 60000) {
    if (!isConfigured.value) {
      resetQuota();
      return quota.value;
    }

    if (!user.value) {
      return quota.value;
    }

    if (
      lastFetchedAt.value &&
      Date.now() - lastFetchedAt.value <= maxAgeMs
    ) {
      return quota.value;
    }

    return refreshQuota();
  }

  function resetQuota() {
    refreshNonce += 1;
    refreshPromise = null;
    quota.value = { ...DEFAULT_TRIAL_QUOTA };
    pending.value = false;
    errorMessage.value = null;
    lastFetchedAt.value = null;
  }

  return {
    quota,
    pending,
    errorMessage,
    lastFetchedAt,
    refreshQuota,
    ensureQuotaFresh,
    resetQuota,
    remainingTrialCount: computed(() => quota.value.trialRemaining),
    planType: computed(() => quota.value.planType),
    hasTrialRemaining: computed(() => quota.value.trialRemaining > 0),
    isLocked: computed(() => quota.value.isLocked),
    authAvailable: computed(() => quota.value.authAvailable),
  };
}
