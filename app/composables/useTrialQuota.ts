import { useAuthConfig } from "./useAuthConfig";

interface TrialQuota {
  authAvailable: boolean;
  authenticated: boolean;
  canGenerate: boolean;
  isLocked: boolean;
  planType: "free" | "pro";
  subscriptionStatus: "inactive" | "active";
  trialRemaining: number;
  trialTotal: number;
  trialUsed: number;
}

const DEFAULT_TRIAL_QUOTA: TrialQuota = {
  authAvailable: false,
  authenticated: false,
  canGenerate: false,
  isLocked: true,
  planType: "free",
  subscriptionStatus: "inactive",
  trialRemaining: 0,
  trialTotal: 0,
  trialUsed: 0,
};

let refreshPromise: Promise<TrialQuota> | null = null;
let refreshNonce = 0;

/**
 * 用户试用配额与权限管理组合式函数
 * 提供全局共享的配额状态，并处理 SSR 与客户端的自动同步、并发请求去重等复杂逻辑。
 */
export function useTrialQuota() {
  const { isConfigured } = useAuthConfig();
  const user = useSupabaseUser();
  // Capture cookies during SSR setup so they can be forwarded to internal $fetch calls
  const ssrHeaders = useRequestHeaders(["cookie"]);
  const quota = useState<TrialQuota>("trial-quota", () => ({
    ...DEFAULT_TRIAL_QUOTA,
  }));
  const pending = useState<boolean>("trial-quota-pending", () => false);
  const errorMessage = useState<string | null>("trial-quota-error", () => null);
  const lastFetchedAt = useState<number | null>(
    "trial-quota-last-fetched-at",
    () => null,
  );

  /**
   * 强制向服务端发起请求并刷新最新的配额数据
   * 利用单例 Promise 避免组件重复调用造成的并发请求问题
   *
   * @returns 返回最新的配额数据或默认状态
   */
  async function refreshQuota() {
    if (!isConfigured.value) {
      resetQuota();
      return quota.value;
    }

    // 防止未登录时发出多余请求（虽然服务端 fail-safe 会处理，但可避免网络消耗）
    if (!user.value) {
      return quota.value;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    pending.value = true;
    const currentNonce = refreshNonce;

    // 复用进行中的请求，避免多个组件同时读取账号状态时重复打接口
    let request!: Promise<TrialQuota>;
    request = (async () => {
      try {
        // SSR 阶段无法使用插件提供的 $api，改用原生 $fetch 并手动转发 Cookie
        // 客户端阶段通过 $api 插件，获得统一的 401 跳转和 5xx 提示
        let nextQuota: TrialQuota;

        if (import.meta.server) {
          // SSR：直接 $fetch，转发 Cookie，手动解包 ApiResponse
          const res = await $fetch<{ code: number; data?: TrialQuota }>(
            "/api/workflow-copilot/quota",
            {
              headers: ssrHeaders as Record<string, string>,
              credentials: "include",
            },
          );
          nextQuota = res.data ?? { ...DEFAULT_TRIAL_QUOTA };
        } else {
          // 客户端：使用 $api 插件（自动处理 401 跳转 / 5xx 提示）
          const { $api } = useNuxtApp();
          const res = await $api<TrialQuota>("/api/workflow-copilot/quota");
          nextQuota = res.data ?? { ...DEFAULT_TRIAL_QUOTA };
        }

        if (currentNonce === refreshNonce) {
          quota.value = nextQuota;
          errorMessage.value = null;
          lastFetchedAt.value = Date.now();
        }

        return quota.value;
      } finally {
        if (refreshPromise === request) {
          refreshPromise = null;
        }

        if (currentNonce === refreshNonce) {
          pending.value = false;
        }
      }
    })();

    refreshPromise = request;
    return request;
  }

  /**
   * 确保本地状态是新鲜的，如果没过期则直接使用缓存，否则触发刷新
   * 通常在组件挂载 (onMounted) 时静默调用，防止每次切换页面都打接口
   *
   * @param maxAgeMs 允许的缓存有效期（毫秒），默认 60 秒
   */
  async function ensureQuotaFresh(maxAgeMs = 60000) {
    if (!isConfigured.value) {
      resetQuota();
      return quota.value;
    }

    if (!user.value) {
      return quota.value;
    }

    if (lastFetchedAt.value && Date.now() - lastFetchedAt.value <= maxAgeMs) {
      return quota.value;
    }

    return refreshQuota();
  }

  /**
   * 清空本地配额状态并废弃掉正在路上的旧请求响应 (通过提升 Nonce)
   * 用于用户退出登录或鉴权服务失效时的状态清理
   */
  function resetQuota() {
    refreshNonce += 1;
    refreshPromise = null;
    quota.value = { ...DEFAULT_TRIAL_QUOTA };
    pending.value = false;
    errorMessage.value = null;
    lastFetchedAt.value = null;
  }

  return {
    quota,
    pending,
    errorMessage,
    lastFetchedAt,
    refreshQuota,
    ensureQuotaFresh,
    resetQuota,
    remainingTrialCount: computed(() => quota.value.trialRemaining),
    planType: computed(() => quota.value.planType),
    hasTrialRemaining: computed(() => quota.value.trialRemaining > 0),
    isLocked: computed(() => quota.value.isLocked),
    authAvailable: computed(() => quota.value.authAvailable),
  };
}
