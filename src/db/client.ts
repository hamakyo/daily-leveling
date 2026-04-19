import postgres from "postgres";

export type DatabaseClient = ReturnType<typeof postgres>;

let client: DatabaseClient | null = null;
let clientUrl: string | null = null;

export function getDb(env: Env): DatabaseClient {
  if (client && clientUrl === env.DATABASE_URL) {
    return client;
  }

  clientUrl = env.DATABASE_URL;
  client = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 10,
  });

  return client;
}
