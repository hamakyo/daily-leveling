import { deleteCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { getSessionCookieName, getSessionTtlSeconds, isSecureCookie } from "../lib/config";

export function setSessionCookie(c: Context, sessionToken: string, expiresAt: Date) {
  setCookie(c, getSessionCookieName(c.env), sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isSecureCookie(c.env.APP_BASE_URL),
    expires: expiresAt,
    maxAge: getSessionTtlSeconds(c.env),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, getSessionCookieName(c.env), {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isSecureCookie(c.env.APP_BASE_URL),
  });
}
