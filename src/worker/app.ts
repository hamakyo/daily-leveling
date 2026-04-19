import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { z, ZodError } from "zod";
import { requireAuth } from "../api/middleware";
import type { AppEnv } from "../api/context";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  createGoogleAuthorizationRequest,
  exchangeAuthorizationCode,
  verifyGoogleIdToken,
} from "../auth/google";
import { clearSessionCookie, setSessionCookie } from "../auth/session";
import { getDb } from "../db/client";
import {
  completeOnboarding,
  createHabit,
  createHabitsFromTemplate,
  createSession,
  getCurrentUserById,
  getHabitById,
  getSettings,
  listHabits,
  listLogsInRange,
  reorderHabits,
  revokeSession,
  updateHabit,
  updateSettings,
  upsertGoogleUser,
  upsertHabitLog,
} from "../db/repositories";
import {
  buildMonthlyDashboard,
  buildTodayDashboard,
  buildWeeklyDashboard,
  isHabitTargetDay,
} from "../domain/dashboard";
import { isTemplateId, templates } from "../domain/templates";
import {
  activeOnlyQuerySchema,
  habitCreateSchema,
  habitUpdateSchema,
  logBodySchema,
  logsRangeQuerySchema,
  monthQuerySchema,
  onboardingCompleteSchema,
  onboardingTemplateSchema,
  reorderHabitsSchema,
  settingsSchema,
  weekQuerySchema,
} from "../domain/validation";
import { getDefaultTimezone, getSessionTtlSeconds, isSecureCookie } from "../lib/config";
import { createOpaqueToken, sha256Base64Url } from "../lib/crypto";
import {
  assertIsoDate,
  assertIsoMonth,
  compareIsoDates,
  enumerateDates,
  getMonthRange,
  getTodayInTimezone,
  getWeekRange,
  isValidTimezone,
} from "../lib/date";
import { AppError } from "../lib/errors";
import { jsonError, jsonOk, normalizeError } from "../lib/http";

const pathUuidSchema = z.string().uuid();

function getOAuthCookieOptions(env: Env) {
  return {
    httpOnly: true,
    path: "/auth/google",
    sameSite: "Lax" as const,
    secure: isSecureCookie(env.APP_BASE_URL),
    maxAge: 60 * 10,
  };
}

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

function getClientMetadata(request: Request) {
  return {
    ipAddress: request.headers.get("CF-Connecting-IP"),
    userAgent: request.headers.get("user-agent"),
  };
}

export const app = new Hono<AppEnv>();

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return jsonError(new AppError(400, "INVALID_INPUT", error.issues[0]?.message || "Invalid input."));
  }

  return jsonError(normalizeError(error));
});

app.notFound(() => jsonError(new AppError(404, "NOT_FOUND", "Route not found.")));

app.get("/healthz", () =>
  jsonOk({
    ok: true,
    service: "daily-leveling",
  }),
);

app.get("/auth/google/start", async (c) => {
  const { authorizationUrl, state, codeVerifier } = await createGoogleAuthorizationRequest(c.env);
  const cookieOptions = getOAuthCookieOptions(c.env);

  setCookie(c, GOOGLE_STATE_COOKIE, state, cookieOptions);
  setCookie(c, GOOGLE_VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return c.redirect(authorizationUrl, 302);
});

app.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, GOOGLE_STATE_COOKIE);
  const codeVerifier = getCookie(c, GOOGLE_VERIFIER_COOKIE);

  if (!code || !state) {
    throw new AppError(401, "UNAUTHORIZED", "Missing OAuth callback parameters.");
  }

  if (!expectedState || !codeVerifier || state !== expectedState) {
    throw new AppError(401, "UNAUTHORIZED", "OAuth state validation failed.");
  }

  const tokens = await exchangeAuthorizationCode(c.env, code, codeVerifier);
  const identity = await verifyGoogleIdToken(c.env, tokens.idToken);
  const db = getDb(c.env);
  const user = await upsertGoogleUser(db, identity, getDefaultTimezone(c.env));
  const sessionToken = createOpaqueToken();
  const sessionHash = await sha256Base64Url(sessionToken);
  const expiresAt = new Date(Date.now() + getSessionTtlSeconds(c.env) * 1000);

  await createSession(db, user.id, sessionHash, expiresAt, getClientMetadata(c.req.raw));

  deleteCookie(c, GOOGLE_STATE_COOKIE, getOAuthCookieOptions(c.env));
  deleteCookie(c, GOOGLE_VERIFIER_COOKIE, getOAuthCookieOptions(c.env));
  setSessionCookie(c, sessionToken, expiresAt);

  const redirectPath = user.onboardingCompleted ? "/dashboard" : "/onboarding";
  return c.redirect(new URL(redirectPath, c.env.APP_BASE_URL).toString(), 302);
});

