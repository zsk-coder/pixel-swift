import { describe, expect, it } from "vitest";

import { buildAuthCallbackUrl, normalizeReturnTo } from "../app/utils/authRedirect";

describe("normalizeReturnTo", () => {
  it("returns a safe in-app path", () => {
    expect(normalizeReturnTo("/compress-image")).toBe("/compress-image");
  });

  it("falls back for empty or invalid values", () => {
    expect(normalizeReturnTo("")).toBe("/");
    expect(normalizeReturnTo("//evil.example")).toBe("/");
    expect(normalizeReturnTo("https://evil.example")).toBe("/");
    expect(normalizeReturnTo("compress-image")).toBe("/");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds callback url with encoded returnTo", () => {
    expect(
      buildAuthCallbackUrl("https://pixelswift.site", "/converter?from=hero"),
    ).toBe(
      "https://pixelswift.site/auth/callback?returnTo=%2Fconverter%3Ffrom%3Dhero",
    );
  });
});
