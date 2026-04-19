import { isSupabaseAuthEnabled } from "~~/shared/utils/supabaseAuth";

export function useAuthConfig() {
  const runtimeConfig = useRuntimeConfig();
  const isConfigured = computed(() => isSupabaseAuthEnabled(runtimeConfig));

  return {
    isConfigured,
  };
}
