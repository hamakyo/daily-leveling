import { Hono } from "hono";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import { getDb } from "../../db/client";
import {
  getHabitById,
  listLogsInRange,
  upsertHabitLog,
} from "../../db/repositories";
import { isHabitTargetDay } from "../../domain/dashboard";
import { logBodySchema, logsRangeQuerySchema } from "../../domain/validation";
import {
  assertIsoDate,
  compareIsoDates,
  enumerateDates,
  getTodayInTimezone,
} from "../../lib/date";
import { AppError } from "../../lib/errors";
import { jsonOk } from "../../lib/http";
import { parseBody, pathUuidSchema } from "./helpers";

export const logRoutes = new Hono<AppEnv>();

logRoutes.get("/logs", requireAuth, async (c) => {
  const query = logsRangeQuerySchema.parse(c.req.query());
  const from = assertIsoDate(query.from, "from");
  const to = assertIsoDate(query.to, "to");
  const days = enumerateDates(from, to);

  if (days.length > 62) {
    throw new AppError(400, "INVALID_INPUT", "取得期間は 62 日以内で指定してください。");
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

logRoutes.put("/habits/:habitId/logs/:date", requireAuth, async (c) => {
  const habitId = pathUuidSchema.parse(c.req.param("habitId"));
  const date = assertIsoDate(c.req.param("date"));
  const payload = parseBody(logBodySchema, await c.req.json());
  const db = getDb(c.env);
  const currentUser = c.get("currentUser");
  const habit = await getHabitById(db, currentUser.id, habitId);

  if (!habit) {
    throw new AppError(404, "NOT_FOUND", "習慣が見つかりません。");
  }

  if (compareIsoDates(date, getTodayInTimezone(currentUser.timezone)) > 0) {
    throw new AppError(400, "INVALID_DATE", "未来日の記録はできません。");
  }

  if (!isHabitTargetDay(habit, date)) {
    throw new AppError(400, "INVALID_DATE", "その日はこの習慣の対象日ではありません。");
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
