import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../api/context";
import { setSessionCookie } from "../../auth/session";
import {
  completeOnboarding,
  createSession,
  upsertGoogleUser,
} from "../../db/repositories";
import { getDefaultTimezone, getSessionCookieName, getSessionTtlSeconds } from "../../lib/config";
import { createOpaqueToken, sha256Base64Url } from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";

const e2eLoginSchema = z.object({
  onboardingCompleted: z.boolean().optional().default(false),
  testId: z.string().trim().min(1).max(80),
});

function assertE2eMode(env: Env): void {
  if (env.E2E_TEST_MODE !== "true") {
    throw new AppError(404, "NOT_FOUND", "指定されたルートは存在しません。");
  }
}

export const e2eRoutes = new Hono<AppEnv>();

e2eRoutes.post("/__e2e/login", async (c) => {
  assertE2eMode(c.env);

  const payload = e2eLoginSchema.parse(await c.req.json());
  const db = c.get("db");
  const googleSub = `e2e:${payload.testId}`;

  await db`
    DELETE FROM users
    WHERE google_sub = ${googleSub}
  `;

  const user = await upsertGoogleUser(
    db,
    {
      googleSub,
      email: `${payload.testId}@e2e.local`,
      displayName: "E2E Tester",
      avatarUrl: null,
    },
    getDefaultTimezone(c.env),
  );

  if (payload.onboardingCompleted) {
    await completeOnboarding(db, user.id);
  }

  const sessionToken = createOpaqueToken();
  const sessionHash = await sha256Base64Url(sessionToken);
  const expiresAt = new Date(Date.now() + getSessionTtlSeconds(c.env) * 1000);

  await createSession(db, user.id, sessionHash, expiresAt, {
    ipAddress: "127.0.0.1",
    userAgent: "playwright",
  });
  setSessionCookie(c, sessionToken, expiresAt);

  return jsonOk({
    session: {
      cookieName: getSessionCookieName(c.env),
      expiresAt: expiresAt.toISOString(),
      token: sessionToken,
    },
    userId: user.id,
  });
});

e2eRoutes.post("/__e2e/reset", async (c) => {
  assertE2eMode(c.env);

  const payload = e2eLoginSchema.pick({ testId: true }).parse(await c.req.json());

  await c.get("db")`
    DELETE FROM users
    WHERE google_sub = ${`e2e:${payload.testId}`}
  `;

  return jsonOk({ ok: true });
});
