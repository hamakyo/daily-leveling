#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  formatIssues,
  getMigrationEnvIssues,
  getMigrationSafetyIssues,
  loadEnvFiles,
  resolveTargetEnvironment,
  TARGET_ENVIRONMENTS,
} from "./shared/env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "..", "migrations");
const isPlanOnly = process.argv.includes("--plan") || process.argv.includes("--dry-run");

function printHelp() {
  console.log(`Daily Leveling migration runner

Usage:
  node scripts/migrate.mjs
  node scripts/migrate.mjs --plan
  node scripts/migrate.mjs --env production --plan
  pnpm run db:migrate
  pnpm run db:migrate:plan

Behavior:
  - process.env を優先して読み込みます
  - --env 未指定時は local 扱いです
  - 環境ごとの .dev.vars / .env を優先し、不足分だけ共通ファイルから補完します
  - schema_migrations テーブルで適用済み migration を管理します
  - migration 実行時は DATABASE_URL のみを必須とします
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
const issues = getMigrationEnvIssues();
const safetyIssues = getMigrationSafetyIssues(targetEnvironment);

if (issues.length > 0 || safetyIssues.length > 0) {
  console.error(`migration 実行前の環境変数チェックに失敗しました。対象環境: ${targetEnvironment}`);
  if (loadedFiles.length > 0) {
    console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
  }
  console.error(formatIssues([...issues, ...safetyIssues]));
  process.exit(1);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((filename) => filename.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
});

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;

  const appliedRows = await sql`
    SELECT filename
    FROM schema_migrations
    ORDER BY filename
  `;

  const applied = new Set(appliedRows.map((row) => row.filename));
  const pending = migrationFiles.filter((filename) => !applied.has(filename));

  if (isPlanOnly) {
    console.log(`migration plan (${targetEnvironment}): ${pending.length} 件の未適用 migration`);
    for (const filename of pending) {
      console.log(`- ${filename}`);
    }
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log("未適用 migration はありません。");
    process.exit(0);
  }

  for (const filename of pending) {
    const fullPath = path.join(migrationsDir, filename);
    const migrationSql = readFileSync(fullPath, "utf8");

    await sql.begin(async (transaction) => {
      await transaction.unsafe(migrationSql);
      await transaction`
        INSERT INTO schema_migrations (filename)
        VALUES (${filename})
      `;
    });

    console.log(`適用完了 (${targetEnvironment}): ${filename}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
