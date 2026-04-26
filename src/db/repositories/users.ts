import type { TransactionSql } from "postgres";
import type { DatabaseClient } from "../client";
import type { CurrentUser } from "../../lib/types";
import { mapUser, type UserProfileRow } from "./rows";

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
