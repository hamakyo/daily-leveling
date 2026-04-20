import { describe, expect, it } from "vitest";

const envModulePath = "../scripts/shared/env.mjs";
const { getRuntimeEnvIssues } = await import(envModulePath);

describe("runtime env checks", () => {
  it("passes when required runtime env values are present", () => {
    const issues = getRuntimeEnvIssues({
      DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling",
      APP_BASE_URL: "https://daily-leveling.example.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      SESSION_COOKIE_NAME: "dl_session",
      SESSION_TTL_SECONDS: "1209600",
      DEFAULT_TIMEZONE: "Asia/Tokyo",
    });

    expect(issues).toEqual([]);
  });

  it("reports missing required runtime env values", () => {
    const issues = getRuntimeEnvIssues({});

    expect(issues).toContain("DATABASE_URL が設定されていません。");
    expect(issues).toContain("APP_BASE_URL が設定されていません。");
    expect(issues).toContain("GOOGLE_CLIENT_ID が設定されていません。");
    expect(issues).toContain("GOOGLE_CLIENT_SECRET が設定されていません。");
  });

  it("reports malformed optional values", () => {
    const issues = getRuntimeEnvIssues({
      DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling",
      APP_BASE_URL: "not-a-url",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      SESSION_COOKIE_NAME: "",
      SESSION_TTL_SECONDS: "-1",
      DEFAULT_TIMEZONE: "Mars/Base",
    });

    expect(issues).toContain("APP_BASE_URL は http:// または https:// から始まる有効な URL を指定してください。");
    expect(issues).toContain("DEFAULT_TIMEZONE は有効な IANA timezone を指定してください。");
    expect(issues).toContain("SESSION_COOKIE_NAME を指定する場合は空文字にできません。");
    expect(issues).toContain("SESSION_TTL_SECONDS は 0 より大きい数値を指定してください。");
  });
});
