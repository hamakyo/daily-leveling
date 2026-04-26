import type { z } from "zod";
import type { DatabaseClient } from "../client";
import type { settingsSchema } from "../../domain/validation";

type UserSettings = {
  timezone: string;
  defaultView: "today" | "month";
};

type UserSettingsRow = {
  timezone: string;
  default_view: "today" | "month";
};

export async function getSettings(db: DatabaseClient, userId: string): Promise<UserSettings | null> {
  const rows = await db<UserSettingsRow[]>`
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
): Promise<UserSettings | null> {
  const current = await getSettings(db, userId);
  if (!current) {
    return null;
  }

  const rows = await db<UserSettingsRow[]>`
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
