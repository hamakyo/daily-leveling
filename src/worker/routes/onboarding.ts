import { Hono } from "hono";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import { getDb } from "../../db/client";
import {
  completeOnboarding,
  createHabitsFromTemplate,
} from "../../db/repositories";
import { isTemplateId, templates } from "../../domain/templates";
import {
  onboardingCompleteSchema,
  onboardingTemplateSchema,
} from "../../domain/validation";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";
import { parseBody } from "./helpers";

export const onboardingRoutes = new Hono<AppEnv>();

onboardingRoutes.post("/onboarding/templates/apply", requireAuth, async (c) => {
  const payload = parseBody(onboardingTemplateSchema, await c.req.json());
  if (!isTemplateId(payload.templateId)) {
    throw new AppError(400, "INVALID_INPUT", "templateId が不正です。");
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

onboardingRoutes.post("/onboarding/complete", requireAuth, async (c) => {
  parseBody(onboardingCompleteSchema, await c.req.json());
  await completeOnboarding(getDb(c.env), c.get("currentUser").id);
  return jsonOk({ ok: true });
});
