# Daily Leveling デプロイ手順

## 環境

このプロジェクトは `test`、`staging`、`production` を分けて運用します。
各環境で分離するものは Worker 名、`APP_BASE_URL`、PostgreSQL、Hyperdrive config、Google OAuth client、Cloudflare/GitHub secrets です。

## Hyperdrive

Worker runtime の DB 接続は `HYPERDRIVE` binding を使います。
`wrangler.toml` の `[[env.<env>.hyperdrive]]` に環境ごとの config ID を設定します。
現在の placeholder ID は、実際の Cloudflare Hyperdrive config 作成後に差し替えてください。

`DATABASE_URL` は次の用途で残します。
- local dev
- DB migration
- Hyperdrive config 作成元
- `HYPERDRIVE` 未設定時の fallback

## 事前検証

```bash
pnpm run check
pnpm test
pnpm run build
pnpm run infra:validate
pnpm run deploy:dry-run:test
pnpm run cf:status:test
pnpm run cf:status:staging
```

`deploy:dry-run:*` は Worker bundle と Wrangler config の整合性確認に使います。
本番 deploy 前には、Hyperdrive config ID が対象環境の PostgreSQL を指していることを確認してください。

## Secrets

Worker runtime で必要な secret:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- fallback が必要な場合のみ `DATABASE_URL`

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
