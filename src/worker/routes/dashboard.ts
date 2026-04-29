import { Hono } from "hono";
import { requireAuth } from "../../api/middleware";
import type { AppEnv } from "../../api/context";
import { countCompletedHabitLogs, listHabits, listLogsInRange } from "../../db/repositories";
import {
  buildMonthlyDashboard,
  buildTodayDashboard,
  buildWeeklyDashboard,
} from "../../domain/dashboard";
import { monthQuerySchema, weekQuerySchema } from "../../domain/validation";
import {
  assertIsoDate,
  assertIsoMonth,
  getMonthRange,
  getTodayInTimezone,
  getWeekRange,
} from "../../lib/date";
import { jsonOk } from "../../lib/http";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/dashboard/bootstrap", requireAuth, async (c) => {
  const db = c.get("db");
  const currentUser = c.get("currentUser");
  const query = monthQuerySchema.parse(c.req.query());
  const month = assertIsoMonth(query.month);
  const date = getTodayInTimezone(currentUser.timezone);
  const weekDate = c.req.query("date") ? assertIsoDate(c.req.query("date") as string) : date;
  const { startDate, endDate } = getMonthRange(month);
  const { startDate: weekStartDate, endDate: weekEndDate } = getWeekRange(weekDate);
  const [habits, logsToday, logsMonth, logsWeek, completedLogCount] = await Promise.all([
    listHabits(db, currentUser.id, { activeOnly: true }),
    listLogsInRange(db, currentUser.id, date, date),
    listLogsInRange(db, currentUser.id, startDate, endDate),
    listLogsInRange(db, currentUser.id, weekStartDate, weekEndDate),
    countCompletedHabitLogs(db, currentUser.id),
  ]);

  return jsonOk({
    today: buildTodayDashboard(habits, logsToday, currentUser.timezone, completedLogCount),
    weekly: buildWeeklyDashboard(habits, logsWeek, weekDate, currentUser.timezone),
    monthly: buildMonthlyDashboard(habits, logsMonth, month, currentUser.timezone),
    habits,
    settings: {
      timezone: currentUser.timezone,
      defaultView: currentUser.defaultView,
      theme: currentUser.theme,
    },
  });
});

dashboardRoutes.get("/dashboard/today", requireAuth, async (c) => {
  const db = c.get("db");
  const currentUser = c.get("currentUser");
  const date = getTodayInTimezone(currentUser.timezone);
  const [habits, logs, completedLogCount] = await Promise.all([
    listHabits(db, currentUser.id, { activeOnly: true }),
    listLogsInRange(db, currentUser.id, date, date),
    countCompletedHabitLogs(db, currentUser.id),
  ]);

  return jsonOk(buildTodayDashboard(habits, logs, currentUser.timezone, completedLogCount));
});

dashboardRoutes.get("/dashboard/weekly", requireAuth, async (c) => {
  const db = c.get("db");
  const currentUser = c.get("currentUser");
  const query = weekQuerySchema.parse(c.req.query());
  const date = assertIsoDate(query.date);
  const { startDate, endDate } = getWeekRange(date);
  const habits = await listHabits(db, currentUser.id, { activeOnly: true });
  const logs = await listLogsInRange(db, currentUser.id, startDate, endDate);

  return jsonOk(buildWeeklyDashboard(habits, logs, date, currentUser.timezone));
});

dashboardRoutes.get("/dashboard/monthly", requireAuth, async (c) => {
  const db = c.get("db");
  const currentUser = c.get("currentUser");
  const query = monthQuerySchema.parse(c.req.query());
  const month = assertIsoMonth(query.month);
  const { startDate, endDate } = getMonthRange(month);
  const habits = await listHabits(db, currentUser.id, { activeOnly: true });
  const logs = await listLogsInRange(db, currentUser.id, startDate, endDate);

  return jsonOk(buildMonthlyDashboard(habits, logs, month, currentUser.timezone));
});
