import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, HabitRecord, SessionRecord } from "../src/lib/types";

const assetMocks = vi.hoisted(() => ({
  fetch: vi.fn(async () => new Response("not found", { status: 404 })),
}));

const fetchMock = vi.hoisted(() => vi.fn());

const clientMocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ kind: "db" })),
}));

const repositoryMocks = vi.hoisted(() => ({
  countCompletedHabitLogs: vi.fn(),
  completeOnboarding: vi.fn(),
  createHabit: vi.fn(),
  createHabitsFromTemplate: vi.fn(),
  createSession: vi.fn(),
  getCurrentUserById: vi.fn(),
  getCurrentUserBySessionHash: vi.fn(),
  getHabitById: vi.fn(),
  getSettings: vi.fn(),
  listHabits: vi.fn(),
  listLogsInRange: vi.fn(),
  reorderHabits: vi.fn(),
  revokeSession: vi.fn(),
  touchSession: vi.fn(),
  updateHabit: vi.fn(),
  updateSettings: vi.fn(),
  upsertGoogleUser: vi.fn(),
  upsertHabitLog: vi.fn(),
}));

vi.mock("../src/db/client", () => clientMocks);
vi.mock("../src/db/repositories", () => repositoryMocks);
vi.stubGlobal("fetch", fetchMock);

import { app } from "../src/worker/app";

const env: Env = {
  ASSETS: {
    fetch: assetMocks.fetch,
  },
  APP_BASE_URL: "http://localhost:8787",
  DATABASE_URL: "postgres://user:pass@localhost:5432/daily_leveling_test",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
};

const currentUser: CurrentUser = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  email: "tester@example.com",
  displayName: "Tester",
  avatarUrl: null,
  onboardingCompleted: true,
  timezone: "UTC",
  defaultView: "today",
  theme: "light",
};

const session: SessionRecord = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  userId: currentUser.id,
  expiresAt: "2099-01-01T00:00:00.000Z",
  revokedAt: null,
  lastSeenAt: null,
};

const habitId = "11111111-1111-4111-8111-111111111111";
const trustedOrigin = "http://localhost:8787";
const encoder = new TextEncoder();

