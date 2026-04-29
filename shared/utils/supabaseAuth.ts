/**
 * 默认的 Supabase URL 和 Key，当未配置时作为回退占位符使用，避免因缺少环境变量而直接报错崩溃
 */
export const FALLBACK_SUPABASE_URL = "https://not-configured.supabase.co";
export const FALLBACK_SUPABASE_KEY = "not-configured";

/**
 * Supabase 运行时配置的类型定义，包含服务端及客户端所需的连接参数
 */
export interface SupabaseRuntimeShape {
  // 用于服务端（特权）操作的设置，包含 serviceKey
  supabase?: {
    serviceKey?: string;
  };
  // 用于前端公开使用的配置，包含客户端所需的 url 与 key，以及认证开启状态
  public?: {
    auth?: {
      enabled?: boolean;
    };
    supabase?: {
      url?: string;
      key?: string;
    };
  };
}

/**
 * 检查 Supabase 的客户端认证功能是否已启用
 * 判断条件：公开配置中的 auth.enabled 为 true，且同时配置了 supabase.url 和 supabase.key
 *
 * @param config 运行时的全局配置对象
 * @returns {boolean} 是否有效启用了客户端 Auth
 */
export function isSupabaseAuthEnabled(config?: SupabaseRuntimeShape | null) {
  return Boolean(
    config?.public?.auth?.enabled &&
    config?.public?.supabase?.url &&
    config?.public?.supabase?.key,
  );
}

/**
 * 检查 Supabase 的服务端（Service）功能是否已完全启用
 * 判断条件：在客户端认证配置通过校验的基础上，必须额外配置供服务端使用的 serviceKey
 *
 * @param config 运行时的全局配置对象
 * @returns {boolean} 是否包含完整的服务端级别支持
 */
export function isSupabaseServiceEnabled(config?: SupabaseRuntimeShape | null) {
  return Boolean(isSupabaseAuthEnabled(config) && config?.supabase?.serviceKey);
}
