import type {
  CurrentUser,
  HabitLogRecord,
  HabitRecord,
  SessionRecord,
} from "../../lib/types";

export type UserProfileRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  timezone: string;
  default_view: "today" | "month";
};

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  frequency_type: "daily" | "weekly_days";
  target_weekdays: number[] | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  session_id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
};

export function mapUser(row: UserProfileRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    onboardingCompleted: row.onboarding_completed,
    timezone: row.timezone,
    defaultView: row.default_view,
  };
}

export function mapHabit(row: HabitRow): HabitRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    frequencyType: row.frequency_type,
    targetWeekdays: row.target_weekdays,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLog(row: HabitLogRow): HabitLogRecord {
  return {
    id: row.id,
    userId: row.user_id,
    habitId: row.habit_id,
    date: row.log_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.session_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function toWeekdayLiteral(weekdays: number[] | null): string | null {
  if (!weekdays || weekdays.length === 0) {
    return null;
  }

  return `{${weekdays.join(",")}}`;
}
