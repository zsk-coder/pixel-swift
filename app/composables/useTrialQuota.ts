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

export function useTrialQuota() {
  const { isConfigured } = useAuthConfig();
  const quota = useState<TrialQuota>("trial-quota", () => ({ ...DEFAULT_TRIAL_QUOTA }));
  const pending = useState<boolean>("trial-quota-pending", () => false);
  const errorMessage = useState<string | null>("trial-quota-error", () => null);

  async function refreshQuota() {
    if (!isConfigured.value) {
      quota.value = { ...DEFAULT_TRIAL_QUOTA };
      errorMessage.value = null;
      return quota.value;
    }

    pending.value = true;

    try {
      quota.value = await $fetch<TrialQuota>("/api/workflow-copilot/quota");
      errorMessage.value = null;
      return quota.value;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "Failed to load trial quota.";
      quota.value = { ...DEFAULT_TRIAL_QUOTA };
      return quota.value;
    } finally {
      pending.value = false;
    }
  }

  function resetQuota() {
    quota.value = { ...DEFAULT_TRIAL_QUOTA };
    errorMessage.value = null;
  }

  return {
    quota,
    pending,
    errorMessage,
    refreshQuota,
    resetQuota,
    remainingTrialCount: computed(() => quota.value.trialRemaining),
    planType: computed(() => quota.value.planType),
    hasTrialRemaining: computed(() => quota.value.trialRemaining > 0),
    isLocked: computed(() => quota.value.isLocked),
    authAvailable: computed(() => quota.value.authAvailable),
  };
}
