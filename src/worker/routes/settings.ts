import { Hono } from "hono";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import { getDb } from "../../db/client";
import {
  getCurrentUserById,
  getSettings,
  updateSettings,
} from "../../db/repositories";
import { settingsSchema } from "../../domain/validation";
import { isValidTimezone } from "../../lib/date";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";
import { parseBody } from "./helpers";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/settings", requireAuth, async (c) => {
  const settings = await getSettings(getDb(c.env), c.get("currentUser").id);
  if (!settings) {
    throw new AppError(404, "NOT_FOUND", "設定が見つかりません。");
  }

  return jsonOk({ settings });
});

settingsRoutes.patch("/settings", requireAuth, async (c) => {
  const payload = parseBody(settingsSchema, await c.req.json());
  if (payload.timezone && !isValidTimezone(payload.timezone)) {
    throw new AppError(400, "INVALID_INPUT", "timezone には有効な IANA timezone を指定してください。");
  }

  const db = getDb(c.env);
  const settings = await updateSettings(db, c.get("currentUser").id, payload);
  if (!settings) {
    throw new AppError(404, "NOT_FOUND", "設定が見つかりません。");
  }

  const refreshedUser = await getCurrentUserById(db, c.get("currentUser").id);
  if (refreshedUser) {
    c.set("currentUser", refreshedUser);
  }

  return jsonOk({ settings });
});
