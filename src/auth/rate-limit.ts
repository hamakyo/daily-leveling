import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../api/context";
import { AppError } from "../lib/errors";
import { jsonError } from "../lib/http";
import { getClientIp } from "../lib/request";

interface RateLimitRule {
  routeKey: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function getWindowBucket(now: number, windowSeconds: number): number {
  return Math.floor(now / 1000 / windowSeconds);
}

function getSecondsUntilNextWindow(now: number, windowSeconds: number): number {
  return windowSeconds - (Math.floor(now / 1000) % windowSeconds);
}

function getRateLimitTtlSeconds(retryAfterSeconds: number, windowSeconds: number): number {
  return Math.max(retryAfterSeconds + 5, windowSeconds + 5, 60);
}

export function buildRateLimitKey(routeKey: string, clientIp: string, now: number, windowSeconds: number): string {
  return `auth-rate-limit:${routeKey}:${clientIp}:${getWindowBucket(now, windowSeconds)}`;
}

export async function consumeRateLimit(
  store: KVNamespaceBinding,
  rule: RateLimitRule,
  clientIp: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const retryAfterSeconds = getSecondsUntilNextWindow(now, rule.windowSeconds);
  const key = buildRateLimitKey(rule.routeKey, clientIp, now, rule.windowSeconds);
  const currentRaw = await store.get(key, "text");
  const current = currentRaw ? Number(currentRaw) : 0;

  if (Number.isFinite(current) && current >= rule.limit) {
    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  const nextCount = Number.isFinite(current) ? current + 1 : 1;
  await store.put(key, String(nextCount), {
    expirationTtl: getRateLimitTtlSeconds(retryAfterSeconds, rule.windowSeconds),
  });

  return {
    allowed: true,
    retryAfterSeconds,
  };
}

export { getRateLimitTtlSeconds };

export function createAuthRateLimitMiddleware(rule: RateLimitRule) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const store = c.env.AUTH_RATE_LIMITS;
    if (!store) {
      await next();
      return;
    }

    const result = await consumeRateLimit(store, rule, getClientIp(c.req.raw));
    if (!result.allowed) {
      const response = jsonError(
        new AppError(429, "RATE_LIMITED", "リクエストが多すぎます。しばらく待ってから再試行してください。"),
      );
      response.headers.set("Retry-After", String(result.retryAfterSeconds));
      return response;
    }

    await next();
  });
}
