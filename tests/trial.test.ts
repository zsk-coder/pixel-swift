import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRIAL_TOTAL,
  createAuthUnavailableQuotaPayload,
  createDefaultEntitlement,
  createMissingEntitlementQuotaPayload,
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

  it("returns a locked authenticated payload when entitlements are missing", () => {
    expect(createMissingEntitlementQuotaPayload()).toEqual({
      authAvailable: true,
      authenticated: true,
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

describe("database signup bootstrap", () => {
  it("defines a migration that initializes entitlements when auth users are created", () => {
    const migrationPath = resolve(
      "supabase/migrations/20260420_init_user_entitlements_on_signup.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);

    const source = readFileSync(migrationPath, "utf8");
    expect(source).toContain("create or replace function public.handle_new_user_entitlements()");
    expect(source).toContain("insert into public.user_entitlements");
    expect(source).toContain("on conflict (user_id) do nothing");
    expect(source).toContain("after insert on auth.users");
    expect(source).toContain("create trigger on_auth_user_created_init_entitlements");
  });
});

describe("quota access behavior", () => {
  it("does not recreate entitlements when a record is missing", () => {
    const source = readFileSync(
      resolve("server/api/workflow-copilot/quota.get.ts"),
      "utf8",
    );

    expect(source).not.toContain("createDefaultEntitlement");
    expect(source).not.toContain(".insert(defaultEntitlement)");
    expect(source).toContain("createMissingEntitlementQuotaPayload");
  });

  it("renders quota totals from live data instead of a hard-coded fallback", () => {
    const source = readFileSync(
      resolve("app/components/auth/AccountStatusMenu.vue"),
      "utf8",
    );

    expect(source).not.toContain("trialTotal || 3");
  });

  it("checks quota freshness when the account dropdown opens", () => {
    const source = readFileSync(
      resolve("app/components/auth/AccountStatusMenu.vue"),
      "utf8",
    );

    expect(source).toContain("ensureQuotaFresh");
    expect(source).toContain("@visible-change=\"handleVisibilityChange\"");
    expect(source).toContain("if (!visible) {");
    expect(source).toContain("await ensureQuotaFresh(60000)");
  });

  it("tracks quota freshness metadata in the shared quota composable", () => {
    const source = readFileSync(
      resolve("app/composables/useTrialQuota.ts"),
      "utf8",
    );

    expect(source).toContain("lastFetchedAt");
    expect(source).toContain("ensureQuotaFresh");
    expect(source).toContain("lastFetchedAt.value = null");
  });

  it("reuses in-flight quota refresh requests instead of duplicating them", () => {
    const source = readFileSync(
      resolve("app/composables/useTrialQuota.ts"),
      "utf8",
    );

    expect(source).toContain("refreshPromise");
    expect(source).toContain("if (refreshPromise)");
    expect(source).toContain("refreshPromise = request");
  });

  it("registers account status auth watchers only once", () => {
    const source = readFileSync(
      resolve("app/composables/useAccountStatus.ts"),
      "utf8",
    );

    expect(source).toContain("watchRegistered");
    expect(source).toContain("if (import.meta.client && !watchRegistered.value)");
  });

  it("refreshes quota on initial mount when an authenticated session already exists", () => {
    const source = readFileSync(
      resolve("app/composables/useAccountStatus.ts"),
      "utf8",
    );

    expect(source).toContain("lastFetchedAt");
    expect(source).toContain("onMounted(async () => {");
    expect(source).toContain("if (user.value && !lastFetchedAt.value)");
    expect(source).toContain("await refreshQuota()");
  });
});
