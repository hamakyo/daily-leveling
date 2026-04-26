import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  createGoogleAuthorizationRequest,
  exchangeAuthorizationCode,
  verifyGoogleIdToken,
} from "../../auth/google";
import { clearSessionCookie, setSessionCookie } from "../../auth/session";
import {
  createSession,
  revokeSession,
  upsertGoogleUser,
} from "../../db/repositories";
import { getDefaultTimezone, getSessionTtlSeconds } from "../../lib/config";
import { createOpaqueToken, sha256Base64Url } from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";
import { getClientMetadata, getOAuthCookieOptions } from "./helpers";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/auth/google/start", async (c) => {
  const { authorizationUrl, state, codeVerifier } = await createGoogleAuthorizationRequest(c.env);
  const cookieOptions = getOAuthCookieOptions(c.env);

  setCookie(c, GOOGLE_STATE_COOKIE, state, cookieOptions);
  setCookie(c, GOOGLE_VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return c.redirect(authorizationUrl, 302);
});

authRoutes.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, GOOGLE_STATE_COOKIE);
  const codeVerifier = getCookie(c, GOOGLE_VERIFIER_COOKIE);

  if (!code || !state) {
    throw new AppError(401, "UNAUTHORIZED", "OAuth callback に必要なパラメータが不足しています。");
  }

  if (!expectedState || !codeVerifier || state !== expectedState) {
    throw new AppError(401, "UNAUTHORIZED", "OAuth の state 検証に失敗しました。");
  }

  const tokens = await exchangeAuthorizationCode(c.env, code, codeVerifier);
  const identity = await verifyGoogleIdToken(c.env, tokens.idToken);
  const db = c.get("db");
  const user = await upsertGoogleUser(db, identity, getDefaultTimezone(c.env));
  const sessionToken = createOpaqueToken();
  const sessionHash = await sha256Base64Url(sessionToken);
  const expiresAt = new Date(Date.now() + getSessionTtlSeconds(c.env) * 1000);

  await createSession(db, user.id, sessionHash, expiresAt, getClientMetadata(c.req.raw));

  deleteCookie(c, GOOGLE_STATE_COOKIE, getOAuthCookieOptions(c.env));
  deleteCookie(c, GOOGLE_VERIFIER_COOKIE, getOAuthCookieOptions(c.env));
  setSessionCookie(c, sessionToken, expiresAt);

  const redirectPath = user.onboardingCompleted ? "/dashboard" : "/onboarding";
  return c.redirect(new URL(redirectPath, c.env.APP_BASE_URL).toString(), 302);
});

authRoutes.get("/auth/me", requireAuth, async (c) => {
  return jsonOk({
    user: c.get("currentUser"),
  });
});

authRoutes.post("/auth/logout", requireAuth, async (c) => {
  const db = c.get("db");
  await revokeSession(db, c.get("session").id);
  clearSessionCookie(c);
  return jsonOk({ ok: true });
});
