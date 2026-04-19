# Daily Leveling MVP Plan

## Goal

Build the smallest production-shaped MVP that satisfies `SPEC.md`.

## Implementation Order

### Phase 0: Workspace Bootstrap

Deliverables:
- Worker app scaffold
- React SPA scaffold
- TypeScript, lint, test, and formatting setup
- environment variable handling
- local and deploy config

Done when:
- app boots locally
- one Worker route responds
- one React page renders through the chosen app structure

### Phase 1: Database and Migrations

Deliverables:
- migration folder
- initial schema migration
- seed strategy for local development
- DB access module

Important decisions:
- use `google_sub`, not `google_id`
- use `user_settings.timezone`, not `users.timezone`
- keep habit deletion soft via `is_active = false`

Done when:
- all 5 core tables migrate successfully
- indexes and triggers exist
- session and habit log uniqueness are enforced

### Phase 2: Shared Domain and Validation

Deliverables:
- schema validation layer
- auth/session helpers
- timezone/date helpers
- frequency target-day helpers
- progress-rate helper
- streak helper
- shared error response format

Done when:
- all request payloads can be validated centrally
- all date logic is based on user timezone
- aggregate rules match `SPEC.md`

### Phase 3: Authentication

Deliverables:
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`

Implementation notes:
- use state and PKCE
- verify ID token server-side
- create `users` and `user_settings` on first login
- create DB session and opaque auth cookie on success

Done when:
- login works end to end
- logout revokes the session
- protected APIs can resolve `currentUser`

### Phase 4: Onboarding and Templates

Deliverables:
- template definitions in code
- `POST /onboarding/templates/apply`
- `POST /onboarding/complete`

Done when:
- a first-time user can receive starter habits
- onboarding completion affects post-login redirect behavior

### Phase 5: Habit Management

Deliverables:
- `GET /habits`
- `POST /habits`
- `PATCH /habits/:habitId`
- `POST /habits/reorder`

Implementation notes:
- reorder updates `display_order`
- archive uses `is_active = false`
- never expose cross-user habit access

Done when:
- habits can be listed, created, edited, reordered, and archived

### Phase 6: Habit Logs

Deliverables:
- `GET /logs`
- `PUT /habits/:habitId/logs/:date`

Implementation notes:
- reject future dates
- reject non-target weekdays
- upsert by `user_id + habit_id + log_date`

Done when:
- today and past logs can be written safely
- monthly grid data can be fetched for a date range

### Phase 7: Dashboard Aggregates

Deliverables:
- `GET /dashboard/today`
- `GET /dashboard/monthly`

Implementation notes:
- return screen-shaped payloads
- compute from raw tables, not pre-aggregated tables
- include only active habits in aggregate denominators

Done when:
- mobile today view can render from one API call
- monthly view can render from one API call

### Phase 8: Web UI

Deliverables:
- login screen
- onboarding screen
- dashboard screen
- habit create/edit UI
- settings screen shell

Priority order:
1. login
2. onboarding
3. mobile today view
4. desktop monthly view
5. habit editor
6. settings

Done when:
- the full user journey works in browser without mocks

### Phase 9: Secondary Endpoints

Deliverables:
- `GET /settings`
- `PATCH /settings`
- `GET /dashboard/weekly`

Done when:
- settings are editable
- weekly aggregate is available without changing core architecture

### Phase 10: QA and Deployment

Deliverables:
- unit tests for helpers
- API tests for auth, habits, logs, and dashboard
- manual test checklist
- deploy config and secrets checklist

High-risk areas to test:
- OAuth callback edge cases
- timezone day-boundary behavior
- weekday-target validation
- log upsert idempotency
- streak calculation
- archived habits in aggregates

Done when:
- core acceptance criteria from `SPEC.md` pass
- the deployed app can log in and persist data

## Stop-the-Line Rules

Do not continue feature work until these are settled in code:
- timezone boundary logic
- session cookie format and session lookup
- streak definition
- soft-delete behavior

## Out of Scope Until Core MVP Works

- badges, XP, game economy
- notifications
- AI features
- social features
- external integrations
- PWA work

## Recommended First Build Slice

Build this vertical slice first:
1. schema
2. auth
3. create one habit
4. toggle today's log
5. render today's summary

After that, build monthly aggregation and the rest of the UI.
