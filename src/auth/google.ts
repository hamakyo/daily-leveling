import { createOpaqueToken, createPkcePair } from "../lib/crypto";
import { AppError } from "../lib/errors";

export const GOOGLE_STATE_COOKIE = "dl_google_state";
export const GOOGLE_VERIFIER_COOKIE = "dl_google_verifier";

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenInfoResponse {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

function getRedirectUri(env: Env): string {
  return new URL("/auth/google/callback", env.APP_BASE_URL).toString();
}

export async function createGoogleAuthorizationRequest(env: Env): Promise<{
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}> {
  const state = createOpaqueToken();
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
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
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
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
      payload.error_description || payload.error || "Failed to exchange authorization code.",
    );
  }

  return {
    idToken: payload.id_token,
  };
}

export async function verifyGoogleIdToken(
  env: Env,
  idToken: string,
): Promise<{
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", idToken);

  const response = await fetch(url);
  const payload = (await response.json()) as GoogleTokenInfoResponse;

  if (!response.ok) {
    throw new AppError(401, "UNAUTHORIZED", "Google token verification failed.");
  }

  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AppError(401, "UNAUTHORIZED", "Google token audience mismatch.");
  }

  if (!payload.sub || !payload.email) {
    throw new AppError(401, "UNAUTHORIZED", "Google token is missing identity fields.");
  }

  if (payload.email_verified !== "true") {
    throw new AppError(401, "UNAUTHORIZED", "Google email must be verified.");
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    displayName: payload.name || payload.email,
    avatarUrl: payload.picture || null,
  };
}
