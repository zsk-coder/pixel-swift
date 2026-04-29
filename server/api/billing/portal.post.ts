/**
 * POST /api/billing/portal
 * 为已登录 Pro 用户生成 LemonSqueezy Customer Portal URL
 * 用户可在 Portal 中自助管理订阅（取消、恢复、更换支付方式、查看账单）
 */
import {
  serverSupabaseUser,
  serverSupabaseServiceRole,
} from "#supabase/server";
import { createError, type H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const { apiKey } = config.lemonSqueezy;

  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: "Payment service is not configured.",
    });
  }

  // 验证用户已登录
  let user;
  try {
    user = await serverSupabaseUser(event);
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userId = user?.sub || user?.id;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // 从 user_entitlements 查询 ls_customer_id
  const supabase: any = serverSupabaseServiceRole(event);
  const { data: entitlement, error: dbError } = await supabase
    .from("user_entitlements")
    .select("ls_customer_id")
    .eq("user_id", userId)
    .single();

  if (dbError || !entitlement?.ls_customer_id) {
    throw createError({
      statusCode: 404,
      statusMessage: "No subscription found. Please subscribe first.",
    });
  }

  // 调用 LemonSqueezy API 获取 Customer Portal URL（预签名，24 小时有效）
  const response = await $fetch<{
    data: { attributes: { urls: { customer_portal: string | null } } };
  }>(
    `https://api.lemonsqueezy.com/v1/customers/${entitlement.ls_customer_id}`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const portalUrl = response.data.attributes.urls.customer_portal;

  if (!portalUrl) {
    throw createError({
      statusCode: 404,
      statusMessage: "Customer portal is not available.",
    });
  }

  return { url: portalUrl };
});
