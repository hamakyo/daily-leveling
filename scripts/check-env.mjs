#!/usr/bin/env node
import { formatIssues, getRuntimeEnvIssues, loadEnvFiles } from "./shared/env.mjs";

function printHelp() {
  console.log(`Daily Leveling env checker

Usage:
  node scripts/check-env.mjs
  pnpm run env:check

Behavior:
  - process.env を優先して読み込みます
  - 不足分だけ .dev.vars, .env, .env.local から補完します
  - 必須値と形式を確認します
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const loadedFiles = loadEnvFiles();
const issues = getRuntimeEnvIssues();

if (issues.length > 0) {
  console.error("環境変数チェックに失敗しました。");
  if (loadedFiles.length > 0) {
    console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
  }
  console.error(formatIssues(issues));
  process.exit(1);
}

if (loadedFiles.length > 0) {
  console.log(`環境変数ファイルを読み込みました: ${loadedFiles.join(", ")}`);
}

console.log("環境変数チェックに成功しました。");
