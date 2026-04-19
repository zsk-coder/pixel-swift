export const DEFAULT_TRIAL_TOTAL = 3;

export type PlanType = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active";

export interface UserEntitlementRow {
  user_id: string;
  plan_type: PlanType;
  trial_total: number;
  trial_used: number;
  subscription_status?: SubscriptionStatus;
}

export interface QuotaPayload {
  authAvailable: boolean;
  authenticated: boolean;
  canGenerate: boolean;
  isLocked: boolean;
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus;
  trialRemaining: number;
  trialTotal: number;
  trialUsed: number;
}

export function createDefaultEntitlement(userId: string): UserEntitlementRow {
  return {
    user_id: userId,
    plan_type: "free",
    trial_total: DEFAULT_TRIAL_TOTAL,
    trial_used: 0,
    subscription_status: "inactive",
  };
}

export function createUnauthenticatedQuotaPayload(): QuotaPayload {
  return {
    authAvailable: true,
    authenticated: false,
    canGenerate: false,
    isLocked: true,
    planType: "free",
    subscriptionStatus: "inactive",
    trialRemaining: 0,
    trialTotal: 0,
    trialUsed: 0,
  };
}

export function createAuthUnavailableQuotaPayload(): QuotaPayload {
  return {
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
}

export function toQuotaPayload(
  entitlement: Pick<UserEntitlementRow, "plan_type" | "trial_total" | "trial_used"> &
    Partial<Pick<UserEntitlementRow, "subscription_status">>,
): QuotaPayload {
  const trialTotal = Math.max(0, entitlement.trial_total ?? DEFAULT_TRIAL_TOTAL);
  const trialUsed = Math.max(0, entitlement.trial_used ?? 0);
  const trialRemaining = Math.max(0, trialTotal - trialUsed);
  const planType = entitlement.plan_type;
  const subscriptionStatus = entitlement.subscription_status ?? "inactive";
  const canGenerate = planType === "pro" || trialRemaining > 0;

  return {
    authAvailable: true,
    authenticated: true,
    canGenerate,
    isLocked: !canGenerate,
    planType,
    subscriptionStatus,
    trialRemaining,
    trialTotal,
    trialUsed,
  };
}
