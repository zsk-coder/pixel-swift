const FALLBACK_RETURN_TO = "/";

export function normalizeReturnTo(
  value?: string | null,
  fallback = FALLBACK_RETURN_TO,
) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://pixelswift.local");
    if (parsed.origin !== "https://pixelswift.local") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function buildAuthCallbackUrl(origin: string, returnTo?: string | null) {
  const callbackUrl = new URL("/auth/callback", origin);
  const normalizedReturnTo = normalizeReturnTo(returnTo);

  callbackUrl.searchParams.set("returnTo", normalizedReturnTo);

  return callbackUrl.toString();
}

export function buildLoginUrl(returnTo?: string | null) {
  const loginUrl = new URL("/login", "https://pixelswift.local");
  const normalizedReturnTo = normalizeReturnTo(returnTo);

  if (normalizedReturnTo !== FALLBACK_RETURN_TO) {
    loginUrl.searchParams.set("returnTo", normalizedReturnTo);
  }

  return `${loginUrl.pathname}${loginUrl.search}`;
}