app.get("/auth/me", requireAuth, async (c) => {
  return jsonOk({
    user: c.get("currentUser"),
  });
});

app.post("/auth/logout", requireAuth, async (c) => {
  const db = getDb(c.env);
  await revokeSession(db, c.get("session").id);
  clearSessionCookie(c);
  return jsonOk({ ok: true });
});

app.post("/onboarding/templates/apply", requireAuth, async (c) => {
  const payload = parseBody(onboardingTemplateSchema, await c.req.json());
  if (!isTemplateId(payload.templateId)) {
    throw new AppError(400, "INVALID_INPUT", "Unknown templateId.");
  }

  const createdHabits = await createHabitsFromTemplate(
    getDb(c.env),
    c.get("currentUser").id,
    templates[payload.templateId],
  );

  return jsonOk(
    {
      createdHabits: createdHabits.map((habit) => ({
        id: habit.id,
        name: habit.name,
      })),
    },
    201,
  );
});

app.post("/onboarding/complete", requireAuth, async (c) => {
  parseBody(onboardingCompleteSchema, await c.req.json());
  await completeOnboarding(getDb(c.env), c.get("currentUser").id);
  return jsonOk({ ok: true });
});

app.get("/habits", requireAuth, async (c) => {
  const query = activeOnlyQuerySchema.parse(c.req.query());
  const habits = await listHabits(getDb(c.env), c.get("currentUser").id, {
    activeOnly: query.activeOnly === "true",
  });
  return jsonOk({ habits });
});

app.post("/habits", requireAuth, async (c) => {
  const payload = parseBody(habitCreateSchema, await c.req.json());
  const habit = await createHabit(getDb(c.env), c.get("currentUser").id, payload);
  return jsonOk({ habit }, 201);
});

app.patch("/habits/:habitId", requireAuth, async (c) => {
  const habitId = pathUuidSchema.parse(c.req.param("habitId"));
  const db = getDb(c.env);
  const currentHabit = await getHabitById(db, c.get("currentUser").id, habitId);

  if (!currentHabit) {
    throw new AppError(404, "NOT_FOUND", "Habit not found.");
  }

  const partialPayload = parseBody(habitUpdateSchema, await c.req.json());
  const mergedPayload = {
    name: partialPayload.name ?? currentHabit.name,
    emoji: partialPayload.emoji === undefined ? currentHabit.emoji : partialPayload.emoji,
    color: partialPayload.color === undefined ? currentHabit.color : partialPayload.color,
    frequencyType: partialPayload.frequencyType ?? currentHabit.frequencyType,
    targetWeekdays:
      partialPayload.frequencyType === "daily"
        ? null
        : partialPayload.targetWeekdays === undefined
          ? currentHabit.targetWeekdays
          : partialPayload.targetWeekdays,
  };
  habitCreateSchema.parse(mergedPayload);

  const habit = await updateHabit(db, c.get("currentUser").id, habitId, partialPayload);
  if (!habit) {
    throw new AppError(404, "NOT_FOUND", "Habit not found.");
  }

  return jsonOk({ habit });
});

app.post("/habits/reorder", requireAuth, async (c) => {
  const payload = parseBody(reorderHabitsSchema, await c.req.json());
  const ok = await reorderHabits(getDb(c.env), c.get("currentUser").id, payload.habitIds);

  if (!ok) {
    throw new AppError(400, "INVALID_INPUT", "habitIds must belong to the current user.");
  }

  return jsonOk({ ok: true });
});

