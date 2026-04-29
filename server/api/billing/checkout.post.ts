/**
 * POST /api/billing/checkout
 * 为已登录用户创建 LemonSqueezy Checkout Session
 * 返回 checkout URL，前端跳转过去完成支付
 */
import { serverSupabaseUser } from "#supabase/server";
import { createError, readBody, type H3Event } from "h3";

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

  // 动态获取当前请求的来源主机，实现自适应跳回（本地 localhost、CF Pages 预览分支、生产正式域名）
  const requestUrlHeader =
    getHeader(event, "referer") || getHeader(event, "origin");
  const hostHeader = getHeader(event, "host");
  const protocol = getHeader(event, "x-forwarded-proto") || "https";

  let redirectBase = config.public.siteUrl;
  if (requestUrlHeader) {
    try {
      const urlObj = new URL(requestUrlHeader);
      redirectBase = `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      // 解析失败则静默回退
    }
  } else if (hostHeader) {
    const isLocalhost =
      hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
    const scheme = isLocalhost ? "http" : protocol;
    redirectBase = `${scheme}://${hostHeader}`;
  }

  // 读取前端传来的 locale，拼接语言前缀（默认 en 不加前缀）
  const body = await readBody(event).catch(() => ({}));
  const locale = body?.locale || "en";
  const localePrefix = locale === "en" ? "" : `/${locale}`;

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
            // 支付完成后重定向回 pricing 页面（带语言前缀）
            product_options: {
              redirect_url: `${redirectBase}${localePrefix}/pricing?success=true`,
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
