import type { CreateHabitInput, HabitPayload } from "../types";

export function createEmptyHabitForm(): CreateHabitInput {
  return {
    name: "",
    emoji: "",
    color: "teal",
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
    emoji: form.emoji || null,
    color: form.color || null,
    frequencyType: form.frequencyType,
    targetWeekdays: form.frequencyType === "weekly_days" ? toWeekdaysInput(form.targetWeekdays) : null,
  };
}
