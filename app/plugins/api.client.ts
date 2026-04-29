import type { ApiResponse } from "~~/shared/types/api";

/**
 * Nuxt 客户端 API 插件
 *
 * 提供 $api，在 $fetch 基础上统一处理：
 *   - 401 → 自动跳转登录页（携带 returnTo，保留当前路径）
 *   - 5xx → 弹出用户友好的错误提示（Element Plus ElMessage）
 *
 * 注意：本插件仅在客户端运行（.client.ts），SSR 阶段仍使用原生 $fetch
 */
export default defineNuxtPlugin(() => {
  const localePath = useLocalePath();

  const apiFetch = $fetch.create({
    // 确保跨域时携带认证 Cookie
    credentials: "include",

    onResponseError({ response }) {
      // 401：身份过期或未登录，统一跳转登录页并记录当前路径
      if (response.status === 401) {
        const returnTo = encodeURIComponent(window.location.pathname);
        navigateTo(localePath(`/login?returnTo=${returnTo}`));
        return;
      }

      // 5xx：服务端异常，弹出全局提示（不暴露底层错误细节给用户）
      if (response.status >= 500) {
        ElMessage.error("服务器开小差了，请稍后重试");
      }
    },
  });

  /**
   * 带 ApiResponse<T> 解包的封装
   * 自动取 .data 字段；若 code !== 0，在控制台警告（便于开发调试）
   */
  async function api<T>(
    url: string,
    opts?: Parameters<typeof apiFetch>[1],
  ): Promise<ApiResponse<T>> {
    return apiFetch<ApiResponse<T>>(url, opts);
  }

  return { provide: { api } };
});
