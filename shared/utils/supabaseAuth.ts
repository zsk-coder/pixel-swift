export const FALLBACK_SUPABASE_URL = "https://not-configured.supabase.co";
export const FALLBACK_SUPABASE_KEY = "not-configured";

export interface SupabaseRuntimeShape {
  supabase?: {
    serviceKey?: string;
  };
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

export function isSupabaseAuthEnabled(config?: SupabaseRuntimeShape | null) {
  return Boolean(
    config?.public?.auth?.enabled &&
      config?.public?.supabase?.url &&
      config?.public?.supabase?.key,
  );
}

export function isSupabaseServiceEnabled(config?: SupabaseRuntimeShape | null) {
  return Boolean(isSupabaseAuthEnabled(config) && config?.supabase?.serviceKey);
}
