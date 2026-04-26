/**
 * POST /api/billing/checkout
 * 为已登录用户创建 LemonSqueezy Checkout Session
 * 返回 checkout URL，前端跳转过去完成支付
 */
import { serverSupabaseUser } from "#supabase/server";
import { createError, type H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const { apiKey, storeId, variantId } = config.lemonSqueezy;

  // 检查 LemonSqueezy 是否已配置
  if (!apiKey || !storeId || !variantId) {
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
  const userEmail = user?.email;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // 根据环境决定回跳地址：开发环境用请求来源，生产环境用 siteUrl
  const origin = getHeader(event, "origin") || getHeader(event, "referer");
  const redirectBase =
    process.dev && origin
      ? origin.replace(/\/$/, "")
      : config.public.siteUrl;

  // 调用 LemonSqueezy API 创建 Checkout
  const response = await $fetch<{ data: { attributes: { url: string } } }>(
    "https://api.lemonsqueezy.com/v1/checkouts",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        data: {
          type: "checkouts",
          attributes: {
            // 通过 custom_data 传递 user_id，Webhook 回调时用来关联用户
            checkout_data: {
              email: userEmail || undefined,
              custom: {
                user_id: userId,
              },
            },
            // 支付完成后重定向回 pricing 页面
            product_options: {
              redirect_url: `${redirectBase}/pricing?success=true`,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: storeId,
              },
            },
            variant: {
              data: {
                type: "variants",
                id: variantId,
              },
            },
          },
        },
      },
    },
  );

  // 返回 checkout URL
  return {
    url: response.data.attributes.url,
  };
});
