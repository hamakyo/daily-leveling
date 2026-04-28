import type {
  HabitRecord,
  HabitStat,
  HabitLogRecord,
  LevelProgress,
  MonthlyDashboard,
  TodayDashboard,
  WeeklyDashboard,
} from "../lib/types";
import {
  clampRangeEndToToday,
  compareIsoDates,
  diffIsoDays,
  enumerateDates,
  formatDateInTimezone,
  getMonthRange,
  getTodayInTimezone,
  getWeekRange,
  getWeekdayFromIsoDate,
} from "../lib/date";

const XP_PER_COMPLETION = 10;
const XP_PER_LEVEL = 100;

function createLogKey(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}

function createLogLookup(logs: HabitLogRecord[]): Map<string, HabitLogRecord> {
  return new Map(logs.map((log) => [createLogKey(log.habitId, log.date), log]));
}

export function calculateProgressRate(completedCount: number, targetCount: number): number {
  if (targetCount === 0) {
    return 0;
  }

  return Math.round((completedCount / targetCount) * 1000) / 10;
}

export function calculateLevelProgress(completedCount: number): LevelProgress {
  const totalXp = completedCount * XP_PER_COMPLETION;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;

  return {
    level,
    completedCount,
    totalXp,
    xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    xpToNextLevel: XP_PER_LEVEL - xpIntoLevel,
    progressRate: calculateProgressRate(xpIntoLevel, XP_PER_LEVEL),
  };
}

function getHabitStartDate(habit: HabitRecord, timezone: string): string {
  return formatDateInTimezone(new Date(habit.createdAt), timezone);
}

export function isHabitTargetDay(habit: HabitRecord, date: string, timezone = "UTC"): boolean {
  if (!habit.isActive) {
    return false;
  }

  const habitStartDate = getHabitStartDate(habit, timezone);
  if (compareIsoDates(date, habitStartDate) < 0) {
    return false;
  }

  if (habit.frequencyType === "daily") {
    return true;
  }

  if (habit.frequencyType === "every_n_days") {
    return habit.intervalDays != null && diffIsoDays(habitStartDate, date) % habit.intervalDays === 0;
  }

  const weekday = getWeekdayFromIsoDate(date);
  return habit.targetWeekdays?.includes(weekday) ?? false;
}

function buildDayStat(
  habits: HabitRecord[],
  logLookup: Map<string, HabitLogRecord>,
  date: string,
  timezone: string,
) {
  let completedCount = 0;
  let targetCount = 0;

  for (const habit of habits) {
    if (!isHabitTargetDay(habit, date, timezone)) {
      continue;
    }

    targetCount += 1;
    if (logLookup.get(createLogKey(habit.id, date))?.status === true) {
      completedCount += 1;
    }
  }

  return {
    date,
    completedCount,
    targetCount,
    progressRate: calculateProgressRate(completedCount, targetCount),
  };
}

function buildHabitStat(
  habit: HabitRecord,
  dates: string[],
  logLookup: Map<string, HabitLogRecord>,
  timezone: string,
): HabitStat {
  let completedCount = 0;
  let targetCount = 0;

  for (const date of dates) {
    if (!isHabitTargetDay(habit, date, timezone)) {
      continue;
    }

    targetCount += 1;
    if (logLookup.get(createLogKey(habit.id, date))?.status === true) {
      completedCount += 1;
    }
  }

  return {
    habitId: habit.id,
    name: habit.name,
    completedCount,
    targetCount,
    progressRate: calculateProgressRate(completedCount, targetCount),
  };
}

