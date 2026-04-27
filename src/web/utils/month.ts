import { compareIsoDates, diffIsoDays, formatDateInTimezone, getWeekdayFromIsoDate } from "../../lib/date";

export function currentMonthString() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isTargetDay(
  habit: {
    frequencyType: "daily" | "weekly_days" | "every_n_days";
    targetWeekdays: number[] | null;
    intervalDays: number | null;
    createdAt: string;
  },
  date: string,
  timezone: string,
): boolean {
  const startDate = formatDateInTimezone(new Date(habit.createdAt), timezone);
  if (compareIsoDates(date, startDate) < 0) {
    return false;
  }

  if (habit.frequencyType === "daily") {
    return true;
  }

  if (habit.frequencyType === "every_n_days") {
    return habit.intervalDays != null && diffIsoDays(startDate, date) % habit.intervalDays === 0;
  }

  const weekday = getWeekdayFromIsoDate(date);
  return habit.targetWeekdays?.includes(weekday) ?? false;
}
