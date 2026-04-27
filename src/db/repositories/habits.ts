import type { TransactionSql } from "postgres";
import type { z } from "zod";
import type { DatabaseClient } from "../client";
import type { HabitRecord } from "../../lib/types";
import type { habitCreateSchema, habitUpdateSchema } from "../../domain/validation";
import { mapHabit, toWeekdayLiteral, type HabitRow } from "./rows";

export async function listHabits(
  db: DatabaseClient,
  userId: string,
  options: { activeOnly?: boolean } = {},
): Promise<HabitRecord[]> {
  const rows = await db<HabitRow[]>`
    SELECT
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      interval_days,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM habits
    WHERE user_id = ${userId}
      AND (${options.activeOnly ?? false} = false OR is_active = true)
    ORDER BY display_order ASC
  `;

  return rows.map(mapHabit);
}

export async function getHabitById(
  db: DatabaseClient,
  userId: string,
  habitId: string,
): Promise<HabitRecord | null> {
  const rows = await db<HabitRow[]>`
    SELECT
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      interval_days,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM habits
    WHERE id = ${habitId}
      AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? mapHabit(rows[0]) : null;
}

export async function createHabit(
  db: DatabaseClient,
  userId: string,
  input: z.infer<typeof habitCreateSchema>,
): Promise<HabitRecord> {
  return db.begin(async (trx: TransactionSql) => {
    const nextOrderRows = await trx<{ next_order: number }[]>`
      SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
      FROM habits
      WHERE user_id = ${userId}
    `;
    const nextOrder = nextOrderRows[0].next_order;
    const weekdayLiteral = toWeekdayLiteral(input.targetWeekdays ?? null);
    const rows = await trx<HabitRow[]>`
      INSERT INTO habits (
        user_id,
        name,
        emoji,
        color,
        frequency_type,
        target_weekdays,
        interval_days,
        is_active,
        display_order
      )
      VALUES (
        ${userId},
        ${input.name},
        ${input.emoji ?? null},
        ${input.color ?? null},
        ${input.frequencyType},
        ${weekdayLiteral ? trx.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
        ${input.intervalDays ?? null},
        true,
        ${nextOrder}
      )
      RETURNING
        id,
        user_id,
        name,
        emoji,
        color,
        frequency_type,
        target_weekdays,
        interval_days,
        is_active,
        display_order,
        created_at,
        updated_at
    `;

    return mapHabit(rows[0]);
  });
}

export async function updateHabit(
  db: DatabaseClient,
  userId: string,
  habitId: string,
  input: z.infer<typeof habitUpdateSchema>,
): Promise<HabitRecord | null> {
  const currentHabit = await getHabitById(db, userId, habitId);
  if (!currentHabit) {
    return null;
  }

  const nextHabit = {
    name: input.name ?? currentHabit.name,
    emoji: input.emoji === undefined ? currentHabit.emoji : input.emoji,
    color: input.color === undefined ? currentHabit.color : input.color,
    frequencyType: input.frequencyType ?? currentHabit.frequencyType,
    isActive: input.isActive ?? currentHabit.isActive,
  };

  const nextTargetWeekdays =
    nextHabit.frequencyType === "weekly_days"
      ? input.targetWeekdays === undefined
        ? currentHabit.targetWeekdays
        : input.targetWeekdays
      : null;

  const nextIntervalDays =
    nextHabit.frequencyType === "every_n_days"
      ? input.intervalDays === undefined
        ? currentHabit.intervalDays
        : input.intervalDays
      : null;

  const weekdayLiteral = toWeekdayLiteral(nextTargetWeekdays ?? null);

  const rows = await db<HabitRow[]>`
    UPDATE habits
    SET
      name = ${nextHabit.name},
      emoji = ${nextHabit.emoji},
      color = ${nextHabit.color},
      frequency_type = ${nextHabit.frequencyType},
      target_weekdays = ${weekdayLiteral ? db.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
      interval_days = ${nextIntervalDays},
      is_active = ${nextHabit.isActive}
    WHERE id = ${habitId}
      AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      interval_days,
      is_active,
      display_order,
      created_at,
      updated_at
  `;

  return rows[0] ? mapHabit(rows[0]) : null;
}

export async function reorderHabits(
  db: DatabaseClient,
  userId: string,
  habitIds: string[],
): Promise<boolean> {
  const existingHabits = await listHabits(db, userId);
  const existingIds = new Set(existingHabits.map((habit) => habit.id));

  if (!habitIds.every((habitId) => existingIds.has(habitId))) {
    return false;
  }

  await db.begin(async (trx: TransactionSql) => {
    for (const [index, habitId] of habitIds.entries()) {
      await trx`
        UPDATE habits
        SET display_order = ${index}
        WHERE id = ${habitId}
          AND user_id = ${userId}
      `;
    }
  });

  return true;
}
