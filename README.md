# Daily Leveling

Daily Leveling is a Cloudflare Workers + React MVP for habit tracking.

## Stack

- React SPA
- Hono on Cloudflare Workers
- PostgreSQL
- pnpm

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Create local Worker env file

```bash
cp .dev.vars.example .dev.vars
```

3. Fill in:

- `DATABASE_URL`
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

4. Apply the initial migration to PostgreSQL

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

## Development

Recommended full-stack dev loop:

```bash
pnpm dev
```

This runs:
- `vite build --watch` to keep `dist/` fresh
- `wrangler dev` to serve the API and the built SPA from the same origin

Useful alternates:

```bash
pnpm dev:web
pnpm dev:worker
pnpm run check
pnpm test
pnpm run build
```

## Runtime Notes

- The supported auth/dev flow is same-origin through `wrangler dev`
- `APP_BASE_URL` should match the Worker origin in local development
- Session cookies are Worker-owned and HttpOnly
- UI font stacks should remain sans-serif only

## Cloudflare IaC

This project can manage Cloudflare infrastructure as code.

Recommended split:
- Wrangler: local dev, bundling, Worker deploys
- Terraform: Cloudflare-side service metadata, custom domains, and routes

Terraform scaffold lives in `infra/terraform`.

Typical workflow:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Then deploy code with:

```bash
pnpm run build
pnpm dev:worker
# or wrangler deploy once production env vars are configured
```

## Manual Verification Checklist

1. `GET /healthz` returns `200`
2. Google login redirects correctly
3. First login lands on onboarding
4. Template apply creates habits
5. Manual habit creation works
6. Onboarding complete updates redirect behavior
7. Today view toggles habit logs
8. Monthly view renders grid and aggregate stats
9. Reorder and archive work
10. Settings update persists timezone/default view
11. Logout revokes the current session

## Current Project Rules

- Package manager is `pnpm`
- Habit delete is soft delete via `is_active = false`
- `google_sub` is the external user key
- User-local timezone determines date boundaries
- Cloudflare infra can be managed via Terraform
