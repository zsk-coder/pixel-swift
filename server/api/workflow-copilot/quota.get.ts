import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from "#supabase/server";
import { createError, type H3Event } from "h3";

import {
  createAuthUnavailableQuotaPayload,
  createDefaultEntitlement,
  createUnauthenticatedQuotaPayload,
  toQuotaPayload,
  type UserEntitlementRow,
} from "../../lib/billing/trial";
import { isSupabaseServiceEnabled } from "~~/shared/utils/supabaseAuth";

async function getOrCreateEntitlement(event: H3Event, userId: string) {
  const supabase = serverSupabaseServiceRole(event);
  const existingResult = await supabase
    .from("user_entitlements")
    .select("user_id, plan_type, trial_total, trial_used, subscription_status")
    .eq("user_id", userId)
    .maybeSingle<UserEntitlementRow>();

  if (existingResult.error) {
    console.error("[DEBUG] existingResult error:", existingResult.error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read user entitlements: ${existingResult.error.message}`,
    });
  }

  if (existingResult.data) {
    console.log("[DEBUG] Found existing entitlement for user:", userId);
    return existingResult.data;
  }

  console.log("[DEBUG] Creating default entitlement for user:", userId);
  const defaultEntitlement = createDefaultEntitlement(userId);
  const insertResult = await supabase
    .from("user_entitlements")
    .insert(defaultEntitlement)
    .select("user_id, plan_type, trial_total, trial_used, subscription_status")
    .single<UserEntitlementRow>();

  if (insertResult.error) {
    console.error("[DEBUG] insertResult error:", insertResult.error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to initialize user entitlements: ${insertResult.error.message}`,
    });
  }

  console.log("[DEBUG] Successfully created entitlement for user:", userId);
  return insertResult.data;
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);

  if (!isSupabaseServiceEnabled(runtimeConfig)) {
    console.log("[DEBUG] Supabase service not enabled.");
    return createAuthUnavailableQuotaPayload();
  }

  console.log("[DEBUG] Fetching serverSupabaseUser...");
  const user = await serverSupabaseUser(event);

  // LOG FULL USER OBJECT TO SEE WHY id IS MISSING
  if (!user) {
    console.log(
      "[DEBUG] No Server Supabase User found in event (Cookie missing/invalid?).",
    );
  } else {
    console.log("[DEBUG] Server User Extracted ID:", user.id);
  }

  const userId = user?.id || "";

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage:
        "DEBUG: Backend cannot see user ID. Cookies might be blocked!",
    });
  }

  const entitlement = await getOrCreateEntitlement(event, userId);

  return toQuotaPayload(entitlement);
});
