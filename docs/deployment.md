# Daily Leveling デプロイ手順

## 環境

このプロジェクトは `test`、`staging`、`production` を分けて運用します。
各環境で分離するものは Worker 名、`APP_BASE_URL`、Google OAuth redirect URI、Cookie 名、Cloudflare/GitHub secrets です。
Supabase Free plan の現時点では PostgreSQL と Hyperdrive は production のみ接続します。

## Hyperdrive

Worker runtime の DB 接続は `HYPERDRIVE` binding を使います。
`wrangler.toml` の `[[env.production.hyperdrive]]` に production 用 config ID を設定します。
`test` と `staging` は本番 DB への誤接続を避けるため、現時点では `HYPERDRIVE` binding を持たせません。

`DATABASE_URL` は次の用途で残します。
- local dev
- DB migration
- Hyperdrive config 作成元
- `HYPERDRIVE` 未設定時の fallback

## Static Asset Delivery

`wrangler.toml` の assets は `run_worker_first = true` にしています。
これにより API だけでなく静的 HTML / asset 配信も Worker を経由し、
セキュリティヘッダと SPA fallback を一貫して適用できます。

## 事前検証

```bash
pnpm run cloud:status
pnpm run check
pnpm test
pnpm run build
pnpm run infra:validate
pnpm run deploy:dry-run:test
pnpm run cf:status:test
pnpm run cf:status:staging
```

`deploy:dry-run:*` は Worker bundle と Wrangler config の整合性確認に使います。
本番 deploy 前には、Hyperdrive config ID が production 用 PostgreSQL を指していることを確認してください。
あわせて `/` と `/healthz` の両方で security header が返ることを確認してください。

## Cloud CLI

このプロジェクトで使うクラウド CLI は以下です。

- `gcloud`
  Google OAuth client、GCP project、必要に応じた GCP resource の確認に使います。
- `supabase`
  Supabase PostgreSQL を使う場合の project と DB connection の確認に使います。
- `pnpm exec wrangler`
  Cloudflare Workers、secrets、deploy、Hyperdrive の確認に使います。

状態確認:

```bash
pnpm run cloud:status
```

未ログインの場合は以下を実行します。

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
supabase login
pnpm exec wrangler login
```

`gcloud` と Supabase は認証後に read-only の確認から始め、resource 作成や secret 更新は対象環境を明示して実行してください。

## Secrets

Worker runtime で必要な secret:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- fallback が必要な場合のみ `DATABASE_URL`

Worker runtime で必要な binding:
- `AUTH_RATE_LIMITS`
- production のみ `HYPERDRIVE`

ローカル CLI から Cloudflare secrets を同期する場合は、対象環境ごとの `.env.<env>` または `.dev.vars.<env>` を使います。
`.dev.vars` だけを fallback として読む状態、または `DATABASE_URL` が `localhost` / `127.0.0.1` の状態では、誤同期防止のため sync script が失敗します。
Hyperdrive を使う通常運用では、Cloudflare Worker secret の `DATABASE_URL` は必須ではありません。

## Auth Rate Limit KV

auth route の rate limit は Cloudflare KV namespace を使います。
Terraform は `worker_name-auth-rate-limits` という title で namespace を作成し、その ID を output します。

Wrangler では `AUTH_RATE_LIMITS` binding を各環境に設定します。
現在の `wrangler.toml` には作成済み namespace ID を反映しています。
Terraform 側でも同じ ID を `auth_rate_limits_namespace_id` として渡し、既存 namespace を再利用してください。

local dev は binding 未設定でも起動し、その場合 rate limit は no-op です。

## Supabase PostgreSQL

Daily Leveling 用の Supabase project は、Free plan の上限に合わせて production DB として扱います。

- project name: `daily-leveling`
- project ref: `djfqflkxsyzazuvtnqqm`
- region: `ap-northeast-1` / Northeast Asia (Tokyo)
- Cloudflare Hyperdrive production config: `5d5eb906286148e18f97904118daa682`

`test` / `staging` / `production` の Worker、`APP_BASE_URL`、cookie 名、Google OAuth redirect URI はコード上で分離します。
ただし Supabase Free plan では project を追加できないため、DB は production のみ接続します。
`test` と `staging` は DB binding を持たせず、DB を使う実データ検証は production または将来の別 DB 作成後に行います。

このアプリは Supabase client をブラウザから使わず、Cloudflare Workers が PostgreSQL に接続します。
そのため Supabase の `anon` / `authenticated` 経路から app table を直接読ませない前提で、app table には RLS を有効化し、public policy は作りません。

GitHub Actions で必要な secret:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DATABASE_URL`（migration と secret sync 用）
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 手動 deploy

```bash
pnpm run db:migrate:plan:staging
pnpm run db:migrate:staging
pnpm run deploy:staging
pnpm run cf:status:staging
```

production では同じ流れを `production` script で実行します。

deploy 後の最低確認:

```bash
pnpm run cf:health:production
curl -I https://daily-leveling.hamakyoh.workers.dev/
curl -I https://daily-leveling.hamakyoh.workers.dev/healthz
```

確認ポイント:
- `200 OK`
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- auth route で `AUTH_RATE_LIMITS` binding が解決される
