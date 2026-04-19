import type { TransactionSql } from "postgres";
import type { z } from "zod";
import type { DatabaseClient } from "./client";
import type {
  CurrentUser,
  HabitLogRecord,
  HabitRecord,
  SessionRecord,
} from "../lib/types";
import type {
  habitCreateSchema,
  habitUpdateSchema,
  settingsSchema,
} from "../domain/validation";
import type { HabitTemplate } from "../domain/templates";

type UserProfileRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  timezone: string;
  default_view: "today" | "month";
};

type HabitRow = {
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

type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
};

function mapUser(row: UserProfileRow): CurrentUser {
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

function mapHabit(row: HabitRow): HabitRecord {
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

function mapLog(row: HabitLogRow): HabitLogRecord {
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

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.session_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
  };
}

function toWeekdayLiteral(weekdays: number[] | null): string | null {
  if (!weekdays || weekdays.length === 0) {
    return null;
  }

  return `{${weekdays.join(",")}}`;
}

export async function getCurrentUserById(db: DatabaseClient, userId: string): Promise<CurrentUser | null> {
  const rows = await db<UserProfileRow[]>`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.avatar_url,
      u.onboarding_completed,
      s.timezone,
      s.default_view
    FROM users u
    INNER JOIN user_settings s ON s.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getCurrentUserBySessionHash(
  db: DatabaseClient,
  sessionTokenHash: string,
): Promise<{ user: CurrentUser; session: SessionRecord } | null> {
  const sessionRows = await db<(SessionRow & UserProfileRow)[]>`
    SELECT
      sessions.id AS session_id,
      sessions.user_id,
      sessions.expires_at,
      sessions.revoked_at,
      sessions.last_seen_at,
      users.id,
      users.email,
      users.display_name,
      users.avatar_url,
      users.onboarding_completed,
      settings.timezone,
      settings.default_view
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    INNER JOIN user_settings settings ON settings.user_id = users.id
    WHERE sessions.session_token_hash = ${sessionTokenHash}
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > NOW()
    LIMIT 1
  `;

  const row = sessionRows[0];
  if (!row) {
    return null;
  }

  return {
    user: mapUser(row),
    session: mapSession(row),
  };
}

export async function touchSession(db: DatabaseClient, sessionId: string): Promise<void> {
  await db`
    UPDATE sessions
    SET last_seen_at = NOW()
    WHERE id = ${sessionId}
  `;
}

export async function revokeSession(db: DatabaseClient, sessionId: string): Promise<void> {
  await db`
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE id = ${sessionId}
  `;
}

export async function upsertGoogleUser(
  db: DatabaseClient,
  identity: {
    googleSub: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  },
  defaultTimezone: string,
): Promise<CurrentUser> {
  return db.begin(async (trx: TransactionSql) => {
    const userRows = await trx<UserProfileRow[]>`
      INSERT INTO users (
        google_sub,
        email,
        display_name,
        avatar_url
      )
      VALUES (
        ${identity.googleSub},
        ${identity.email},
        ${identity.displayName},
        ${identity.avatarUrl}
      )
      ON CONFLICT (google_sub)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url
      RETURNING id, email, display_name, avatar_url, onboarding_completed, ${defaultTimezone}::text AS timezone, 'today'::text AS default_view
    `;

    const userId = userRows[0].id;

    await trx`
      INSERT INTO user_settings (user_id, timezone, default_view)
      VALUES (${userId}, ${defaultTimezone}, 'today')
      ON CONFLICT (user_id) DO NOTHING
    `;

    const profileRows = await trx<UserProfileRow[]>`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.avatar_url,
        u.onboarding_completed,
        s.timezone,
        s.default_view
      FROM users u
      INNER JOIN user_settings s ON s.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    return mapUser(profileRows[0]);
  });
}

export async function createSession(
  db: DatabaseClient,
  userId: string,
  sessionTokenHash: string,
  expiresAt: Date,
  metadata: {
    ipAddress: string | null;
    userAgent: string | null;
  },
): Promise<SessionRecord> {
  const rows = await db<SessionRow[]>`
    INSERT INTO sessions (
      user_id,
      session_token_hash,
      expires_at,
      last_seen_at,
      ip_address,
      user_agent
    )
    VALUES (
      ${userId},
      ${sessionTokenHash},
      ${expiresAt.toISOString()},
      NOW(),
      ${metadata.ipAddress},
      ${metadata.userAgent}
    )
    RETURNING id AS session_id, user_id, expires_at, revoked_at, last_seen_at
  `;

  return mapSession(rows[0]);
}

