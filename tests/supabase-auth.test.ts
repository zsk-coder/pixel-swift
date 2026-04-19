import { describe, expect, it } from "vitest";

import {
  FALLBACK_SUPABASE_KEY,
  FALLBACK_SUPABASE_URL,
  isSupabaseAuthEnabled,
  isSupabaseServiceEnabled,
} from "../shared/utils/supabaseAuth";

describe("supabase auth runtime config", () => {
  it("detects when public auth is configured", () => {
    expect(
      isSupabaseAuthEnabled({
        public: {
          auth: { enabled: true },
          supabase: {
            url: "https://example.supabase.co",
            key: "anon-key",
          },
        },
      }),
    ).toBe(true);
  });

  it("stays disabled when auth is explicitly turned off", () => {
    expect(
      isSupabaseAuthEnabled({
        public: {
          auth: { enabled: false },
          supabase: {
            url: FALLBACK_SUPABASE_URL,
            key: FALLBACK_SUPABASE_KEY,
          },
        },
      }),
    ).toBe(false);
  });

  it("detects when service role access is available", () => {
    expect(
      isSupabaseServiceEnabled({
        supabase: {
          serviceKey: "service-role-key",
        },
        public: {
          auth: { enabled: true },
          supabase: {
            url: "https://example.supabase.co",
            key: "anon-key",
          },
        },
      }),
    ).toBe(true);
  });
});
