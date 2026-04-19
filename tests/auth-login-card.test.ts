import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("AuthLoginCard", () => {
  it("uses roomier vertical padding for the login card container", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("w-full max-w-[29rem]");
    expect(source).toContain("px-7 py-10");
    expect(source).toContain("sm:px-9 sm:py-16");
  });

  it("balances the badge spacing between the description and the action area", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("class=\"max-w-sm space-y-5\"");
    expect(source).toContain("class=\"mt-6 mb-6 inline-flex");
    expect(source).toContain(":class=\"badgeLabel ? 'mt-2' : 'mt-10'\"");
    expect(source).toContain("class=\"mt-8 space-y-3 text-center\"");
  });

  it("keeps the card corners tighter and makes the Google button much less rounded", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("rounded-[13px]");
    expect(source).toContain("rounded-lg");
    expect(source).not.toContain("rounded-2xl");
    expect(source).not.toContain("hover:-translate-y-0.5");
    expect(source).toContain("hover:border-slate-300");
  });

  it("renders the Google action with the native button implementation", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("<button");
    expect(source).toContain("type=\"button\"");
    expect(source).not.toContain("<ElButton");
  });

  it("uses the narrower login page wrapper", () => {
    const source = readFileSync(resolve("app/pages/login.vue"), "utf8");

    expect(source).toContain("max-w-lg");
  });

  it("uses a top-biased login layout instead of strict vertical centering", () => {
    const source = readFileSync(resolve("app/layouts/login.vue"), "utf8");

    expect(source).toContain("items-start justify-center");
    expect(source).toContain("pt-28");
    expect(source).toContain("sm:pt-32");
    expect(source).toContain("lg:pt-44");
    expect(source).not.toContain("items-center justify-center");
  });
});

describe("login locale copy", () => {
  it("keeps the badge benefit while simplifying the English description", () => {
    const locale = JSON.parse(readFileSync(resolve("locales/en.json"), "utf8"));

    expect(locale.auth.login.description).toBe(
      "Sign in with Google to continue using Workflow Copilot.",
    );
  });

  it("keeps the badge benefit while simplifying the Chinese description", () => {
    const locale = JSON.parse(readFileSync(resolve("locales/zh.json"), "utf8"));

    expect(locale.auth.login.description).toBe(
      "使用 Google 登录后继续使用 Workflow Copilot。",
    );
  });
});
