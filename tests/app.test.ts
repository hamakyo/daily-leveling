import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, HabitRecord, SessionRecord } from "../src/lib/types";

const clientMocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ kind: "db" })),
}));

const repositoryMocks = vi.hoisted(() => ({
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
    fetch: async () => new Response("not found", { status: 404 }),
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

function makeHabit(overrides: Partial<HabitRecord> = {}): HabitRecord {
  return {
    id: habitId,
    userId: currentUser.id,
    name: "Read",
    emoji: "📚",
    color: "blue",
    frequencyType: "daily",
    targetWeekdays: null,
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

describe("worker app auth and log guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMocks.getDb.mockReturnValue({ kind: "db" });
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

    const response = await request("/auth/me", {
      headers: {
        cookie: "dl_session=valid-session-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: currentUser,
    });
    expect(repositoryMocks.touchSession).toHaveBeenCalledWith({ kind: "db" }, session.id);
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
});
