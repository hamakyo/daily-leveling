# Daily Leveling MVP Spec

## Purpose

This file is the implementation-facing MVP spec for Daily Leveling.
It consolidates the current requirement, DDL, basic design, and API design docs,
and resolves the minimum set of ambiguities needed to start implementation.

Source docs:
- `docs/Daily_Leveling_要件定義_v0.2.md`
- `docs/Daily_Leveling_PostgreSQL_DDL草案_v0.1.md`
- `docs/daily_leveling_schema_v0_1.sql`
- `docs/Daily_Leveling_基本設計_v0.1.md`
- `docs/Daily_Leveling_API詳細設計_v0.1.md`

When older docs conflict, follow this file.

## Product Summary

Daily Leveling is a habit tracker focused on:
- fast daily check-in
- monthly grid visibility
- simple progress feedback

It is not a task manager. The MVP handles habits only.

## Locked Architecture Decisions

- Frontend: React SPA
- BFF/API: Hono on Cloudflare Workers
- Database: PostgreSQL
- DB access path: Hyperdrive
- Auth provider: Google OAuth 2.0 / OpenID Connect only
- Session model: DB-backed sessions with an opaque cookie token

## Locked Domain Decisions

- External user identity key is `google_sub`
- App user primary key is internal `users.id`
- User timezone lives in `user_settings.timezone`
- Habit delete in MVP means archive via `is_active = false`
- No physical habit delete in the normal UI flow
- Habit frequency types are only `daily` and `weekly_days`
- Weekday convention is `1=Mon ... 7=Sun`
- A habit log is unique per `user_id + habit_id + log_date`
- Future dates are visible but not writable
- DB timestamps are stored in UTC
- Date boundaries are interpreted in the user's timezone

## Locked Calculation Rules

- Target days only count toward denominators
- For aggregate calculations, `status = true` means complete
- For aggregate calculations, target days without a `true` log count as incomplete
- `progressRate` is returned as a percentage rounded to 1 decimal place
- `currentStreak` is the number of consecutive user-local days up to today where:
  - the day has at least 1 target habit
  - all target habits for that day are completed

## Required MVP User Flows

1. User starts Google login
2. User completes OAuth callback and receives a session cookie
3. First-time user lands on onboarding
4. User applies a template and/or adds habits manually
5. User completes onboarding
6. User sees today's habits and can toggle completion
7. User can open the monthly dashboard and review:
   - monthly total progress
   - daily progress
   - per-habit progress
   - current streak
8. User can edit habits, reorder habits, and archive habits
9. User can log out

## API Scope

Core MVP APIs:
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /onboarding/templates/apply`
- `POST /onboarding/complete`
- `GET /habits`
- `POST /habits`
- `PATCH /habits/:habitId`
- `POST /habits/reorder`
- `GET /logs`
- `PUT /habits/:habitId/logs/:date`
- `GET /dashboard/today`
- `GET /dashboard/monthly`

Secondary APIs:
- `GET /settings`
- `PATCH /settings`
- `GET /dashboard/weekly`

Secondary APIs can ship after the first usable MVP if needed.

## Data Model

Required tables:
- `users`
- `user_settings`
- `sessions`
- `habits`
- `habit_logs`

Key schema constraints:
- `users.google_sub` is unique
- `user_settings.user_id` is unique
- `sessions.session_token_hash` is unique
- `habit_logs(user_id, habit_id, log_date)` is unique
- `habits.frequency_type` is `daily` or `weekly_days`

Implementation note:
- The SQL draft's weekday-array validation should be implemented in a PostgreSQL-safe way
  instead of relying on a fragile inline `CHECK` expression.

## Validation Rules

- `name`: required, trimmed, 1 to 100 chars
- `frequencyType`: required, `daily | weekly_days`
- `targetWeekdays`:
  - must be absent or null for `daily`
  - must be present for `weekly_days`
  - must contain unique integers in `1..7`
  - should be normalized to ascending order
- `date`: `YYYY-MM-DD`
- `month`: `YYYY-MM`
- `defaultView`: `today | month`
- `timezone`: valid IANA timezone

## Security Rules

- All APIs except Google auth start/callback require auth
- Session cookie must be `HttpOnly`, `Secure`, `SameSite=Lax`
- Session cookie must not contain plaintext session hashes
- Session validity requires:
  - cookie present
  - session record exists
  - `revoked_at IS NULL`
  - `expires_at > NOW()`
- Ownership checks are mandatory on all habit-scoped APIs
- The API never accepts a client-provided `userId` for scoping

## UX Priorities

- Mobile first for the daily check-in flow
- Desktop first for the monthly dashboard flow
- Toggling today should feel immediate
- Monthly grid load should stay around 1 second in normal conditions
- Avoid punitive language for misses

## Deferred From Core MVP

- notifications
- XP, badges, currency, or level systems
- social features
- AI review features
- calendar integrations
- widgets or PWA work
- physical habit delete

## MVP Acceptance Criteria

- Google login works end to end
- First-time users can finish onboarding
- Habits can be created, updated, reordered, and archived
- Today's check-in works
- Monthly dashboard works
- Monthly total progress, daily progress, per-habit progress, and streak are visible
- The app is usable on both mobile and desktop
