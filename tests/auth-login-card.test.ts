import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("login layout", () => {
  it("centers the login area in the middle of the page", () => {
    const source = readFileSync(resolve("app/layouts/login.vue"), "utf8");

    expect(source).toContain("items-center justify-center");
    expect(source).toContain("<slot />");
    expect(source).toContain("flex w-full justify-center");
    expect(source).toContain("-translate-y-[8vh]");
    expect(source).toContain("sm:-translate-y-[9vh]");
    expect(source).toContain("lg:-translate-y-[10vh]");
  });

  it("keeps a visible logo in the top-left corner", () => {
    const source = readFileSync(resolve("app/layouts/login.vue"), "utf8");

    expect(source).toContain("absolute left-6 top-6");
    expect(source).not.toContain("lg:hidden");
  });

  it("uses a pure white background without the split brand panel", () => {
    const source = readFileSync(resolve("app/layouts/login.vue"), "utf8");

    expect(source).toContain("bg-white text-slate-900");
    expect(source).not.toContain("<aside");
    expect(source).not.toContain("LoginBrandPanel");
  });
});

describe("login page", () => {
  it("keeps the auth card in a centered narrow rail", () => {
    const source = readFileSync(resolve("app/pages/login.vue"), "utf8");

    expect(source).toContain("w-full max-w-sm");
  });

  it("passes the free-trial benefit through a lightweight badge prop", () => {
    const source = readFileSync(resolve("app/pages/login.vue"), "utf8");

    expect(source).toContain(":badge-label=\"t('auth.login.badge')\"");
  });

  it("keeps the error message attached below the login card", () => {
    const source = readFileSync(resolve("app/pages/login.vue"), "utf8");

    expect(source).not.toContain("absolute top-full");
    expect(source).toContain("mt-4 text-center");
  });
});

describe("AuthLoginCard", () => {
  it("renders a lightweight badge above the title when a benefit label is provided", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("badgeLabel?: string");
    expect(source).toContain("v-if=\"badgeLabel\"");
    expect(source).toContain("inline-flex items-center rounded-full");
    expect(source).toContain("bg-primary/8");
  });

  it("gives the title, badge, and subtitle a bit more breathing room", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("mb-4 text-[2.25rem] font-bold");
    expect(source).toContain("mb-5 inline-flex items-center rounded-full");
    expect(source).toContain("mb-8 max-w-sm text-[15px] leading-7");
  });

  it("still renders the Google action with the native button implementation", () => {
    const source = readFileSync(
      resolve("app/components/auth/AuthLoginCard.vue"),
      "utf8",
    );

    expect(source).toContain("<button");
    expect(source).toContain('type="button"');
    expect(source).not.toContain("<ElButton");
  });
});

describe("login locale copy", () => {
  it("splits the free-trial offer into a badge and simpler English description", () => {
    const locale = JSON.parse(readFileSync(resolve("locales/en.json"), "utf8"));

    expect(locale.auth.login.badge).toBe("3 free AI planning experiences");
    expect(locale.auth.login.description).toBe(
      "Sign in to continue with Workflow Copilot.",
    );
  });
});

describe("auth callback page", () => {
  it("uses a dedicated callback layout instead of the default site chrome", () => {
    const source = readFileSync(resolve("app/pages/auth/callback.vue"), "utf8");

    expect(source).toContain('layout: "auth-callback"');
  });

  it("keeps the callback card explicitly centered within the page rail", () => {
    const source = readFileSync(resolve("app/pages/auth/callback.vue"), "utf8");

    expect(source).toContain("flex w-full justify-center");
    expect(source).toContain("w-full max-w-lg");
  });

  it("renders the callback layout without header or footer chrome", () => {
    const source = readFileSync(
      resolve("app/layouts/auth-callback.vue"),
      "utf8",
    );

    expect(source).toContain("min-h-screen");
    expect(source).toContain("w-full");
    expect(source).toContain("bg-white");
    expect(source).toContain("text-slate-900");
    expect(source).toContain("items-center justify-center");
    expect(source).toContain("<slot />");
    expect(source).not.toContain("AppHeader");
    expect(source).not.toContain("AppFooter");
  });

  it("uses more natural callback copy in English and Chinese", () => {
    const en = JSON.parse(readFileSync(resolve("locales/en.json"), "utf8"));
    const zh = JSON.parse(readFileSync(resolve("locales/zh.json"), "utf8"));
    const source = readFileSync(resolve("app/pages/auth/callback.vue"), "utf8");

    expect(en.auth.callback.title).toBe("Signing you in");
    expect(en.auth.callback.description).toBe(
      "We're signing you in and getting your workspace ready.",
    );
    expect(zh.auth.callback.title).toBe("正在为你登录");
    expect(zh.auth.callback.description).toBe("正在为你登录并准备工作台。");
    expect(source).toContain('tt("auth.callback.title", "Signing you in")');
    expect(source).toContain(
      '"We\'re signing you in and getting your workspace ready."',
    );
  });
});