export function calculateCurrentStreak(
  habits: HabitRecord[],
  logs: HabitLogRecord[],
  timezone: string,
  lookbackDays = 365,
): number {
  const activeHabits = habits.filter((habit) => habit.isActive);
  if (activeHabits.length === 0) {
    return 0;
  }

  const today = getTodayInTimezone(timezone);
  const allDates = enumerateDates(
    new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    today,
  );
  const logLookup = createLogLookup(logs);

  let streak = 0;

  for (let index = allDates.length - 1; index >= 0; index -= 1) {
    const date = allDates[index];
    const stat = buildDayStat(activeHabits, logLookup, date, timezone);

    if (stat.targetCount === 0) {
      continue;
    }

    if (stat.completedCount !== stat.targetCount) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function buildTodayDashboard(
  habits: HabitRecord[],
  logs: HabitLogRecord[],
  timezone: string,
  completedLogCount: number,
): TodayDashboard {
  const date = getTodayInTimezone(timezone);
  const activeHabits = habits.filter((habit) => habit.isActive).sort((left, right) => left.displayOrder - right.displayOrder);
  const logLookup = createLogLookup(logs);

  const habitEntries = activeHabits.map((habit) => {
    const isTargetDay = isHabitTargetDay(habit, date, timezone);

    return {
      habitId: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      color: habit.color,
      status: logLookup.get(createLogKey(habit.id, date))?.status ?? null,
      isTargetDay,
      frequencyType: habit.frequencyType,
      intervalDays: habit.intervalDays,
    };
  });

  const summary = buildDayStat(activeHabits, logLookup, date, timezone);

  return {
    date,
    level: calculateLevelProgress(completedLogCount),
    summary: {
      completedCount: summary.completedCount,
      targetCount: summary.targetCount,
      progressRate: summary.progressRate,
    },
    habits: habitEntries,
  };
}

export function buildMonthlyDashboard(
  habits: HabitRecord[],
  logs: HabitLogRecord[],
  month: string,
  timezone: string,
): MonthlyDashboard {
  const activeHabits = habits.filter((habit) => habit.isActive).sort((left, right) => left.displayOrder - right.displayOrder);
  const { startDate, endDate } = getMonthRange(month);
  const effectiveRange = clampRangeEndToToday(startDate, endDate, timezone);
  const dates = effectiveRange ? enumerateDates(effectiveRange.startDate, effectiveRange.endDate) : [];
  const logLookup = createLogLookup(logs);
  const dailyStats = dates.map((date) => buildDayStat(activeHabits, logLookup, date, timezone));
  const habitStats = activeHabits.map((habit) => buildHabitStat(habit, dates, logLookup, timezone));
  const completedCount = dailyStats.reduce((sum, stat) => sum + stat.completedCount, 0);
  const targetCount = dailyStats.reduce((sum, stat) => sum + stat.targetCount, 0);

  return {
    month,
    summary: {
      completedCount,
      targetCount,
      progressRate: calculateProgressRate(completedCount, targetCount),
      currentStreak: calculateCurrentStreak(activeHabits, logs, timezone),
    },
    habits: activeHabits.map((habit) => ({
      habitId: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      color: habit.color,
      frequencyType: habit.frequencyType,
      targetWeekdays: habit.targetWeekdays,
      intervalDays: habit.intervalDays,
      displayOrder: habit.displayOrder,
      createdAt: habit.createdAt,
    })),
    logs: logs
      .filter((log) => compareIsoDates(log.date, startDate) >= 0 && compareIsoDates(log.date, endDate) <= 0)
      .map((log) => ({
        habitId: log.habitId,
        date: log.date,
        status: log.status,
      })),
    dailyStats,
    habitStats,
  };
}

export function buildWeeklyDashboard(
  habits: HabitRecord[],
  logs: HabitLogRecord[],
  date: string,
  timezone: string,
): WeeklyDashboard {
  const activeHabits = habits.filter((habit) => habit.isActive).sort((left, right) => left.displayOrder - right.displayOrder);
  const { startDate, endDate } = getWeekRange(date);
  const effectiveRange = clampRangeEndToToday(startDate, endDate, timezone);
  const dates = effectiveRange ? enumerateDates(effectiveRange.startDate, effectiveRange.endDate) : [];
  const logLookup = createLogLookup(logs);
  const dailyStats = dates.map((currentDate) => buildDayStat(activeHabits, logLookup, currentDate, timezone));
  const habitStats = activeHabits.map((habit) => buildHabitStat(habit, dates, logLookup, timezone));
  const completedCount = dailyStats.reduce((sum, stat) => sum + stat.completedCount, 0);
  const targetCount = dailyStats.reduce((sum, stat) => sum + stat.targetCount, 0);

  return {
    date,
    week: {
      startDate,
      endDate,
    },
    summary: {
      completedCount,
      targetCount,
      progressRate: calculateProgressRate(completedCount, targetCount),
    },
    dailyStats,
    habitStats,
  };
}
