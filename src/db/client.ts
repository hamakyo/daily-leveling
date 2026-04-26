import postgres from "postgres";
import { AppError } from "../lib/errors";

export type DatabaseClient = ReturnType<typeof postgres>;

export function resolveDatabaseUrl(env: Env): string {
  const databaseUrl = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

  if (!databaseUrl) {
    throw new AppError(500, "DB_MISCONFIGURED", "DB 接続設定が不足しています。");
  }

  return databaseUrl;
}

export function getDb(env: Env): DatabaseClient {
  const databaseUrl = resolveDatabaseUrl(env);

  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 10,
  });
}
