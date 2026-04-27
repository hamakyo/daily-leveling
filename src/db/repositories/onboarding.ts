import type { TransactionSql } from "postgres";
import type { DatabaseClient } from "../client";
import type { HabitTemplate } from "../../domain/templates";
import type { HabitRecord } from "../../lib/types";
import { mapHabit, toWeekdayLiteral, type HabitRow } from "./rows";

export async function completeOnboarding(db: DatabaseClient, userId: string): Promise<void> {
  await db`
    UPDATE users
    SET onboarding_completed = true
    WHERE id = ${userId}
  `;
}

export async function createHabitsFromTemplate(
  db: DatabaseClient,
  userId: string,
  habits: HabitTemplate[],
): Promise<HabitRecord[]> {
  return db.begin(async (trx: TransactionSql) => {
    const nextOrderRows = await trx<{ next_order: number }[]>`
      SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
      FROM habits
      WHERE user_id = ${userId}
    `;
    let displayOrder = nextOrderRows[0].next_order;
    const createdHabits: HabitRecord[] = [];

    for (const habit of habits) {
      const weekdayLiteral = toWeekdayLiteral(habit.targetWeekdays);
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
          ${habit.name},
          ${habit.emoji},
          ${habit.color},
          ${habit.frequencyType},
          ${weekdayLiteral ? trx.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
          ${habit.intervalDays},
          true,
          ${displayOrder}
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
      createdHabits.push(mapHabit(rows[0]));
      displayOrder += 1;
    }

    return createdHabits;
  });
}
