import { createOpaqueToken, createPkcePair } from "../lib/crypto";
import { AppError } from "../lib/errors";
export { verifyGoogleIdToken } from "./google-id-token";

export const GOOGLE_STATE_COOKIE = "dl_google_state";
export const GOOGLE_VERIFIER_COOKIE = "dl_google_verifier";

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

function getRequiredEnvValue(
  env: Env,
  key: "APP_BASE_URL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET",
): string {
  const value = env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new AppError(500, "ENV_MISCONFIGURED", `認証設定 ${key} が不足しています。`);
}

function getRedirectUri(env: Env): string {
  return new URL("/auth/google/callback", getRequiredEnvValue(env, "APP_BASE_URL")).toString();
}

export async function createGoogleAuthorizationRequest(env: Env): Promise<{
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}> {
  const state = createOpaqueToken();
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const params = new URLSearchParams({
    client_id: getRequiredEnvValue(env, "GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(env),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return {
    authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
    codeVerifier,
  };
}

export async function exchangeAuthorizationCode(
  env: Env,
  code: string,
  codeVerifier: string,
): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    code,
    client_id: getRequiredEnvValue(env, "GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnvValue(env, "GOOGLE_CLIENT_SECRET"),
    redirect_uri: getRedirectUri(env),
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.id_token) {
    throw new AppError(
      401,
      "UNAUTHORIZED",
      payload.error_description || payload.error || "認証コードの交換に失敗しました。",
    );
  }

  return {
    idToken: payload.id_token,
  };
}
