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
    frequencyType: "daily" | "weekly_days";
    targetWeekdays: number[] | null;
  },
  date: string,
): boolean {
  if (habit.frequencyType === "daily") {
    return true;
  }

  const jsDate = new Date(`${date}T12:00:00Z`);
  const weekday = jsDate.getUTCDay() === 0 ? 7 : jsDate.getUTCDay();
  return habit.targetWeekdays?.includes(weekday) ?? false;
}
