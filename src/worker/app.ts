import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../api/context";
import { AppError } from "../lib/errors";
import { jsonError, jsonOk, normalizeError } from "../lib/http";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { habitRoutes } from "./routes/habits";
import { logRoutes } from "./routes/logs";
import { onboardingRoutes } from "./routes/onboarding";
import { settingsRoutes } from "./routes/settings";

export const app = new Hono<AppEnv>();

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
