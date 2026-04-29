import type { DatabaseClient } from "../client";
import type { CurrentUser, SessionRecord } from "../../lib/types";
import { mapSession, mapUser, type SessionRow, type UserProfileRow } from "./rows";

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
      settings.default_view,
      settings.theme
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
