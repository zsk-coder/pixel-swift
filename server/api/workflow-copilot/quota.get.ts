import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server";
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
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read user entitlements: ${existingResult.error.message}`,
    });
  }

  if (existingResult.data) {
    return existingResult.data;
  }

  const defaultEntitlement = createDefaultEntitlement(userId);
  const insertResult = await supabase
    .from("user_entitlements")
    .insert(defaultEntitlement)
    .select("user_id, plan_type, trial_total, trial_used, subscription_status")
    .single<UserEntitlementRow>();

  if (insertResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to initialize user entitlements: ${insertResult.error.message}`,
    });
  }

  return insertResult.data;
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);

  if (!isSupabaseServiceEnabled(runtimeConfig)) {
    return createAuthUnavailableQuotaPayload();
  }

  const user = await serverSupabaseUser(event);
  const userId = typeof user?.sub === "string" ? user.sub : "";

  if (!userId) {
    return createUnauthenticatedQuotaPayload();
  }

  const entitlement = await getOrCreateEntitlement(event, userId);

  return toQuotaPayload(entitlement);
});