function makeHabit(overrides: Partial<HabitRecord> = {}): HabitRecord {
  return {
    id: habitId,
    userId: currentUser.id,
    name: "Read",
    emoji: "📚",
    color: "blue",
    frequencyType: "daily",
    targetWeekdays: null,
    intervalDays: null,
    isActive: true,
    displayOrder: 0,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

async function request(path: string, init?: RequestInit, envOverride?: Partial<Env>) {
  return app.request(`http://localhost${path}`, init, {
    ...env,
    ...envOverride,
  });
}

function makeExecutionContext() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as NonNullable<Parameters<typeof app.request>[3]>;
}

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

async function createSignedGoogleIdToken() {
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
    alg: "RS256",
    kid: "test-kid",
    typ: "JWT",
  };
  const payload = {
    iss: "https://accounts.google.com",
    aud: env.GOOGLE_CLIENT_ID,
    sub: "google-sub-1",
    email: "tester@example.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
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

describe("worker app auth and log guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assetMocks.fetch.mockResolvedValue(new Response("not found", { status: 404 }));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => {
      throw new Error("Unexpected fetch");
    });
    clientMocks.getDb.mockReturnValue({ kind: "db" });
    repositoryMocks.countCompletedHabitLogs.mockResolvedValue(0);
    repositoryMocks.touchSession.mockResolvedValue(undefined);
  });

  it("rejects auth-required routes when the session cookie is missing", async () => {
    const response = await request("/auth/me");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "認証が必要です。",
      },
    });
    expect(repositoryMocks.getCurrentUserBySessionHash).not.toHaveBeenCalled();
  });

  it("fails fast when google auth env is missing", async () => {
    const response = await app.request("http://localhost/auth/google/start", undefined, {
      ...env,
      GOOGLE_CLIENT_ID: "",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ENV_MISCONFIGURED",
        message: "認証設定 GOOGLE_CLIENT_ID が不足しています。",
      },
    });
  });

  it("returns the current user when the session is valid", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    const executionCtx = makeExecutionContext();

    const response = await app.request(
      "http://localhost/auth/me",
      {
        headers: {
          cookie: "dl_session=valid-session-token",
        },
      },
      env,
      executionCtx,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: currentUser,
    });
    expect(repositoryMocks.touchSession).toHaveBeenCalledWith({ kind: "db" }, session.id);
    expect(executionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("starts google auth without requesting offline access", async () => {
    const response = await request("/auth/google/start");

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const authorizationUrl = new URL(location as string);
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(authorizationUrl.searchParams.has("access_type")).toBe(false);
    expect(authorizationUrl.searchParams.get("prompt")).toBe("select_account");
  });

  it("rate limits auth/google/start when the threshold is exceeded", async () => {
    const response = await request("/auth/google/start", undefined, {
      AUTH_RATE_LIMITS: {
        get: vi.fn(async () => "10"),
        put: vi.fn(async () => undefined),
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-limit")).toBe("10");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    expect(response.headers.get("ratelimit-reset")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "リクエストが多すぎます。しばらく待ってから再試行してください。",
      },
    });
  });

  it("redirects browser navigation back to login when auth/google/start is rate limited", async () => {
    const response = await request(
      "/auth/google/start",
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
        },
      },
      {
        AUTH_RATE_LIMITS: {
          get: vi.fn(async () => "10"),
          put: vi.fn(async () => undefined),
        },
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/?authError=rate_limited&retryAfter=");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("ratelimit-limit")).toBe("10");
  });

  it("rate limits auth/google/callback before token exchange", async () => {
    const response = await request("/auth/google/callback?code=test-code&state=test-state", {
      headers: {
        cookie: "dl_google_state=test-state; dl_google_verifier=test-verifier",
      },
    }, {
      AUTH_RATE_LIMITS: {
        get: vi.fn(async () => "10"),
        put: vi.fn(async () => undefined),
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-limit")).toBe("10");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "リクエストが多すぎます。しばらく待ってから再試行してください。",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects browser navigation back to login when auth/google/callback is rate limited", async () => {
    const response = await request(
      "/auth/google/callback?code=test-code&state=test-state",
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          cookie: "dl_google_state=test-state; dl_google_verifier=test-verifier",
        },
      },
      {
        AUTH_RATE_LIMITS: {
          get: vi.fn(async () => "10"),
          put: vi.fn(async () => undefined),
        },
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/?authError=rate_limited&retryAfter=");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns level progress in today dashboard", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.listHabits.mockResolvedValue([makeHabit()]);
    repositoryMocks.listLogsInRange.mockResolvedValue([]);
    repositoryMocks.countCompletedHabitLogs.mockResolvedValue(12);

    const response = await request("/dashboard/today", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      date: expect.any(String),
      level: {
        level: 2,
        completedCount: 12,
        totalXp: 120,
      },
    });
  });

  it("returns dashboard bootstrap payload in a single request", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.listHabits.mockResolvedValue([makeHabit()]);
    repositoryMocks.listLogsInRange
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    repositoryMocks.countCompletedHabitLogs.mockResolvedValue(12);

    const response = await request("/dashboard/bootstrap?month=2026-04", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      today: {
        date: expect.any(String),
        level: {
          level: 2,
          completedCount: 12,
          totalXp: 120,
        },
      },
      monthly: {
        month: "2026-04",
      },
      weekly: {
        date: expect.any(String),
        week: {
          startDate: expect.any(String),
          endDate: expect.any(String),
        },
      },
      habits: [expect.objectContaining({ id: habitId })],
      settings: {
        timezone: "UTC",
        defaultView: "today",
        theme: "light",
      },
    });
  });

  it("creates an every_n_days habit with intervalDays", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.createHabit.mockResolvedValue(
      makeHabit({
        name: "Laundry",
        frequencyType: "every_n_days",
        targetWeekdays: null,
        intervalDays: 3,
      }),
    );

    const response = await request("/habits", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({
        name: "Laundry",
        frequencyType: "every_n_days",
        targetWeekdays: null,
        intervalDays: 3,
      }),
    });

    expect(response.status).toBe(201);
    expect(repositoryMocks.createHabit).toHaveBeenCalledWith({ kind: "db" }, currentUser.id, {
      name: "Laundry",
      frequencyType: "every_n_days",
      targetWeekdays: null,
      intervalDays: 3,
    });
  });

  it("rejects future habit logs", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.getHabitById.mockResolvedValue(makeHabit());

    const response = await request(`/habits/${habitId}/logs/2999-01-01`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({ status: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_DATE",
        message: "未来日の記録はできません。",
      },
    });
    expect(repositoryMocks.upsertHabitLog).not.toHaveBeenCalled();
  });

  it("rejects logs on non-target weekdays", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.getHabitById.mockResolvedValue(
      makeHabit({
        frequencyType: "weekly_days",
        targetWeekdays: [1, 3, 5],
      }),
    );

    const response = await request(`/habits/${habitId}/logs/2026-04-14`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({ status: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_DATE",
        message: "その日はこの習慣の対象日ではありません。",
      },
    });
    expect(repositoryMocks.upsertHabitLog).not.toHaveBeenCalled();
  });

  it("rejects logs on non-target every_n_days dates", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.getHabitById.mockResolvedValue(
      makeHabit({
        name: "Laundry",
        frequencyType: "every_n_days",
        targetWeekdays: null,
        intervalDays: 3,
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      }),
    );

    const response = await request(`/habits/${habitId}/logs/2026-04-21`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({ status: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_DATE",
        message: "その日はこの習慣の対象日ではありません。",
      },
    });
    expect(repositoryMocks.upsertHabitLog).not.toHaveBeenCalled();
  });

  it("rejects log updates for archived habits", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.getHabitById.mockResolvedValue(
      makeHabit({
        isActive: false,
      }),
    );

    const response = await request(`/habits/${habitId}/logs/2026-04-20`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({ status: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_DATE",
        message: "その日はこの習慣の対象日ではありません。",
      },
    });
    expect(repositoryMocks.upsertHabitLog).not.toHaveBeenCalled();
  });

  it("rejects unsafe state-changing requests from an untrusted origin", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });

    const response = await request("/auth/logout", {
      method: "POST",
      headers: {
        cookie: "dl_session=valid-session-token",
        origin: "https://evil.example",
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "不正なリクエスト元です。",
      },
    });
    expect(repositoryMocks.revokeSession).not.toHaveBeenCalled();
  });

  it("rate limits logout before session revocation", async () => {
    const response = await request(
      "/auth/logout",
      {
        method: "POST",
        headers: {
          cookie: "dl_session=valid-session-token",
          origin: trustedOrigin,
        },
      },
      {
        AUTH_RATE_LIMITS: {
          get: vi.fn(async () => "30"),
          put: vi.fn(async () => undefined),
        },
      },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-limit")).toBe("30");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    expect(repositoryMocks.revokeSession).not.toHaveBeenCalled();
  });

  it("accepts week as a valid settings defaultView", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.updateSettings.mockResolvedValue({
      timezone: "UTC",
      defaultView: "week",
      theme: "light",
    });
    repositoryMocks.getCurrentUserById.mockResolvedValue({
      ...currentUser,
      defaultView: "week",
    });

    const response = await request("/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({
        defaultView: "week",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: {
        timezone: "UTC",
        defaultView: "week",
        theme: "light",
      },
    });
    expect(repositoryMocks.updateSettings).toHaveBeenCalledWith({ kind: "db" }, currentUser.id, {
      defaultView: "week",
    });
  });

  it("accepts dark as a valid settings theme", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.updateSettings.mockResolvedValue({
      timezone: "UTC",
      defaultView: "today",
      theme: "dark",
    });
    repositoryMocks.getCurrentUserById.mockResolvedValue({
      ...currentUser,
      theme: "dark",
    });

    const response = await request("/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({
        theme: "dark",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: {
        timezone: "UTC",
        defaultView: "today",
        theme: "dark",
      },
    });
    expect(repositoryMocks.updateSettings).toHaveBeenCalledWith({ kind: "db" }, currentUser.id, {
      theme: "dark",
    });
  });

  it("accepts system as a valid settings theme", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.updateSettings.mockResolvedValue({
      timezone: "UTC",
      defaultView: "today",
      theme: "system",
    });
    repositoryMocks.getCurrentUserById.mockResolvedValue({
      ...currentUser,
      theme: "system",
    });

    const response = await request("/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({
        theme: "system",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: {
        timezone: "UTC",
        defaultView: "today",
        theme: "system",
      },
    });
    expect(repositoryMocks.updateSettings).toHaveBeenCalledWith({ kind: "db" }, currentUser.id, {
      theme: "system",
    });
  });

  it("rejects invalid settings theme values", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });

    const response = await request("/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: "dl_session=valid-session-token",
        origin: trustedOrigin,
      },
      body: JSON.stringify({
        theme: "sepia",
      }),
    });

    expect(response.status).toBe(400);
    expect(repositoryMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("rejects oauth callback when the google token signature is invalid", async () => {
    const signedToken = await createSignedGoogleIdToken();
    const invalidToken = `${signedToken.token.split(".").slice(0, 2).join(".")}.${base64UrlEncode(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    )}`;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({ id_token: invalidToken });
      }

      if (url === "https://www.googleapis.com/oauth2/v3/certs") {
        return Response.json(
          { keys: [signedToken.jwk] },
          {
            headers: {
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const response = await request("/auth/google/callback?code=test-code&state=test-state", {
      headers: {
        cookie: "dl_google_state=test-state; dl_google_verifier=test-verifier",
      },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Google トークンの署名検証に失敗しました。",
      },
    });
    expect(repositoryMocks.upsertGoogleUser).not.toHaveBeenCalled();
  });

  it("rejects invalid calendar month values with 400", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });

    const response = await request("/dashboard/bootstrap?month=2026-13&date=2026-04-28", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "month には実在する年月を指定してください。",
      },
    });
  });

  it("rejects invalid calendar date values with 400", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });

    const response = await request("/dashboard/bootstrap?month=2026-04&date=2026-02-31", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "date には実在する日付を指定してください。",
      },
    });
  });

  it("does not expose internal error messages", async () => {
    repositoryMocks.getCurrentUserBySessionHash.mockResolvedValue({
      user: currentUser,
      session,
    });
    repositoryMocks.listHabits.mockRejectedValue(new Error("secret stack detail"));

    const response = await request("/dashboard/today", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "予期しないエラーが発生しました。",
      },
    });
  });

  it("adds browser security headers to responses", async () => {
    const response = await request("/healthz");

    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("serves static assets through the worker with security headers", async () => {
    assetMocks.fetch.mockResolvedValue(
      new Response("<!doctype html><title>Daily Leveling</title>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=0, must-revalidate",
        },
      }),
    );

    const response = await request("/");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Daily Leveling");
    expect(assetMocks.fetch).toHaveBeenCalledTimes(1);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  });
});
