import { Hono } from "hono";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import {
  createHabit,
  getHabitById,
  listHabits,
  reorderHabits,
  updateHabit,
} from "../../db/repositories";
import {
  activeOnlyQuerySchema,
  habitCreateSchema,
  habitUpdateSchema,
  reorderHabitsSchema,
} from "../../domain/validation";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";
import { parseBody, pathUuidSchema } from "./helpers";

export const habitRoutes = new Hono<AppEnv>();

habitRoutes.get("/habits", requireAuth, async (c) => {
  const query = activeOnlyQuerySchema.parse(c.req.query());
  const habits = await listHabits(c.get("db"), c.get("currentUser").id, {
    activeOnly: query.activeOnly === "true",
  });
  return jsonOk({ habits });
});

habitRoutes.post("/habits", requireAuth, async (c) => {
  const payload = parseBody(habitCreateSchema, await c.req.json());
  const habit = await createHabit(c.get("db"), c.get("currentUser").id, payload);
  return jsonOk({ habit }, 201);
});

habitRoutes.patch("/habits/:habitId", requireAuth, async (c) => {
  const habitId = pathUuidSchema.parse(c.req.param("habitId"));
  const db = c.get("db");
  const currentHabit = await getHabitById(db, c.get("currentUser").id, habitId);

  if (!currentHabit) {
    throw new AppError(404, "NOT_FOUND", "習慣が見つかりません。");
  }

  const partialPayload = parseBody(habitUpdateSchema, await c.req.json());
  const nextFrequencyType = partialPayload.frequencyType ?? currentHabit.frequencyType;
  const mergedPayload = {
    name: partialPayload.name ?? currentHabit.name,
    emoji: partialPayload.emoji === undefined ? currentHabit.emoji : partialPayload.emoji,
    color: partialPayload.color === undefined ? currentHabit.color : partialPayload.color,
    frequencyType: nextFrequencyType,
    targetWeekdays:
      nextFrequencyType === "weekly_days"
        ? partialPayload.targetWeekdays === undefined
          ? currentHabit.targetWeekdays
          : partialPayload.targetWeekdays
        : null,
    intervalDays:
      nextFrequencyType === "every_n_days"
        ? partialPayload.intervalDays === undefined
          ? currentHabit.intervalDays
          : partialPayload.intervalDays
        : null,
  };
  habitCreateSchema.parse(mergedPayload);

  const habit = await updateHabit(db, c.get("currentUser").id, habitId, partialPayload);
  if (!habit) {
    throw new AppError(404, "NOT_FOUND", "習慣が見つかりません。");
  }

  return jsonOk({ habit });
});

habitRoutes.post("/habits/reorder", requireAuth, async (c) => {
  const payload = parseBody(reorderHabitsSchema, await c.req.json());
  const ok = await reorderHabits(c.get("db"), c.get("currentUser").id, payload.habitIds);

  if (!ok) {
    throw new AppError(400, "INVALID_INPUT", "habitIds は現在のユーザーの習慣のみ指定できます。");
  }

  return jsonOk({ ok: true });
});
