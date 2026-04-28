import { describe, expect, it } from "vitest";

const envModulePath = "../scripts/shared/env.mjs";
const {
  getEnvFilesForTarget,
  getMigrationEnvIssues,
  getMigrationSafetyIssues,
  getRuntimeEnvIssues,
  isLocalDatabaseUrl,
  resolveTargetEnvironment,
} = await import(envModulePath);

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

  it("checks migration env with DATABASE_URL only", () => {
    expect(
      getMigrationEnvIssues({
        DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling_staging",
      }),
    ).toEqual([]);
  });

  it("rejects invalid migration database urls", () => {
    expect(
      getMigrationEnvIssues({
        DATABASE_URL: "https://example.com/db",
      }),
    ).toContain("DATABASE_URL は postgres:// または postgresql:// 形式で指定してください。");
  });

  it("detects localhost database urls", () => {
    expect(isLocalDatabaseUrl("postgres://user:pass@localhost:5432/daily_leveling")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://user:pass@127.0.0.1:5432/daily_leveling")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://user:pass@db.example.com:5432/daily_leveling")).toBe(false);
  });

  it("rejects localhost migration urls outside local environment", () => {
    expect(
      getMigrationSafetyIssues("production", {
        DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling",
      }),
    ).toContain(
      "production 環境の DATABASE_URL が localhost/127.0.0.1 を指しています。誤った migration を防ぐため実行を中止しました。",
    );
    expect(
      getMigrationSafetyIssues("local", {
        DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling",
      }),
    ).toEqual([]);
  });

  it("returns environment-specific files before common files", () => {
    expect(getEnvFilesForTarget("staging")).toEqual([
      ".dev.vars.staging",
      ".env.staging",
      ".dev.vars",
      ".env",
      ".env.local",
    ]);
  });

  it("resolves the target environment from cli args", () => {
    expect(resolveTargetEnvironment(["--env", "production"])).toBe("production");
    expect(resolveTargetEnvironment(["--env=test"])).toBe("test");
    expect(resolveTargetEnvironment([])).toBe("local");
  });
});
