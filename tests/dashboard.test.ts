import { describe, expect, it } from "vitest";
import {
  buildMonthlyDashboard,
  buildTodayDashboard,
  calculateLevelProgress,
  calculateCurrentStreak,
  calculateProgressRate,
  isHabitTargetDay,
} from "../src/domain/dashboard";
import type { HabitLogRecord, HabitRecord } from "../src/lib/types";

const baseHabit: HabitRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Reading",
  emoji: "📚",
  color: "blue",
  frequencyType: "daily",
  targetWeekdays: null,
  intervalDays: null,
  isActive: true,
  displayOrder: 0,
  createdAt: "2026-04-20T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
};

function makeLog(date: string, status: boolean): HabitLogRecord {
  return {
    id: crypto.randomUUID(),
    userId: baseHabit.userId,
    habitId: baseHabit.id,
    date,
    status,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function shiftIsoDate(date: string, deltaDays: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next.toISOString().slice(0, 10);
}

describe("dashboard helpers", () => {
  it("computes progress rate with one decimal place", () => {
    expect(calculateProgressRate(7, 10)).toBe(70);
    expect(calculateProgressRate(12, 17)).toBe(70.6);
  });

  it("marks only configured weekdays as targets for weekly habits", () => {
    const weeklyHabit: HabitRecord = {
      ...baseHabit,
      frequencyType: "weekly_days",
      targetWeekdays: [1, 3, 5],
    };

    expect(isHabitTargetDay(weeklyHabit, "2026-04-20")).toBe(true);
    expect(isHabitTargetDay(weeklyHabit, "2026-04-21")).toBe(false);
  });

  it("marks every_n_days habits from the created day anchor", () => {
    const intervalHabit: HabitRecord = {
      ...baseHabit,
      name: "Laundry",
      frequencyType: "every_n_days",
      targetWeekdays: null,
      intervalDays: 3,
      createdAt: "2026-04-20T08:00:00.000Z",
      updatedAt: "2026-04-20T08:00:00.000Z",
    };

    expect(isHabitTargetDay(intervalHabit, "2026-04-20")).toBe(true);
    expect(isHabitTargetDay(intervalHabit, "2026-04-21")).toBe(false);
    expect(isHabitTargetDay(intervalHabit, "2026-04-23")).toBe(true);
    expect(isHabitTargetDay(intervalHabit, "2026-04-19")).toBe(false);
  });

  it("builds monthly stats using target days only", () => {
    const aprilStartHabit: HabitRecord = {
      ...baseHabit,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    const monthly = buildMonthlyDashboard(
      [
        aprilStartHabit,
        {
          ...aprilStartHabit,
          id: "22222222-2222-2222-2222-222222222222",
          name: "Workout",
          frequencyType: "weekly_days",
          targetWeekdays: [1, 3, 5],
          displayOrder: 1,
        },
      ],
      [
        makeLog("2026-04-01", true),
        {
          ...makeLog("2026-04-02", true),
          habitId: "22222222-2222-2222-2222-222222222222",
        },
      ],
      "2026-04",
      "UTC",
    );

    expect(monthly.habits).toHaveLength(2);
    expect(monthly.summary.targetCount).toBeGreaterThan(0);
    expect(monthly.dailyStats.find((day) => day.date === "2026-04-01")?.completedCount).toBe(1);
  });

  it("builds level progress from completed logs", () => {
    expect(calculateLevelProgress(0)).toMatchObject({
      level: 1,
      totalXp: 0,
      xpIntoLevel: 0,
      xpToNextLevel: 100,
    });

    expect(calculateLevelProgress(15)).toMatchObject({
      level: 2,
      totalXp: 150,
      xpIntoLevel: 50,
      xpToNextLevel: 50,
      progressRate: 50,
    });
  });

  it("includes level progress in today dashboard", () => {
    const today = buildTodayDashboard([baseHabit], [makeLog("2026-04-27", true)], "UTC", 11);

    expect(today.level).toMatchObject({
      level: 2,
      completedCount: 11,
      totalXp: 110,
    });
  });

  it("counts a streak only while all target habits are completed", () => {
    const today = new Date().toISOString().slice(0, 10);
    const streak = calculateCurrentStreak(
      [baseHabit],
      [makeLog(shiftIsoDate(today, -2), true), makeLog(shiftIsoDate(today, -1), true), makeLog(today, true)],
      "UTC",
      10,
    );

    expect(streak).toBeGreaterThanOrEqual(1);
  });

  it("excludes archived habits from monthly aggregates", () => {
    const archivedHabit: HabitRecord = {
      ...baseHabit,
      id: "33333333-3333-3333-3333-333333333333",
      name: "Archived",
      isActive: false,
      displayOrder: 1,
    };

    const monthly = buildMonthlyDashboard(
      [baseHabit, archivedHabit],
      [
        makeLog("2026-04-01", true),
        {
          ...makeLog("2026-04-01", true),
          habitId: archivedHabit.id,
        },
      ],
      "2026-04",
      "UTC",
    );

    expect(monthly.habits.map((habit) => habit.habitId)).toEqual([baseHabit.id]);
    expect(monthly.logs.some((log) => log.habitId === archivedHabit.id)).toBe(true);
    expect(monthly.habitStats.some((habit) => habit.habitId === archivedHabit.id)).toBe(false);
  });
});
