import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../api/context";
import { AppError } from "../lib/errors";
import { jsonError } from "../lib/http";
import { logSecurityEvent } from "../lib/observability";
import { getClientIp, getRequestId } from "../lib/request";

interface RateLimitRule {
  routeKey: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
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
      limit: rule.limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  const nextCount = Number.isFinite(current) ? current + 1 : 1;
  await store.put(key, String(nextCount), {
    expirationTtl: getRateLimitTtlSeconds(retryAfterSeconds, rule.windowSeconds),
  });

  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(rule.limit - nextCount, 0),
    retryAfterSeconds,
  };
}

export { getRateLimitTtlSeconds };

function applyRateLimitHeaders(response: Response, result: RateLimitResult) {
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  response.headers.set("RateLimit-Limit", String(result.limit));
  response.headers.set("RateLimit-Remaining", String(result.remaining));
  response.headers.set("RateLimit-Reset", String(result.retryAfterSeconds));
}

function prefersHtmlNavigation(request: Request): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
}

function createRateLimitedRedirect(appBaseUrl: string, retryAfterSeconds: number): Response {
  const location = new URL("/", appBaseUrl);
  location.searchParams.set("authError", "rate_limited");
  location.searchParams.set("retryAfter", String(retryAfterSeconds));
  return new Response(null, {
    status: 302,
    headers: {
      Location: location.toString(),
      "Cache-Control": "no-store",
    },
  });
}

export function createAuthRateLimitMiddleware(rule: RateLimitRule) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const store = c.env.AUTH_RATE_LIMITS;
    if (!store) {
      await next();
      return;
    }

    const clientIp = getClientIp(c.req.raw);
    const requestId = getRequestId(c.req.raw);
    const result = await consumeRateLimit(store, rule, clientIp);
    if (!result.allowed) {
      logSecurityEvent("auth_rate_limited", {
        routeKey: rule.routeKey,
        clientIp,
        requestId,
        retryAfterSeconds: result.retryAfterSeconds,
        limit: result.limit,
      });
      const response = prefersHtmlNavigation(c.req.raw)
        ? createRateLimitedRedirect(c.env.APP_BASE_URL, result.retryAfterSeconds)
        : jsonError(
            new AppError(
              429,
              "RATE_LIMITED",
              "リクエストが多すぎます。しばらく待ってから再試行してください。",
            ),
          );
      applyRateLimitHeaders(response, result);
      return response;
    }

    await next();
    applyRateLimitHeaders(c.res, result);
  });
}