export async function completeOnboarding(db: DatabaseClient, userId: string): Promise<void> {
  await db`
    UPDATE users
    SET onboarding_completed = true
    WHERE id = ${userId}
  `;
}

export async function listHabits(
  db: DatabaseClient,
  userId: string,
  options: { activeOnly?: boolean } = {},
): Promise<HabitRecord[]> {
  const rows = await db<HabitRow[]>`
    SELECT
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM habits
    WHERE user_id = ${userId}
      AND (${options.activeOnly ?? false} = false OR is_active = true)
    ORDER BY display_order ASC
  `;

  return rows.map(mapHabit);
}

export async function getHabitById(
  db: DatabaseClient,
  userId: string,
  habitId: string,
): Promise<HabitRecord | null> {
  const rows = await db<HabitRow[]>`
    SELECT
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM habits
    WHERE id = ${habitId}
      AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? mapHabit(rows[0]) : null;
}

export async function createHabit(
  db: DatabaseClient,
  userId: string,
  input: z.infer<typeof habitCreateSchema>,
): Promise<HabitRecord> {
  return db.begin(async (trx: TransactionSql) => {
    const nextOrderRows = await trx<{ next_order: number }[]>`
      SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
      FROM habits
      WHERE user_id = ${userId}
    `;
    const nextOrder = nextOrderRows[0].next_order;
    const weekdayLiteral = toWeekdayLiteral(input.targetWeekdays ?? null);
    const rows = await trx<HabitRow[]>`
      INSERT INTO habits (
        user_id,
        name,
        emoji,
        color,
        frequency_type,
        target_weekdays,
        is_active,
        display_order
      )
      VALUES (
        ${userId},
        ${input.name},
        ${input.emoji ?? null},
        ${input.color ?? null},
        ${input.frequencyType},
        ${weekdayLiteral ? trx.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
        true,
        ${nextOrder}
      )
      RETURNING
        id,
        user_id,
        name,
        emoji,
        color,
        frequency_type,
        target_weekdays,
        is_active,
        display_order,
        created_at,
        updated_at
    `;

    return mapHabit(rows[0]);
  });
}

export async function updateHabit(
  db: DatabaseClient,
  userId: string,
  habitId: string,
  input: z.infer<typeof habitUpdateSchema>,
): Promise<HabitRecord | null> {
  const currentHabit = await getHabitById(db, userId, habitId);
  if (!currentHabit) {
    return null;
  }

  const nextHabit = {
    name: input.name ?? currentHabit.name,
    emoji: input.emoji === undefined ? currentHabit.emoji : input.emoji,
    color: input.color === undefined ? currentHabit.color : input.color,
    frequencyType: input.frequencyType ?? currentHabit.frequencyType,
    targetWeekdays:
      input.frequencyType === "daily"
        ? null
        : input.targetWeekdays === undefined
          ? currentHabit.targetWeekdays
          : input.targetWeekdays,
    isActive: input.isActive ?? currentHabit.isActive,
  };

  const weekdayLiteral = toWeekdayLiteral(nextHabit.targetWeekdays ?? null);

  const rows = await db<HabitRow[]>`
    UPDATE habits
    SET
      name = ${nextHabit.name},
      emoji = ${nextHabit.emoji},
      color = ${nextHabit.color},
      frequency_type = ${nextHabit.frequencyType},
      target_weekdays = ${weekdayLiteral ? db.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
      is_active = ${nextHabit.isActive}
    WHERE id = ${habitId}
      AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      name,
      emoji,
      color,
      frequency_type,
      target_weekdays,
      is_active,
      display_order,
      created_at,
      updated_at
  `;

  return rows[0] ? mapHabit(rows[0]) : null;
}

export async function reorderHabits(
  db: DatabaseClient,
  userId: string,
  habitIds: string[],
): Promise<boolean> {
  const existingHabits = await listHabits(db, userId);
  const existingIds = new Set(existingHabits.map((habit) => habit.id));

  if (!habitIds.every((habitId) => existingIds.has(habitId))) {
    return false;
  }

  await db.begin(async (trx: TransactionSql) => {
    for (const [index, habitId] of habitIds.entries()) {
      await trx`
        UPDATE habits
        SET display_order = ${index}
        WHERE id = ${habitId}
          AND user_id = ${userId}
      `;
    }
  });

  return true;
}

export async function listLogsInRange(
  db: DatabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<HabitLogRecord[]> {
  const rows = await db<HabitLogRow[]>`
    SELECT
      id,
      user_id,
      habit_id,
      log_date,
      status,
      created_at,
      updated_at
    FROM habit_logs
    WHERE user_id = ${userId}
      AND log_date BETWEEN ${from} AND ${to}
    ORDER BY log_date ASC, habit_id ASC
  `;

  return rows.map(mapLog);
}

export async function upsertHabitLog(
  db: DatabaseClient,
  userId: string,
  habitId: string,
  date: string,
  status: boolean,
): Promise<HabitLogRecord> {
  const rows = await db<HabitLogRow[]>`
    INSERT INTO habit_logs (
      user_id,
      habit_id,
      log_date,
      status
    )
    VALUES (
      ${userId},
      ${habitId},
      ${date},
      ${status}
    )
    ON CONFLICT (user_id, habit_id, log_date)
    DO UPDATE SET
      status = EXCLUDED.status
    RETURNING
      id,
      user_id,
      habit_id,
      log_date,
      status,
      created_at,
      updated_at
  `;

  return mapLog(rows[0]);
}

export async function createHabitsFromTemplate(
  db: DatabaseClient,
  userId: string,
  habits: HabitTemplate[],
): Promise<HabitRecord[]> {
  return db.begin(async (trx: TransactionSql) => {
    const nextOrderRows = await trx<{ next_order: number }[]>`
      SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
      FROM habits
      WHERE user_id = ${userId}
    `;
    let displayOrder = nextOrderRows[0].next_order;
    const createdHabits: HabitRecord[] = [];

    for (const habit of habits) {
      const weekdayLiteral = toWeekdayLiteral(habit.targetWeekdays);
      const rows = await trx<HabitRow[]>`
        INSERT INTO habits (
          user_id,
          name,
          emoji,
          color,
          frequency_type,
          target_weekdays,
          is_active,
          display_order
        )
        VALUES (
          ${userId},
          ${habit.name},
          ${habit.emoji},
          ${habit.color},
          ${habit.frequencyType},
          ${weekdayLiteral ? trx.unsafe(`'${weekdayLiteral}'::smallint[]`) : null},
          true,
          ${displayOrder}
        )
        RETURNING
          id,
          user_id,
          name,
          emoji,
          color,
          frequency_type,
          target_weekdays,
          is_active,
          display_order,
          created_at,
          updated_at
      `;
      createdHabits.push(mapHabit(rows[0]));
      displayOrder += 1;
    }

    return createdHabits;
  });
}

export async function getSettings(
  db: DatabaseClient,
  userId: string,
): Promise<{ timezone: string; defaultView: "today" | "month" } | null> {
  const rows = await db<{ timezone: string; default_view: "today" | "month" }[]>`
    SELECT timezone, default_view
    FROM user_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    timezone: row.timezone,
    defaultView: row.default_view,
  };
}

export async function updateSettings(
  db: DatabaseClient,
  userId: string,
  input: z.infer<typeof settingsSchema>,
): Promise<{ timezone: string; defaultView: "today" | "month" } | null> {
  const current = await getSettings(db, userId);
  if (!current) {
    return null;
  }

  const rows = await db<{ timezone: string; default_view: "today" | "month" }[]>`
    UPDATE user_settings
    SET
      timezone = ${input.timezone ?? current.timezone},
      default_view = ${input.defaultView ?? current.defaultView}
    WHERE user_id = ${userId}
    RETURNING timezone, default_view
  `;

  const row = rows[0];
  return {
    timezone: row.timezone,
    defaultView: row.default_view,
  };
}
