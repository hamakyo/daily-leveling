import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { getDb } from "../db/client";
import { getCurrentUserBySessionHash, touchSession } from "../db/repositories";
import { getSessionCookieName } from "../lib/config";
import { sha256Base64Url } from "../lib/crypto";
import { AppError } from "../lib/errors";
import type { AppEnv } from "./context";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sessionToken = getCookie(c, getSessionCookieName(c.env));
  if (!sessionToken) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const sessionHash = await sha256Base64Url(sessionToken);
  const db = getDb(c.env);
  const sessionResult = await getCurrentUserBySessionHash(db, sessionHash);

  if (!sessionResult) {
    throw new AppError(401, "UNAUTHORIZED", "Session is invalid or expired.");
  }

  c.set("currentUser", sessionResult.user);
  c.set("session", sessionResult.session);

  void touchSession(db, sessionResult.session.id);
  await next();
});
