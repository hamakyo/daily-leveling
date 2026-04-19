export type FrequencyType = "daily" | "weekly_days";
export type DefaultView = "today" | "month";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  timezone: string;
  defaultView: DefaultView;
}

export interface HabitRecord {
  id: string;
  userId: string;
  name: string;
  emoji: string | null;
  color: string | null;
  frequencyType: FrequencyType;
  targetWeekdays: number[] | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLogRecord {
  id: string;
  userId: string;
  habitId: string;
  date: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

export interface DayStat {
  date: string;
  completedCount: number;
  targetCount: number;
  progressRate: number;
}

export interface HabitStat {
  habitId: string;
  name: string;
  completedCount: number;
  targetCount: number;
  progressRate: number;
}

export interface MonthlyDashboard {
  month: string;
  summary: {
    completedCount: number;
    targetCount: number;
    progressRate: number;
    currentStreak: number;
  };
  habits: Array<{
    habitId: string;
    name: string;
    emoji: string | null;
    color: string | null;
    frequencyType: FrequencyType;
    targetWeekdays: number[] | null;
    displayOrder: number;
  }>;
  logs: Array<{
    habitId: string;
    date: string;
    status: boolean;
  }>;
  dailyStats: DayStat[];
  habitStats: HabitStat[];
}

export interface WeeklyDashboard {
  week: {
    startDate: string;
    endDate: string;
  };
  summary: {
    completedCount: number;
    targetCount: number;
    progressRate: number;
  };
  dailyStats: DayStat[];
  habitStats: HabitStat[];
}

export interface TodayDashboard {
  date: string;
  summary: {
    completedCount: number;
    targetCount: number;
    progressRate: number;
  };
  habits: Array<{
    habitId: string;
    name: string;
    emoji: string | null;
    color: string | null;
    status: boolean | null;
    isTargetDay: boolean;
    frequencyType: FrequencyType;
  }>;
}
