/**
 * POST /api/billing/webhook
 * LemonSqueezy Webhook 接收端点
 * 验证签名后根据事件类型更新 user_entitlements 表
 */
import { serverSupabaseServiceRole } from "#supabase/server";
import { createError, readRawBody, type H3Event } from "h3";

// LemonSqueezy Webhook payload 类型定义
interface LSWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    id: string;
    attributes: {
      customer_id: number;
      status: string;
      renews_at: string | null;
      ends_at: string | null;
    };
  };
}

/**
 * 使用 HMAC-SHA256 验证 LemonSqueezy Webhook 签名
 */
async function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  // 使用 Web Crypto API（Cloudflare Workers 兼容）
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );

  // 转换为 hex 字符串
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === signature;
}

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const webhookSecret = config.lemonSqueezy.webhookSecret;

  if (!webhookSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: "Webhook secret not configured.",
    });
  }

  // 1. 读取原始请求体和签名
  const rawBody = await readRawBody(event);
  const signature = getHeader(event, "x-signature");

  if (!rawBody || !signature) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing body or signature.",
    });
  }

  // 2. 验证签名
  const isValid = await verifySignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    throw createError({
      statusCode: 403,
      statusMessage: "Invalid webhook signature.",
    });
  }

  // 3. 解析 payload
  const payload: LSWebhookPayload = JSON.parse(rawBody);
  const eventName = payload.meta.event_name;
  const userId = payload.meta.custom_data?.user_id;

  // 没有 user_id 无法关联用户，直接返回 200 避免重试
  if (!userId) {
    return { received: true, skipped: "no user_id in custom_data" };
  }

  // 使用 any 类型绕过 Supabase 自动生成的类型限制（新增的 ls_* 字段尚未加入 database.types.ts）
  const supabase: any = serverSupabaseServiceRole(event);
  const subscriptionId = String(payload.data.id);
  const customerId = String(payload.data.attributes.customer_id);
  const renewsAt = payload.data.attributes.renews_at;

  // 4. 根据事件类型更新数据库
  switch (eventName) {
    // ── 订阅创建 / 恢复 ──
    case "subscription_created":
    case "subscription_resumed": {
      await supabase
        .from("user_entitlements")
        .update({
          plan_type: "pro",
          subscription_status: "active",
          ls_customer_id: customerId,
          ls_subscription_id: subscriptionId,
          current_period_end: renewsAt,
          // Pro 用户月度配额，从 0 开始计数
          trial_used: 0,
          trial_total: 100,
        })
        .eq("user_id", userId);
      break;
    }

    // ── 续费成功（每月重置配额） ──
    case "subscription_payment_success": {
      await supabase
        .from("user_entitlements")
        .update({
          subscription_status: "active",
          trial_used: 0, // 重置月度使用计数
          current_period_end: renewsAt,
        })
        .eq("user_id", userId);
      break;
    }

    // ── 取消订阅（期限内仍可使用） ──
    case "subscription_cancelled": {
      // 用户取消但还在付费周期内，保持 active 直到到期
      // LemonSqueezy 会在到期后发送 subscription_expired
      await supabase
        .from("user_entitlements")
        .update({
          subscription_status: "active", // 周期内仍可用
        })
        .eq("user_id", userId);
      break;
    }

    // ── 订阅到期 / 扣费失败 ──
    case "subscription_expired":
    case "subscription_payment_failed": {
      await supabase
        .from("user_entitlements")
        .update({
          plan_type: "free",
          subscription_status: "inactive",
          trial_total: 3, // 回退到免费版配额
          trial_used: 0,
          current_period_end: null,
        })
        .eq("user_id", userId);
      break;
    }

    // ── 订阅更新（状态变更通用处理） ──
    case "subscription_updated": {
      const status = payload.data.attributes.status;
      if (status === "active") {
        await supabase
          .from("user_entitlements")
          .update({
            plan_type: "pro",
            subscription_status: "active",
            current_period_end: renewsAt,
            // 兜底机制：即使 subscription_created 失败/丢失，只要这里是 active，就补齐 Pro 配额
            trial_total: 100,
          })
          .eq("user_id", userId);
      } else if (status === "expired" || status === "cancelled") {
        await supabase
          .from("user_entitlements")
          .update({
            plan_type: "free",
            subscription_status: "inactive",
            current_period_end: null,
          })
          .eq("user_id", userId);
      }
      break;
    }

    default:
      // 未知事件，静默返回 200 避免 LS 重试
      break;
  }

  // 返回 200 告知 LemonSqueezy 收到了
  return { received: true, event: eventName };
});
