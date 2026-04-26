import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../api/context";
import { getDb } from "../db/client";
import { AppError } from "../lib/errors";
import { jsonError, jsonOk, normalizeError } from "../lib/http";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { e2eRoutes } from "./routes/e2e";
import { habitRoutes } from "./routes/habits";
import { logRoutes } from "./routes/logs";
import { onboardingRoutes } from "./routes/onboarding";
import { settingsRoutes } from "./routes/settings";

export const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const db = getDb(c.env);
  const backgroundTasks: Promise<unknown>[] = [];

  c.set("db", db);
  c.set("backgroundTasks", backgroundTasks);

  try {
    await next();
  } finally {
    const closeDb = Promise.allSettled(backgroundTasks)
      .then(() => {
        if (typeof db.end === "function") {
          return db.end({ timeout: 5 });
        }
      })
      .catch((error) => {
        console.error("Failed to close database client", error);
      });

    try {
      c.executionCtx.waitUntil(closeDb);
    } catch {
      void closeDb;
    }
  }
});

app.onError((error) => {
  if (error instanceof ZodError) {
    return jsonError(new AppError(400, "INVALID_INPUT", error.issues[0]?.message || "入力内容が不正です。"));
  }

  return jsonError(normalizeError(error));
});

app.notFound(() => jsonError(new AppError(404, "NOT_FOUND", "指定されたルートは存在しません。")));

app.get("/healthz", () =>
  jsonOk({
    ok: true,
    service: "daily-leveling",
  }),
);

app.route("/", authRoutes);
app.route("/", onboardingRoutes);
app.route("/", habitRoutes);
app.route("/", logRoutes);
app.route("/", dashboardRoutes);
app.route("/", settingsRoutes);
app.route("/", e2eRoutes);
