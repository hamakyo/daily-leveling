import type { CurrentUser, HabitRecord, MonthlyDashboard, TodayDashboard } from "../lib/types";

export type UserSettings = {
  timezone: string;
  defaultView: "today" | "month";
};

export type ScreenState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "ready"; user: CurrentUser };

export type CreateHabitInput = {
  name: string;
  frequencyType: "daily" | "weekly_days";
  targetWeekdays: number[];
};

export type HabitPayload = {
  name: string;
  emoji: string | null;
  color: string | null;
  frequencyType: "daily" | "weekly_days";
  targetWeekdays: number[] | null;
};

export type DashboardData = {
  today: TodayDashboard;
  monthly: MonthlyDashboard;
  habits: HabitRecord[];
  settings: UserSettings;
};
