#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { formatIssues, getRuntimeEnvIssues, loadEnvFiles } from "./shared/env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "..", "migrations");
const isPlanOnly = process.argv.includes("--plan") || process.argv.includes("--dry-run");

function printHelp() {
  console.log(`Daily Leveling migration runner

Usage:
  node scripts/migrate.mjs
  node scripts/migrate.mjs --plan
  pnpm run db:migrate
  pnpm run db:migrate:plan

Behavior:
  - process.env を優先して読み込みます
  - 不足分だけ .dev.vars, .env, .env.local から補完します
  - schema_migrations テーブルで適用済み migration を管理します
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const loadedFiles = loadEnvFiles();
const issues = getRuntimeEnvIssues();

if (issues.length > 0) {
  console.error("migration 実行前の環境変数チェックに失敗しました。");
  if (loadedFiles.length > 0) {
    console.error(`読み込んだファイル: ${loadedFiles.join(", ")}`);
  }
  console.error(formatIssues(issues));
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
    console.log(`migration plan: ${pending.length} 件の未適用 migration`);
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

    console.log(`適用完了: ${filename}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
