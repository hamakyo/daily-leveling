import { AppError } from "../lib/errors";
import { logSecurityEvent } from "../lib/observability";

const encoder = new TextEncoder();
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const DEFAULT_JWKS_TTL_SECONDS = 300;

interface GoogleJwkSetResponse {
  keys?: JsonWebKey[];
}

interface GoogleJwtHeader {
  alg?: string;
  kid?: string;
}

interface GoogleIdTokenClaims {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number | string;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

interface ParsedJwt {
  header: GoogleJwtHeader;
  payload: GoogleIdTokenClaims;
  signature: Uint8Array;
  signingInput: string;
}

interface JwksCacheEntry {
  expiresAt: number;
  keys: Map<string, JsonWebKey>;
}

interface AuthObservabilityContext {
  clientIp?: string;
  requestId?: string;
  route?: string;
}

let googleJwksCache: JwksCacheEntry | null = null;

function reportAuthEvent(
  event: string,
  context: AuthObservabilityContext | undefined,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  logSecurityEvent(event, {
    route: context?.route,
    clientIp: context?.clientIp,
    requestId: context?.requestId,
    ...details,
  });
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeJsonSegment<T>(input: string): T {
  const json = new TextDecoder().decode(base64UrlDecodeToBytes(input));
  return JSON.parse(json) as T;
}

function parseJwt(idToken: string): ParsedJwt {
  const segments = idToken.split(".");
  if (segments.length !== 3) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの形式が不正です。");
  }

  return {
    header: decodeJsonSegment<GoogleJwtHeader>(segments[0]),
    payload: decodeJsonSegment<GoogleIdTokenClaims>(segments[1]),
    signature: base64UrlDecodeToBytes(segments[2]),
    signingInput: `${segments[0]}.${segments[1]}`,
  };
}

export function parseCacheControlMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) {
    return null;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getRequiredEnvValue(env: Env, key: "GOOGLE_CLIENT_ID"): string {
  const value = env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new AppError(500, "ENV_MISCONFIGURED", `認証設定 ${key} が不足しています。`);
}

async function fetchGoogleJwks(context?: AuthObservabilityContext): Promise<JwksCacheEntry> {
  let response: Response;

  try {
    response = await fetch(GOOGLE_JWKS_URL, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    reportAuthEvent("google_jwks_fetch_failed", context, {
      reason: "network_error",
    });
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Google 公開鍵の取得に失敗しました。");
  }

  if (!response.ok) {
    reportAuthEvent("google_jwks_fetch_failed", context, {
      reason: "http_error",
      status: response.status,
    });
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Google 公開鍵の取得に失敗しました。");
  }

  const payload = (await response.json()) as GoogleJwkSetResponse;
  const keys = new Map<string, JsonWebKey>();

  for (const key of payload.keys || []) {
    const kid = (key as JsonWebKey & { kid?: string }).kid;
    if (key.kty === "RSA" && typeof kid === "string" && key.n && key.e) {
      keys.set(kid, key);
    }
  }

  if (keys.size === 0) {
    reportAuthEvent("google_jwks_fetch_failed", context, {
      reason: "empty_keys",
    });
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Google 公開鍵の取得に失敗しました。");
  }

  const maxAgeSeconds = parseCacheControlMaxAge(response.headers.get("Cache-Control")) || DEFAULT_JWKS_TTL_SECONDS;
  return {
    keys,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
}

async function getGoogleJwk(kid: string, context?: AuthObservabilityContext): Promise<JsonWebKey> {
  const currentTime = Date.now();
  if (googleJwksCache && googleJwksCache.expiresAt > currentTime && googleJwksCache.keys.has(kid)) {
    return googleJwksCache.keys.get(kid) as JsonWebKey;
  }

  try {
    googleJwksCache = await fetchGoogleJwks(context);
  } catch (error) {
    if (googleJwksCache && googleJwksCache.expiresAt > currentTime && googleJwksCache.keys.has(kid)) {
      reportAuthEvent("google_jwks_cache_fallback_used", context, {
        kid,
      });
      return googleJwksCache.keys.get(kid) as JsonWebKey;
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(503, "SERVICE_UNAVAILABLE", "Google 公開鍵の取得に失敗しました。");
  }

  const jwk = googleJwksCache.keys.get(kid);
  if (!jwk) {
    reportAuthEvent("google_id_token_unknown_kid", context, {
      kid,
    });
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの key id が不正です。");
  }

  return jwk;
}

async function importGoogleJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    {
      ...jwk,
      alg: "RS256",
      ext: true,
    },
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );
}

function parseExp(exp: number | string | undefined): number {
  const value = typeof exp === "string" ? Number(exp) : exp;
  if (!Number.isFinite(value)) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの有効期限が不正です。");
  }

  return Number(value);
}

function validateClaims(env: Env, payload: GoogleIdTokenClaims): void {
  if (!payload.iss || !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの issuer が不正です。");
  }

  if (parseExp(payload.exp) <= Math.floor(Date.now() / 1000)) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの有効期限が切れています。");
  }

  if (payload.aud !== getRequiredEnvValue(env, "GOOGLE_CLIENT_ID")) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの audience が一致しません。");
  }

  if (!payload.sub || !payload.email) {
    throw new AppError(401, "UNAUTHORIZED", "Google トークンに必要なユーザー情報がありません。");
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new AppError(401, "UNAUTHORIZED", "Google アカウントのメール認証が必要です。");
  }
}

export async function verifyGoogleIdToken(
  env: Env,
  idToken: string,
  context?: AuthObservabilityContext,
): Promise<{
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const parsed = parseJwt(idToken);

  if (parsed.header.alg !== "RS256") {
    reportAuthEvent("google_id_token_invalid_alg", context, {
      alg: parsed.header.alg || "missing",
    });
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの署名方式が不正です。");
  }

  if (!parsed.header.kid) {
    reportAuthEvent("google_id_token_missing_kid", context, {});
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの key id がありません。");
  }

  const jwk = await getGoogleJwk(parsed.header.kid, context);
  if (jwk.alg && jwk.alg !== "RS256") {
    reportAuthEvent("google_jwk_invalid_alg", context, {
      alg: jwk.alg,
      kid: parsed.header.kid,
    });
    throw new AppError(401, "UNAUTHORIZED", "Google 公開鍵の署名方式が不正です。");
  }

  const key = await importGoogleJwk(jwk);
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    new Uint8Array(parsed.signature),
    encoder.encode(parsed.signingInput),
  );

  if (!isValid) {
    reportAuthEvent("google_id_token_invalid_signature", context, {
      kid: parsed.header.kid,
    });
    throw new AppError(401, "UNAUTHORIZED", "Google トークンの署名検証に失敗しました。");
  }

  validateClaims(env, parsed.payload);

  return {
    googleSub: parsed.payload.sub as string,
    email: parsed.payload.email as string,
    displayName: parsed.payload.name || (parsed.payload.email as string),
    avatarUrl: parsed.payload.picture || null,
  };
}

export function resetGoogleJwksCacheForTesting() {
  googleJwksCache = null;
}
