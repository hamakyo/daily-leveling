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

export const intervalPresetOptions = [2, 3, 7, 14] as const;

export function createEmptyHabitForm(): CreateHabitInput {
  return {
    name: "",
    frequencyType: "daily",
    targetWeekdays: [],
    intervalDays: "3",
  };
}

export function normalizeWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((weekday) => weekday >= 1 && weekday <= 7))].sort((left, right) => left - right);
}

export function parseIntervalDays(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function shiftDays(baseDate: Date, deltaDays: number): Date {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function formatPreviewDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function buildIntervalSchedulePreview(
  value: string,
  options: { baseDate?: Date; timeZone?: string; count?: number } = {},
): { intervalDays: number; description: string; targetDateLabels: string[] } | null {
  const intervalDays = parseIntervalDays(value);
  if (!intervalDays || intervalDays < 2 || intervalDays > 365) {
    return null;
  }

  const baseDate = options.baseDate ?? new Date();
  const count = options.count ?? 4;
  const targetDateLabels = Array.from({ length: count }, (_, index) => {
    if (index === 0) {
      return "今日";
    }

    return formatPreviewDate(shiftDays(baseDate, intervalDays * index), options.timeZone);
  });

  return {
    intervalDays,
    description: `作成すると、今日を起点に ${intervalDays} 日間隔で対象日になります。`,
    targetDateLabels,
  };
}

export function toHabitPayload(form: CreateHabitInput): HabitPayload {
  const parsedIntervalDays = parseIntervalDays(form.intervalDays);

  return {
    name: form.name.trim(),
    emoji: null,
    color: null,
    frequencyType: form.frequencyType,
    targetWeekdays: form.frequencyType === "weekly_days" ? normalizeWeekdays(form.targetWeekdays) : null,
    intervalDays:
      form.frequencyType === "every_n_days" && Number.isInteger(parsedIntervalDays) ? parsedIntervalDays : null,
  };
}
