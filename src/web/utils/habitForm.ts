import type { CreateHabitInput, HabitPayload } from "../types";

export const habitColorOptions = [
  { value: "cyan", label: "シアン" },
  { value: "blue", label: "ブルー" },
  { value: "violet", label: "バイオレット" },
  { value: "teal", label: "ティール" },
  { value: "indigo", label: "インディゴ" },
] as const;

export function createEmptyHabitForm(): CreateHabitInput {
  return {
    name: "",
    color: "cyan",
    frequencyType: "daily",
    targetWeekdays: "",
  };
}

export function toWeekdaysInput(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

export function toHabitPayload(form: CreateHabitInput): HabitPayload {
  return {
    name: form.name,
    emoji: null,
    color: form.color,
    frequencyType: form.frequencyType,
    targetWeekdays: form.frequencyType === "weekly_days" ? toWeekdaysInput(form.targetWeekdays) : null,
  };
}
