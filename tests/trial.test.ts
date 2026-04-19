import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRIAL_TOTAL,
  createAuthUnavailableQuotaPayload,
  createDefaultEntitlement,
  createUnauthenticatedQuotaPayload,
  toQuotaPayload,
} from "../server/lib/billing/trial";

describe("createDefaultEntitlement", () => {
  it("creates a free plan with 3 available trials", () => {
    expect(createDefaultEntitlement("user-123")).toEqual({
      user_id: "user-123",
      plan_type: "free",
      trial_total: DEFAULT_TRIAL_TOTAL,
      trial_used: 0,
      subscription_status: "inactive",
    });
  });
});

describe("toQuotaPayload", () => {
  it("computes remaining trial count and generation availability", () => {
    expect(
      toQuotaPayload({
        plan_type: "free",
        trial_total: 3,
        trial_used: 1,
      }),
    ).toMatchObject({
      authAvailable: true,
      planType: "free",
      trialTotal: 3,
      trialUsed: 1,
      trialRemaining: 2,
      canGenerate: true,
    });
  });

  it("unlocks generation for pro users", () => {
    expect(
      toQuotaPayload({
        plan_type: "pro",
        trial_total: 3,
        trial_used: 3,
      }),
    ).toMatchObject({
      authAvailable: true,
      planType: "pro",
      canGenerate: true,
      isLocked: false,
    });
  });
});

describe("fallback quota payloads", () => {
  it("returns a stable unauthenticated payload when auth is available", () => {
    expect(createUnauthenticatedQuotaPayload()).toEqual({
      authAvailable: true,
      authenticated: false,
      canGenerate: false,
      isLocked: true,
      planType: "free",
      subscriptionStatus: "inactive",
      trialRemaining: 0,
      trialTotal: 0,
      trialUsed: 0,
    });
  });

  it("returns a stable disabled-auth payload when Supabase is not configured", () => {
    expect(createAuthUnavailableQuotaPayload()).toEqual({
      authAvailable: false,
      authenticated: false,
      canGenerate: false,
      isLocked: true,
      planType: "free",
      subscriptionStatus: "inactive",
      trialRemaining: 0,
      trialTotal: 0,
      trialUsed: 0,
    });
  });
});
