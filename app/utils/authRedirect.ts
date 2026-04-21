// 默认安全回退的页面：首页
const FALLBACK_RETURN_TO = "/";

/**
 * 安全地清理并反序列化一个传入的重定向路径。
 * 用来防止被外部利用构造出一个有毒的 URL (例如：重定向到了钓鱼站点) 或者带有 XSS 向量的路径。
 */
export function normalizeReturnTo(
  value?: string | null,
  fallback = FALLBACK_RETURN_TO,
) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  // 不是以 / 开头，或者写了双杠 //（可能是试图注入跨域的绝对域名 //evil.com/）
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    // 强制利用我们自己站点的 origin 作为基准去解析传入路径，确保最后拿到的确实只是一个 pathname + search
    // 只要它无法被解析为合法 URI 或者强行脱离 origin，我们就拦截。
    const parsed = new URL(value, "https://pixelswift.local");
    if (parsed.origin !== "https://pixelswift.local") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}

/**
 * 为 OAuth 会话构建跳转的回调地址网关。
 * 回调地址统一走 /auth/callback，在这里由我们的 vue 应用程序完全接管，然后再读取参数去最终的返回点。
 */
export function buildAuthCallbackUrl(origin: string, returnTo?: string | null) {
  const callbackUrl = new URL("/auth/callback", origin);
  const normalizedReturnTo = normalizeReturnTo(returnTo);

  callbackUrl.searchParams.set("returnTo", normalizedReturnTo);

  return callbackUrl.toString();
}

/**
 * 构建系统使用的“去往登录页面”的路径
 * 总是返回未做本地化的绝对路径基准（如 /login?returnTo=xxx），
 * 我们稍后在 Vue 组件侧可以使用 useLocalePath('/login') 去获取它的国际化映射
 */
export function buildLoginUrl(returnTo?: string | null) {
  const loginUrl = new URL("/login", "https://pixelswift.local");
  const normalizedReturnTo = normalizeReturnTo(returnTo);

  if (normalizedReturnTo !== FALLBACK_RETURN_TO) {
    loginUrl.searchParams.set("returnTo", normalizedReturnTo);
  }

  // 我们只返回相对路径及其 Query 部分，丢弃用来安全校验解析的虚假 host
  return `${loginUrl.pathname}${loginUrl.search}`;
}
