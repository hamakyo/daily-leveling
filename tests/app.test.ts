import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, HabitRecord, SessionRecord } from "../src/lib/types";

const assetMocks = vi.hoisted(() => ({
  fetch: vi.fn(async () => new Response("not found", { status: 404 })),
}));

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

async function request(path: string, init?: RequestInit) {
  return app.request(`http://localhost${path}`, init, env);
}

function makeExecutionContext() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as NonNullable<Parameters<typeof app.request>[3]>;
}

describe("worker app auth and log guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assetMocks.fetch.mockResolvedValue(new Response("not found", { status: 404 }));
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
