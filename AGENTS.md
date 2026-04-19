# AGENTS.md

## Purpose

This repository is currently being built from design docs.
Use this file as the working contract for implementation agents.

Read order:
1. `SPEC.md`
2. `PLAN.md`
3. relevant files under `docs/` only if more detail is needed

If docs conflict, prefer:
1. `SPEC.md`
2. `PLAN.md`
3. latest design docs in `docs/`

## Project Constraints

- This is a habit tracker, not a task manager
- The MVP must stay narrow
- Keep the architecture simple and production-shaped
- Do not add features that widen the scope before core flows work

## Locked Technical Decisions

- Use React SPA for the client
- Use Hono on Cloudflare Workers for API/BFF
- Use PostgreSQL as the source of truth
- Use DB-backed sessions
- Use Google OAuth only
- Use `pnpm` as the package manager

Do not introduce:
- Next.js
- a second auth provider
- client-managed auth tokens
- a second database

## Locked Domain Decisions

- Use `google_sub`, never `google_id`
- Keep timezone in `user_settings.timezone`
- Treat delete as archive through `is_active = false`
- Store session hashes, never plaintext session secrets
- Enforce user ownership on all habit and log operations
- Interpret day boundaries in user-local time

## Required Behavior

- All non-auth-start/callback APIs require auth
- The API must never accept `userId` for data scoping
- Future logs must be rejected
- Non-target weekdays must be rejected by the API
- Aggregates must use target days only
- Aggregates must treat target days without `status=true` as incomplete

## Directory Expectations

Keep the codebase easy to navigate. A good default layout is:

- `src/api` for route handlers
- `src/auth` for OAuth and session code
- `src/db` for queries and migrations wiring
- `src/domain` for habits, logs, and aggregate logic
- `src/lib` for shared utilities
- `src/web` for React UI
- `tests` for unit and integration tests
- `migrations` for SQL migrations

Adjust naming if needed, but preserve clear ownership boundaries.

## Implementation Guidance

- Build vertical slices, not disconnected layers
- Start with the minimum path that proves end-to-end value
- Prefer server-owned aggregate APIs over stitching many small APIs in the client
- Keep validation centralized
- Keep date and timezone logic in reusable helpers
- Add comments only where logic is genuinely easy to misread

## Data and Query Guidance

- Prefer simple SQL and indexed access patterns
- Do not add caching or materialized views in the first pass
- Do not physically delete habits in normal flows
- Keep `display_order` deterministic
- Ensure log upserts are idempotent

## Testing Guidance

Minimum required coverage areas:
- auth session validation
- weekday targeting
- future-date rejection
- monthly aggregate correctness
- streak correctness
- archive behavior

When time is limited, test domain logic before UI details.

## Definition of Done

A task is not done unless:
- it matches `SPEC.md`
- it fits the current phase in `PLAN.md`
- it includes the needed validation
- it preserves user data isolation
- it has enough verification to trust the behavior

## Anti-Patterns

Do not:
- widen scope while core flows are incomplete
- add speculative abstractions
- hide unresolved spec conflicts in code
- mix user-local date logic and raw UTC assumptions in the same workflow
- ship UI-only guards for rules that must also be enforced by the API

## Escalation Rule

If an implementation task is blocked by a real spec gap, do not guess silently.
Document the gap explicitly and choose the narrowest decision that preserves MVP scope.
