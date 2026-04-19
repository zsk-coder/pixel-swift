import { buildAuthCallbackUrl, normalizeReturnTo } from "~/utils/authRedirect";
import { useAuthConfig } from "./useAuthConfig";

const AUTH_RETURN_TO_STORAGE_KEY = "pixelswift:return-to";

export function useAuthFlow() {
  const route = useRoute();
  const { isConfigured } = useAuthConfig();

  function getCurrentReturnTo() {
    return normalizeReturnTo(route.fullPath);
  }

  function storeReturnTo(returnTo?: string | null) {
    if (!import.meta.client) {
      return normalizeReturnTo(returnTo);
    }

    const normalizedReturnTo = normalizeReturnTo(returnTo);
    window.sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, normalizedReturnTo);

    return normalizedReturnTo;
  }

  function consumeReturnTo(returnTo?: string | null) {
    const queryReturnTo = normalizeReturnTo(returnTo);

    if (!import.meta.client) {
      return queryReturnTo;
    }

    const storedReturnTo = window.sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);

    if (queryReturnTo !== "/") {
      return queryReturnTo;
    }

    return normalizeReturnTo(storedReturnTo);
  }

  async function signInWithGoogle(returnTo?: string | null) {
    if (!import.meta.client) {
      return;
    }

    if (!isConfigured.value) {
      throw new Error("Supabase is not configured.");
    }

    const client = useSupabaseClient();
    const normalizedReturnTo = storeReturnTo(returnTo ?? getCurrentReturnTo());
    const redirectTo = buildAuthCallbackUrl(window.location.origin, normalizedReturnTo);
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
