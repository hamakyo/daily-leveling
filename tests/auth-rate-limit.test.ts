import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRateLimitKey, consumeRateLimit, getRateLimitTtlSeconds } from "../src/auth/rate-limit";
import { getClientIp } from "../src/lib/request";

function createKvStore() {
  const values = new Map<string, string>();

  return {
    store: values,
    binding: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    } satisfies KVNamespaceBinding,
  };
}

describe("auth rate limit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("builds a deterministic fixed-window key", () => {
    expect(buildRateLimitKey("/auth/google/start", "203.0.113.10", 120_000, 60)).toBe(
      "auth-rate-limit:/auth/google/start:203.0.113.10:2",
    );
  });

  it("consumes requests until the fixed-window threshold is reached", async () => {
    const kv = createKvStore();
    const rule = {
      routeKey: "/auth/google/start",
      limit: 2,
      windowSeconds: 60,
    };

    await expect(consumeRateLimit(kv.binding, rule, "203.0.113.10", 61_000)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 59,
    });
    await expect(consumeRateLimit(kv.binding, rule, "203.0.113.10", 61_000)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 59,
    });
    await expect(consumeRateLimit(kv.binding, rule, "203.0.113.10", 61_000)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 59,
    });
  });

  it("uses a KV ttl that never drops below 60 seconds", () => {
    expect(getRateLimitTtlSeconds(4, 60)).toBe(65);
    expect(getRateLimitTtlSeconds(59, 60)).toBe(65);
    expect(getRateLimitTtlSeconds(120, 60)).toBe(125);
  });

  it("prefers CF-Connecting-IP over X-Forwarded-For", () => {
    const request = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "198.51.100.1",
        "X-Forwarded-For": "203.0.113.10, 203.0.113.11",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.1");
  });

  it("falls back to the first X-Forwarded-For value", () => {
    const request = new Request("https://example.com", {
      headers: {
        "X-Forwarded-For": "203.0.113.10, 203.0.113.11",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("returns unknown when no forwarding headers exist", () => {
    expect(getClientIp(new Request("https://example.com"))).toBe("unknown");
  });
});
