import { buildAuthCallbackUrl, normalizeReturnTo } from "~/utils/authRedirect";
import { useAuthConfig } from "./useAuthConfig";

// 在本地会话缓存中存储 `returnTo` 重定向信息的 Key
const AUTH_RETURN_TO_STORAGE_KEY = "pixelswift:return-to";

/**
 * 认证流程控制器
 * 管理登录会话重定向与第三方 OAuth 服务调用（主要针对 Google 鉴权链路）
 */
export function useAuthFlow() {
  const route = useRoute();
  const { isConfigured } = useAuthConfig();

  /**
   * 推断在用户没有提供明确重定向位置时，当前该去哪里
   * 例如：如果是 `/login` 登录页，认证完毕后显然不要跳回 `/login`，我们要让他去 `/` 主页。
   */
  function getCurrentReturnTo() {
    const rawPath = route.fullPath;
    // endsWith 用于兼容 i18n URL 如 `/zh/login` 或 `/fr/login`
    if (rawPath === "/login" || rawPath.endsWith("/login")) {
      return "/";
    }
    return normalizeReturnTo(rawPath);
  }

  /**
   * 将期望的“登录后重定向路径”先存进 SessionStorage 保留
   * 防御浏览器重定向时内存丢失
   * @param returnTo 尝试存储的路径
   * @returns 净化的合法路径
   */
  function storeReturnTo(returnTo?: string | null) {
    if (!import.meta.client) {
      return normalizeReturnTo(returnTo);
    }

    const normalizedReturnTo = normalizeReturnTo(returnTo);
    window.sessionStorage.setItem(
      AUTH_RETURN_TO_STORAGE_KEY,
      normalizedReturnTo,
    );

    return normalizedReturnTo;
  }

  /**
   * 获取然后用完即毁：吃掉刚才存储的重定向路径，并与 URL 中可能传递的值比对
   * @param returnTo URL 中带进来的附带路径
   */
  function consumeReturnTo(returnTo?: string | null) {
    const queryReturnTo = normalizeReturnTo(returnTo);

    if (!import.meta.client) {
      return queryReturnTo;
    }

    // 读取后立马删除，防止污染下次登录
    const storedReturnTo = window.sessionStorage.getItem(
      AUTH_RETURN_TO_STORAGE_KEY,
    );
    window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);

    // 优先使用 URL Query 中的指引（如果非首页）
    if (queryReturnTo !== "/") {
      return queryReturnTo;
    }

    return normalizeReturnTo(storedReturnTo);
  }

  /**
   * 点击发行的核心方法：与 Supabase Client 配合调用 Google OAuth UI
   * 自动拼接包含我们回调（callback.vue）所需的认证返回重定向信息
   */
  async function signInWithGoogle(returnTo?: string | null) {
    if (!import.meta.client) {
      return;
    }

    if (!isConfigured.value) {
      throw new Error("Supabase is not configured.");
    }

    const client = useSupabaseClient();
    // 提前计算好用户完成登录想要回到的最终目标位置，并落库缓存
    const normalizedReturnTo = storeReturnTo(returnTo ?? getCurrentReturnTo());

    // 生成 Google 认证成功后回调的统一网关
    // 这里一定会跳到我们在 Google Console 中注册的 `https://[域名]/auth/callback`，同时附加最终跳转参数
    const redirectTo = buildAuthCallbackUrl(
      window.location.origin,
      normalizedReturnTo,
    );

    // 执行鉴权发起，如果成功游览器就会被硬重定向到 accounts.google.com
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }
  }

  return {
    isConfigured,
    getCurrentReturnTo,
    storeReturnTo,
    consumeReturnTo,
    signInWithGoogle,
  };
}
