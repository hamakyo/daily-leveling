#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { formatIssues, loadEnvFiles, resolveTargetEnvironment } from "./shared/env.mjs";

const SUPPORTED_ENVIRONMENTS = new Set(["test", "staging", "production"]);
const REQUIRED_SECRET_KEYS = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];

function printHelp() {
  console.log(`Cloudflare secrets sync

Usage:
  node scripts/sync-cloudflare-secrets.mjs --env staging
  node scripts/sync-cloudflare-secrets.mjs --env production --dry-run
  pnpm run cf:sync-secrets:staging

Behavior:
  - 対象環境の .dev.vars / .env を読み込みます
  - DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET を対象にします
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
  return Object.fromEntries(REQUIRED_SECRET_KEYS.map((key) => [key, env[key]]));
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

  if (issues.length > 0) {
    console.error(`Cloudflare secret sync の前提が不足しています。対象環境: ${targetEnvironment}`);
    if (loadedFiles.length > 0) {
      console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
    }
    console.error(formatIssues(issues));
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