app.get("/logs", requireAuth, async (c) => {
  const query = logsRangeQuerySchema.parse(c.req.query());
  const from = assertIsoDate(query.from, "from");
  const to = assertIsoDate(query.to, "to");
  const days = enumerateDates(from, to);

  if (days.length > 62) {
    throw new AppError(400, "INVALID_INPUT", "Range cannot exceed 62 days.");
  }

  const logs = await listLogsInRange(getDb(c.env), c.get("currentUser").id, from, to);
  return jsonOk({
    logs: logs.map((log) => ({
      habitId: log.habitId,
      date: log.date,
      status: log.status,
    })),
  });
});

app.put("/habits/:habitId/logs/:date", requireAuth, async (c) => {
  const habitId = pathUuidSchema.parse(c.req.param("habitId"));
  const date = assertIsoDate(c.req.param("date"));
  const payload = parseBody(logBodySchema, await c.req.json());
  const db = getDb(c.env);
  const currentUser = c.get("currentUser");
  const habit = await getHabitById(db, currentUser.id, habitId);

  if (!habit) {
    throw new AppError(404, "NOT_FOUND", "Habit not found.");
  }

  if (compareIsoDates(date, getTodayInTimezone(currentUser.timezone)) > 0) {
    throw new AppError(400, "INVALID_DATE", "Future dates are not allowed.");
  }

  if (!isHabitTargetDay(habit, date)) {
    throw new AppError(400, "INVALID_DATE", "The habit is not scheduled for that day.");
  }

  const log = await upsertHabitLog(db, currentUser.id, habitId, date, payload.status);
  return jsonOk({
    log: {
      habitId: log.habitId,
      date: log.date,
      status: log.status,
    },
  });
});

app.get("/dashboard/today", requireAuth, async (c) => {
  const db = getDb(c.env);
  const currentUser = c.get("currentUser");
  const date = getTodayInTimezone(currentUser.timezone);
  const habits = await listHabits(db, currentUser.id, { activeOnly: true });
  const logs = await listLogsInRange(db, currentUser.id, date, date);

  return jsonOk(buildTodayDashboard(habits, logs, currentUser.timezone));
});

app.get("/dashboard/weekly", requireAuth, async (c) => {
  const db = getDb(c.env);
  const currentUser = c.get("currentUser");
  const query = weekQuerySchema.parse(c.req.query());
  const date = assertIsoDate(query.date);
  const { startDate, endDate } = getWeekRange(date);
  const habits = await listHabits(db, currentUser.id, { activeOnly: true });
  const logs = await listLogsInRange(db, currentUser.id, startDate, endDate);

  return jsonOk(buildWeeklyDashboard(habits, logs, date, currentUser.timezone));
});

app.get("/dashboard/monthly", requireAuth, async (c) => {
  const db = getDb(c.env);
  const currentUser = c.get("currentUser");
  const query = monthQuerySchema.parse(c.req.query());
  const month = assertIsoMonth(query.month);
  const { startDate, endDate } = getMonthRange(month);
  const habits = await listHabits(db, currentUser.id, { activeOnly: true });
  const logs = await listLogsInRange(db, currentUser.id, startDate, endDate);

  return jsonOk(buildMonthlyDashboard(habits, logs, month, currentUser.timezone));
});

app.get("/settings", requireAuth, async (c) => {
  const settings = await getSettings(getDb(c.env), c.get("currentUser").id);
  if (!settings) {
    throw new AppError(404, "NOT_FOUND", "Settings not found.");
  }

  return jsonOk({ settings });
});

app.patch("/settings", requireAuth, async (c) => {
  const payload = parseBody(settingsSchema, await c.req.json());
  if (payload.timezone && !isValidTimezone(payload.timezone)) {
    throw new AppError(400, "INVALID_INPUT", "timezone must be a valid IANA timezone.");
  }

  const settings = await updateSettings(getDb(c.env), c.get("currentUser").id, payload);
  if (!settings) {
    throw new AppError(404, "NOT_FOUND", "Settings not found.");
  }

  const refreshedUser = await getCurrentUserById(getDb(c.env), c.get("currentUser").id);
  if (refreshedUser) {
    c.set("currentUser", refreshedUser);
  }

  return jsonOk({ settings });
});
