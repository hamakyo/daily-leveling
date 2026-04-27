import type { CreateHabitInput, HabitPayload } from "../types";

export const weekdayOptions = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 7, label: "日" },
] as const;

export function createEmptyHabitForm(): CreateHabitInput {
  return {
    name: "",
    frequencyType: "daily",
    targetWeekdays: [],
  };
}

export function normalizeWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((weekday) => weekday >= 1 && weekday <= 7))].sort((left, right) => left - right);
}

export function toHabitPayload(form: CreateHabitInput): HabitPayload {
  return {
    name: form.name.trim(),
    emoji: null,
    color: null,
    frequencyType: form.frequencyType,
    targetWeekdays: form.frequencyType === "weekly_days" ? normalizeWeekdays(form.targetWeekdays) : null,
  };
}
