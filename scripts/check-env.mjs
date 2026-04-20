#!/usr/bin/env node
import {
  formatIssues,
  getRuntimeEnvIssues,
  loadEnvFiles,
  resolveTargetEnvironment,
  TARGET_ENVIRONMENTS,
} from "./shared/env.mjs";

function printHelp() {
  console.log(`Daily Leveling env checker

Usage:
  node scripts/check-env.mjs
  node scripts/check-env.mjs --env staging
  pnpm run env:check

Behavior:
  - process.env を優先して読み込みます
  - --env 未指定時は local 扱いです
  - 環境ごとの .dev.vars / .env を優先し、不足分だけ共通ファイルから補完します
  - 必須値と形式を確認します
  - 対応環境: ${TARGET_ENVIRONMENTS.join(", ")}
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

let targetEnvironment;

try {
  targetEnvironment = resolveTargetEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : "環境の解釈に失敗しました。");
  process.exit(1);
}

const loadedFiles = loadEnvFiles({ targetEnvironment });
const issues = getRuntimeEnvIssues();

if (issues.length > 0) {
  console.error(`環境変数チェックに失敗しました。対象環境: ${targetEnvironment}`);
  if (loadedFiles.length > 0) {
    console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
  }
  console.error(formatIssues(issues));
  process.exit(1);
}

if (loadedFiles.length > 0) {
  console.log(`環境変数ファイルを読み込みました: ${loadedFiles.join(", ")}`);
}

console.log(`環境変数チェックに成功しました。対象環境: ${targetEnvironment}`);
