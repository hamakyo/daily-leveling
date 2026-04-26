import type { DatabaseClient } from "../client";
import type { HabitLogRecord } from "../../lib/types";
import { mapLog, type HabitLogRow } from "./rows";

export async function listLogsInRange(
  db: DatabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<HabitLogRecord[]> {
  const rows = await db<HabitLogRow[]>`
    SELECT
      id,
      user_id,
      habit_id,
      log_date,
      status,
      created_at,
      updated_at
    FROM habit_logs
    WHERE user_id = ${userId}
      AND log_date BETWEEN ${from} AND ${to}
    ORDER BY log_date ASC, habit_id ASC
  `;

  return rows.map(mapLog);
}

export async function upsertHabitLog(
  db: DatabaseClient,
  userId: string,
  habitId: string,
  date: string,
  status: boolean,
): Promise<HabitLogRecord> {
  const rows = await db<HabitLogRow[]>`
    INSERT INTO habit_logs (
      user_id,
      habit_id,
      log_date,
      status
    )
    VALUES (
      ${userId},
      ${habitId},
      ${date},
      ${status}
    )
    ON CONFLICT (user_id, habit_id, log_date)
    DO UPDATE SET
      status = EXCLUDED.status
    RETURNING
      id,
      user_id,
      habit_id,
      log_date,
      status,
      created_at,
      updated_at
  `;

  return mapLog(rows[0]);
}
