#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { formatIssues, loadEnvFiles, resolveTargetEnvironment } from "./shared/env.mjs";

const SUPPORTED_ENVIRONMENTS = new Set(["test", "staging", "production"]);
const REQUIRED_SECRET_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const OPTIONAL_SECRET_KEYS = ["DATABASE_URL"];

function printHelp() {
  console.log(`Cloudflare secrets sync

Usage:
  node scripts/sync-cloudflare-secrets.mjs --env staging
  node scripts/sync-cloudflare-secrets.mjs --env production --dry-run
  pnpm run cf:sync-secrets:staging

Behavior:
  - 対象環境の .dev.vars / .env を読み込みます
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET を必須対象にします
  - DATABASE_URL は fallback が必要な場合だけ同期します
  - wrangler secret bulk で Cloudflare に反映します
`);
}

function getSecretIssues(env = process.env) {
  const issues = [];

  for (const key of REQUIRED_SECRET_KEYS) {
    const value = env[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`${key} が設定されていません。`);
    }
  }

  return issues;
}

function isDryRun(argv = process.argv.slice(2)) {
  return argv.includes("--dry-run");
}

function allowsLocalDatabaseUrl(argv = process.argv.slice(2)) {
  return argv.includes("--allow-local-database-url");
}

function resolveEnvironment(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const targetEnvironment = resolveTargetEnvironment(argv);
  if (!SUPPORTED_ENVIRONMENTS.has(targetEnvironment)) {
    throw new Error("--env には test / staging / production のいずれかを指定してください。");
  }

  return targetEnvironment;
}

function buildSecretsPayload(env = process.env) {
  const keys = [...REQUIRED_SECRET_KEYS, ...OPTIONAL_SECRET_KEYS.filter((key) => env[key])];
  return Object.fromEntries(keys.map((key) => [key, env[key]]));
}

function isLocalDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getSafetyIssues(targetEnvironment, loadedFiles, env = process.env, argv = process.argv.slice(2)) {
  const issues = [];
  const loadedBasenames = loadedFiles.map((filename) => path.basename(filename));
  const hasEnvironmentSpecificFile = loadedBasenames.some((filename) => {
    return filename.endsWith(`.${targetEnvironment}`) || filename.includes(`.${targetEnvironment}.`);
  });

  if (!hasEnvironmentSpecificFile) {
    issues.push(`${targetEnvironment} 用の .dev.vars.${targetEnvironment} または .env.${targetEnvironment} が見つかりません。`);
  }

  if (env.DATABASE_URL && isLocalDatabaseUrl(env.DATABASE_URL) && !allowsLocalDatabaseUrl(argv)) {
    issues.push(
      "DATABASE_URL が localhost/127.0.0.1 を指しています。Cloudflare から接続できないため同期を拒否しました。",
    );
  }

  return issues;
}

function runSecretBulk(targetEnvironment, payload) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "daily-leveling-secrets-"));
  const secretsFile = path.join(tempDir, `${targetEnvironment}.json`);

  try {
    writeFileSync(secretsFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const result = spawnSync("pnpm", ["exec", "wrangler", "secret", "bulk", secretsFile, "--env", targetEnvironment], {
      encoding: "utf8",
      stdio: "inherit",
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const targetEnvironment = resolveEnvironment(argv);
  const loadedFiles = loadEnvFiles({ targetEnvironment });
  const issues = getSecretIssues();
  const safetyIssues = getSafetyIssues(targetEnvironment, loadedFiles, process.env, argv);

  if (issues.length > 0 || safetyIssues.length > 0) {
    console.error(`Cloudflare secret sync の前提が不足しています。対象環境: ${targetEnvironment}`);
    if (loadedFiles.length > 0) {
      console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
    }
    console.error(formatIssues([...issues, ...safetyIssues]));
    process.exit(1);
  }

  const payload = buildSecretsPayload();

  if (isDryRun(argv)) {
    console.log(`Cloudflare secret sync dry-run: ${targetEnvironment}`);
    if (loadedFiles.length > 0) {
      console.log(`- files: ${loadedFiles.join(", ")}`);
    }
    console.log(`- keys: ${Object.keys(payload).join(", ")}`);
    return;
  }

  runSecretBulk(targetEnvironment, payload);
}

main();
