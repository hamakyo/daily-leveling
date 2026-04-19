export function getSessionCookieName(env: Env): string {
  return env.SESSION_COOKIE_NAME || "dl_session";
}

export function getSessionTtlSeconds(env: Env): number {
  const raw = env.SESSION_TTL_SECONDS;
  const parsed = raw ? Number(raw) : 60 * 60 * 24 * 14;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 14;
}

export function getDefaultTimezone(env: Env): string {
  return env.DEFAULT_TIMEZONE || "Asia/Tokyo";
}

export function isSecureCookie(baseUrl: string): boolean {
  return baseUrl.startsWith("https://");
}
