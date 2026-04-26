import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors";
import { resolveDatabaseUrl } from "../src/db/client";

describe("database connection resolution", () => {
  it("prefers Hyperdrive connection strings", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgres://direct",
        HYPERDRIVE: {
          connectionString: "postgres://hyperdrive",
        },
      } as Env),
    ).toBe("postgres://hyperdrive");
  });

  it("falls back to DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgres://direct",
      } as Env),
    ).toBe("postgres://direct");
  });

  it("fails fast when no database connection is configured", () => {
    expect(() => resolveDatabaseUrl({} as Env)).toThrow(AppError);
  });
});
