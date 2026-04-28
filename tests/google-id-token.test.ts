import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseCacheControlMaxAge,
  resetGoogleJwksCacheForTesting,
  verifyGoogleIdToken,
} from "../src/auth/google-id-token";

const fetchMock = vi.hoisted(() => vi.fn());
const encoder = new TextEncoder();

vi.stubGlobal("fetch", fetchMock);

const env: Env = {
  ASSETS: {
    fetch: async () => new Response("not found", { status: 404 }),
  },
  APP_BASE_URL: "http://localhost:8787",
  DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling_test",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createJwt(options?: {
  alg?: string;
  emailVerified?: boolean;
  exp?: number;
}) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const header = {
    alg: options?.alg ?? "RS256",
    kid: "test-kid",
    typ: "JWT",
  };
  const payload = {
    iss: "https://accounts.google.com",
    aud: env.GOOGLE_CLIENT_ID,
    sub: "google-sub-1",
    email: "tester@example.com",
    email_verified: options?.emailVerified ?? true,
    exp: options?.exp ?? Math.floor(Date.now() / 1000) + 600,
    name: "Tester",
  };
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(
    encoder.encode(JSON.stringify(payload)),
  )}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, encoder.encode(signingInput));
  const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey;

  return {
    token: `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`,
    jwk: {
      ...publicJwk,
      kid: "test-kid",
      alg: "RS256",
      use: "sig",
    },
  };
}

describe("google jwks id token verification", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    resetGoogleJwksCacheForTesting();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy.mockRestore();
  });

  it("parses max-age from cache-control headers", () => {
    expect(parseCacheControlMaxAge("public, max-age=120, must-revalidate")).toBe(120);
    expect(parseCacheControlMaxAge("public, immutable")).toBeNull();
    expect(parseCacheControlMaxAge(null)).toBeNull();
  });

  it("verifies a signed Google token with JWKS and reuses a valid cache", async () => {
    const jwt = await createJwt();
    fetchMock.mockResolvedValue(
      Response.json(
        { keys: [jwt.jwk] },
        {
          headers: {
            "Cache-Control": "public, max-age=120",
          },
        },
      ),
    );

    await expect(verifyGoogleIdToken(env, jwt.token)).resolves.toMatchObject({
      googleSub: "google-sub-1",
      email: "tester@example.com",
      displayName: "Tester",
    });
    await expect(verifyGoogleIdToken(env, jwt.token)).resolves.toMatchObject({
      googleSub: "google-sub-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported signature algorithms before fetching JWKS", async () => {
    const jwt = await createJwt({ alg: "HS256" });

    await expect(verifyGoogleIdToken(env, jwt.token)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects tokens with invalid signatures", async () => {
    const jwt = await createJwt();
    const invalidToken = `${jwt.token.split(".").slice(0, 2).join(".")}.${base64UrlEncode(
      new Uint8Array([9, 8, 7, 6, 5, 4]),
    )}`;
    fetchMock.mockResolvedValue(
      Response.json(
        { keys: [jwt.jwk] },
        {
          headers: {
            "Cache-Control": "public, max-age=120",
          },
        },
      ),
    );

    await expect(verifyGoogleIdToken(env, invalidToken, {
      route: "/auth/google/callback",
      clientIp: "203.0.113.10",
      requestId: "cf-ray-1",
    })).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Google トークンの署名検証に失敗しました。",
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"google_id_token_invalid_signature"'),
    );
  });

  it("rejects when email_verified is false", async () => {
    const jwt = await createJwt({ emailVerified: false });
    fetchMock.mockResolvedValue(
      Response.json(
        { keys: [jwt.jwk] },
        {
          headers: {
            "Cache-Control": "public, max-age=120",
          },
        },
      ),
    );

    await expect(verifyGoogleIdToken(env, jwt.token)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Google アカウントのメール認証が必要です。",
    });
  });

  it("fails closed when JWKS fetch fails and no valid cache exists", async () => {
    const jwt = await createJwt();
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(verifyGoogleIdToken(env, jwt.token, {
      route: "/auth/google/callback",
      clientIp: "203.0.113.10",
      requestId: "cf-ray-2",
    })).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Google 公開鍵の取得に失敗しました。",
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"google_jwks_fetch_failed"'));
  });

  it("rejects when a cache entry has expired and the refresh fails", async () => {
    const jwt = await createJwt();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { keys: [jwt.jwk] },
        {
          headers: {
            "Cache-Control": "public, max-age=1",
          },
        },
      ),
    );

    await verifyGoogleIdToken(env, jwt.token);

    vi.setSystemTime(new Date("2026-04-28T00:00:03.000Z"));
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(verifyGoogleIdToken(env, jwt.token)).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Google 公開鍵の取得に失敗しました。",
    });
  });
});
