import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from "#supabase/server";
import { createError, type H3Event } from "h3";
import type { JwtPayload } from "@supabase/supabase-js";

import {
  createAuthUnavailableQuotaPayload,
  createMissingEntitlementQuotaPayload,
  createUnauthenticatedQuotaPayload,
  toQuotaPayload,
  type UserEntitlementRow,
} from "../../lib/billing/trial";
import { isSupabaseServiceEnabled } from "~~/shared/utils/supabaseAuth";
import { ok } from "../../utils/response";

/**
 * 从数据库 user_entitlements 表中获取用户的套餐和配额数据
 * @param event H3Event 原生请求事件
 * @param userId 用户的在 Supabase 中的唯一 ID
 * @returns 返回用户的配额数据记录，若不存在则返回 null
 */
async function getEntitlement(event: H3Event, userId: string) {
  // 使用 service role (高权限后台客户端) 绕过 RLS 策略读取指定用户的配额
  const supabase = serverSupabaseServiceRole(event);
  const existingResult = await supabase
    .from("user_entitlements")
    .select("user_id, plan_type, trial_total, trial_used, subscription_status")
    .eq("user_id", userId)
    .maybeSingle<UserEntitlementRow>();

  // 捕获具体的数据库查询错误并抛出 500
  if (existingResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read user entitlements: ${existingResult.error.message}`,
    });
  }

  if (existingResult.data) {
    return existingResult.data;
  }

  return null;
}

/**
 * API 路由处理器: 获取当前鉴权用户的配额信息
 * 无论是否登录，都会返回一个统一标准的业务 Payload 对象，而不是抛出 HTTP 错误，
 * 这样可以显著简化前端的异常处理逻辑 (fail-safe 容错机制)。
 */
export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);

  // 1. 检查环境变量中是否配置了 Supabase (未配置时认为 Auth 服务不可用)
  if (!isSupabaseServiceEnabled(runtimeConfig)) {
    return ok(createAuthUnavailableQuotaPayload());
  }

  let user: JwtPayload | null = null;
  try {
    // 2. 从请求头/Cookie 中解析并验证 Supabase JWT 令牌
    // 如果 token 无效或已过期，底层库会抛异常
    user = await serverSupabaseUser(event);
  } catch {
    // Auth cookie 无效或已过期，在这里被静默捕获，后续判定为未登录
  }

  // 获取解析后的 JWT payload 中的用户 ID
  const userId: string = user?.sub || user?.id || "";

  // 3. 用户未登录：返回带标识的“未鉴权”空配额对象
  if (!userId) {
    return ok(createUnauthenticatedQuotaPayload());
  }

  // 4. 用户已登录：在数据库中查寻其详细的会员权益记录
  const entitlement = await getEntitlement(event, userId);

  // 5. 如果用户存在但关联的 rights 行未生成（例如初次注册时触发器延迟或者其他异常情况）
  if (!entitlement) {
    return ok(createMissingEntitlementQuotaPayload());
  }

  // 6. 返回正常转换的前端可用对象
  return ok(toQuotaPayload(entitlement));
});
