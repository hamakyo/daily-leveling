import { AppError } from "./errors";

function formatParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = formatParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getTodayInTimezone(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isIsoMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function assertIsoDate(value: string, fieldName = "date"): string {
  if (!isIsoDate(value)) {
    throw new AppError(400, "INVALID_INPUT", `${fieldName} は YYYY-MM-DD 形式で指定してください。`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  const normalized = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;

  if (normalized !== value) {
    throw new AppError(400, "INVALID_INPUT", `${fieldName} には実在する日付を指定してください。`);
  }

  return value;
}

export function assertIsoMonth(value: string): string {
  if (!isIsoMonth(value)) {
    throw new AppError(400, "INVALID_INPUT", "month は YYYY-MM 形式で指定してください。");
  }

  const [year, month] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, 1, 12));
  const normalized = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;

  if (normalized !== value) {
    throw new AppError(400, "INVALID_INPUT", "month には実在する年月を指定してください。");
  }

  return value;
}

export function compareIsoDates(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function diffIsoDays(startDate: string, endDate: string): number {
  const start = isoDateToUtcDate(startDate);
  const end = isoDateToUtcDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } {
  assertIsoDate(value);
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function isoDateToUtcDate(value: string): Date {
  const { year, month, day } = parseIsoDate(value);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function getWeekdayFromIsoDate(value: string): number {
  const dayIndex = isoDateToUtcDate(value).getUTCDay();
  return dayIndex === 0 ? 7 : dayIndex;
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  assertIsoDate(startDate, "from");
  assertIsoDate(endDate, "to");

  if (compareIsoDates(startDate, endDate) > 0) {
    throw new AppError(400, "INVALID_INPUT", "from は to 以下の日付を指定してください。");
  }

  const dates: string[] = [];
  let cursor = isoDateToUtcDate(startDate);
  const end = isoDateToUtcDate(endDate);

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor = new Date(Date.UTC(year, cursor.getUTCMonth(), cursor.getUTCDate() + 1, 12));
  }

  return dates;
}

export function getMonthRange(month: string): { startDate: string; endDate: string } {
  assertIsoMonth(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0, 12));
  const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;

  return { startDate, endDate };
}

export function getWeekRange(date: string): { startDate: string; endDate: string } {
  const base = isoDateToUtcDate(date);
  const weekday = getWeekdayFromIsoDate(date);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - (weekday - 1), 12));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6, 12));

  const toIso = (value: Date) =>
    `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;

  return {
    startDate: toIso(start),
    endDate: toIso(end),
  };
}

export function clampRangeEndToToday(
  startDate: string,
  endDate: string,
  timezone: string,
): { startDate: string; endDate: string } | null {
  const today = getTodayInTimezone(timezone);

  if (compareIsoDates(startDate, today) > 0) {
    return null;
  }

  return {
    startDate,
    endDate: compareIsoDates(endDate, today) > 0 ? today : endDate,
  };
}
