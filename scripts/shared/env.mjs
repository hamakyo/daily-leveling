import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const TARGET_ENVIRONMENTS = ["local", "test", "staging", "production"];

const DEFAULT_ENV_FILES = [".dev.vars", ".env", ".env.local"];
const ENVIRONMENT_FILES = {
  local: DEFAULT_ENV_FILES,
  test: [".dev.vars.test", ".env.test", ".dev.vars", ".env", ".env.local"],
  staging: [".dev.vars.staging", ".env.staging", ".dev.vars", ".env", ".env.local"],
  production: [".dev.vars.production", ".env.production", ".dev.vars", ".env", ".env.local"],
};

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(contents) {
  const entries = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    entries[key] = stripWrappingQuotes(value);
  }

  return entries;
}

export function loadEnvFiles(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = options.files || getEnvFilesForTarget(options.targetEnvironment);
  const loadedFiles = [];

  for (const filename of files) {
    const fullPath = path.resolve(cwd, filename);
    if (!existsSync(fullPath)) {
      continue;
    }

    const contents = readFileSync(fullPath, "utf8");
    const entries = parseEnvFile(contents);

    for (const [key, value] of Object.entries(entries)) {
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }

    loadedFiles.push(fullPath);
  }

  return loadedFiles;
}

export function getEnvFilesForTarget(targetEnvironment = "local") {
  return ENVIRONMENT_FILES[targetEnvironment] || DEFAULT_ENV_FILES;
}

export function resolveTargetEnvironment(argv = process.argv.slice(2)) {
  const envArgument = argv.find((item) => item.startsWith("--env"));
  if (!envArgument) {
    return "local";
  }

  const inlineValue = envArgument.startsWith("--env=") ? envArgument.slice("--env=".length) : null;
  const value =
    inlineValue ||
    (() => {
      const index = argv.indexOf("--env");
      return index >= 0 ? argv[index + 1] : null;
    })();

  if (!value || !TARGET_ENVIRONMENTS.includes(value)) {
    throw new Error(`--env には ${TARGET_ENVIRONMENTS.join(" / ")} のいずれかを指定してください。`);
  }

  return value;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidAppBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getRuntimeEnvIssues(env = process.env) {
  const issues = [];

  if (!isNonEmptyString(env.DATABASE_URL)) {
    issues.push("DATABASE_URL が設定されていません。");
  } else if (!isValidDatabaseUrl(env.DATABASE_URL)) {
    issues.push("DATABASE_URL は postgres:// または postgresql:// 形式で指定してください。");
  }

  if (!isNonEmptyString(env.APP_BASE_URL)) {
    issues.push("APP_BASE_URL が設定されていません。");
  } else if (!isValidAppBaseUrl(env.APP_BASE_URL)) {
    issues.push("APP_BASE_URL は http:// または https:// から始まる有効な URL を指定してください。");
  }

  if (!isNonEmptyString(env.GOOGLE_CLIENT_ID)) {
    issues.push("GOOGLE_CLIENT_ID が設定されていません。");
  }

  if (!isNonEmptyString(env.GOOGLE_CLIENT_SECRET)) {
    issues.push("GOOGLE_CLIENT_SECRET が設定されていません。");
  }

  if (env.DEFAULT_TIMEZONE && !isValidTimezone(env.DEFAULT_TIMEZONE)) {
    issues.push("DEFAULT_TIMEZONE は有効な IANA timezone を指定してください。");
  }

  if (env.SESSION_COOKIE_NAME !== undefined && !isNonEmptyString(env.SESSION_COOKIE_NAME)) {
    issues.push("SESSION_COOKIE_NAME を指定する場合は空文字にできません。");
  }

  if (env.SESSION_TTL_SECONDS !== undefined && env.SESSION_TTL_SECONDS !== "") {
    const parsed = Number(env.SESSION_TTL_SECONDS);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      issues.push("SESSION_TTL_SECONDS は 0 より大きい数値を指定してください。");
    }
  }

  return issues;
}

export function isLocalDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function getMigrationEnvIssues(env = process.env) {
  const issues = [];

  if (!isNonEmptyString(env.DATABASE_URL)) {
    issues.push("DATABASE_URL が設定されていません。");
  } else if (!isValidDatabaseUrl(env.DATABASE_URL)) {
    issues.push("DATABASE_URL は postgres:// または postgresql:// 形式で指定してください。");
  }

  return issues;
}

export function getMigrationSafetyIssues(targetEnvironment, env = process.env) {
  if (targetEnvironment === "local") {
    return [];
  }

  if (env.DATABASE_URL && isLocalDatabaseUrl(env.DATABASE_URL)) {
    return [
      `${targetEnvironment} 環境の DATABASE_URL が localhost/127.0.0.1 を指しています。誤った migration を防ぐため実行を中止しました。`,
    ];
  }

  return [];
}

export function formatIssues(issues) {
  return issues.map((issue) => `- ${issue}`).join("\n");
}
