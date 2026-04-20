# Daily Leveling

Daily Leveling は、Cloudflare Workers + React で構成する習慣トラッカー MVP です。

## 技術スタック

- React SPA
- Hono on Cloudflare Workers
- PostgreSQL
- pnpm

## セットアップ

1. 依存関係をインストールします。

```bash
pnpm install
```

2. ローカル用の Worker 環境変数ファイルを作成します。

```bash
cp .dev.vars.example .dev.vars
```

3. 以下の値を `.dev.vars` に設定します。

- `DATABASE_URL`
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

4. 環境変数を確認します。

```bash
pnpm run env:check
```

5. migration を PostgreSQL に適用します。

```bash
pnpm run db:migrate
```

## 開発

推奨するフルスタック開発コマンドは以下です。

```bash
pnpm dev
```

このコマンドで次の 2 つが同時に動きます。
- `vite build --watch`
  `dist/` を継続更新します。
- `wrangler dev`
  API とビルド済み SPA を同一オリジンで配信します。

個別に動かしたい場合は以下を使います。

```bash
pnpm dev:web
pnpm dev:worker
pnpm run check
pnpm test
pnpm run build
pnpm run env:check
pnpm run db:migrate:plan
pnpm run db:migrate
pnpm run infra:fmt
pnpm run infra:validate
pnpm run deploy:dry-run:test
pnpm run deploy:dry-run:staging
pnpm run deploy:dry-run:production
pnpm run verify
pnpm run verify:full:test
pnpm run verify:full:staging
pnpm run verify:full:production
pnpm run release:check:test
pnpm run release:check:staging
pnpm run release:check:production
```

## 実行時メモ

- ローカル認証フローは `wrangler dev` による same-origin 前提です。
- `APP_BASE_URL` はローカル Worker の URL と一致させてください。
- セッション Cookie は Worker 側で管理し、`HttpOnly` です。
- UI のフォントスタックは sans-serif のみを使用します。

## Cloudflare の IaC

このプロジェクトは Cloudflare 環境を IaC 化できます。

推奨する責務分担は以下です。
- Wrangler
  ローカル開発、ビルド、Worker コードのデプロイ
- Terraform
  Cloudflare 側の Worker サービス定義、Custom Domain、Route などの管理

Terraform の土台は `infra/terraform` にあります。

基本フローは以下です。

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Worker コード側は以下で検証・デプロイします。

```bash
pnpm run build
pnpm dev:worker
# 実デプロイは環境別 script を使う
```

## 環境分離

このプロジェクトは以下の 3 環境を前提に分けます。

- `test`
  接続確認や軽い検証用。Worker 名は `daily-leveling-test`
- `staging`
  `main` の確認環境。Worker 名は `daily-leveling-staging`
- `production`
  本番環境。Worker 名は `daily-leveling`

分離するもの:
- Cloudflare Worker 名
- `APP_BASE_URL`
- PostgreSQL
- Google OAuth client / redirect URI
- Cloudflare / GitHub Secrets
- Terraform の `tfvars`

`wrangler.toml` には `env.test`, `env.staging`, `env.production` を定義しています。
ローカル開発用の top-level 名は `daily-leveling-local` です。

## デプロイ

ローカルからの事前確認:

```bash
pnpm run env:check
pnpm run db:migrate:plan
pnpm run verify
pnpm run deploy:dry-run:staging
```

環境別の実デプロイ:

```bash
pnpm run db:migrate
pnpm run deploy:test
pnpm run deploy:staging
pnpm run deploy:production
```

GitHub Actions からの deploy も可能です。`.github/workflows/deploy.yml` を使い、手動実行で Worker を Cloudflare に配備できます。
実行時に `test / staging / production` を選択し、同名の GitHub Environment を使って secrets を解決します。

必要な GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 本番設定チェックリスト

Cloudflare Workers 側で最低限必要な環境変数:
- `DATABASE_URL`
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

任意だが運用上は明示推奨の環境変数:
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `DEFAULT_TIMEZONE`

GitHub Actions の deploy で必要な Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

GitHub Environments の推奨構成:
- `test`
- `staging`
- `production`

各 GitHub Environment に最低限設定するもの:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Worker runtime 用の環境変数と secret は Cloudflare 側に環境ごとに設定します。
- `DATABASE_URL`
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- 必要に応じて `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`, `DEFAULT_TIMEZONE`

本番デプロイ前に確認すること:
1. `APP_BASE_URL` が本番の公開 URL と一致している
2. Google OAuth の redirect URI に `/auth/google/callback` を含む本番 URL が登録されている
3. PostgreSQL に `migrations/001_init.sql` が適用済みである
4. session cookie を `Secure` で返せる HTTPS URL を使っている
5. Cloudflare 側の Route または Custom Domain が Terraform で作成済みである
6. `pnpm run verify:full:production` が通る

Wrangler で本番 secret を設定する例:

```bash
wrangler secret put DATABASE_URL --env production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

staging の例:

```bash
wrangler secret put DATABASE_URL --env staging
wrangler secret put GOOGLE_CLIENT_ID --env staging
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
```

## CI

GitHub Actions で以下を検証するようにしています。

- TypeScript 型チェック
- Vitest
- Vite build
- Terraform fmt
- Terraform validate

ローカルで CI 相当の検証をまとめて回したい場合は以下を使います。

```bash
pnpm run verify
```

Cloudflare/Terraform の確認まで含める場合は以下です。

```bash
pnpm run verify:full:staging
```

本番投入前の総合チェックは以下です。

```bash
pnpm run release:check:production
```

## DB migration

migration は `schema_migrations` テーブルで管理します。

- `pnpm run db:migrate:plan`
  未適用 migration の一覧だけ確認します。
- `pnpm run db:migrate`
  未適用 migration を順に適用します。

どちらのコマンドも、まず `process.env` を見て、不足分だけ `.dev.vars`, `.env`, `.env.local` から読み込みます。

## Terraform 環境ファイル

`infra/terraform/environments/` に環境別の雛形を置いています。

- `test.tfvars.example`
- `staging.tfvars.example`
- `production.tfvars.example`

例:

```bash
cd infra/terraform
cp environments/staging.tfvars.example staging.tfvars
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

## 手動確認チェックリスト

1. `GET /healthz` が `200` を返す
2. Google ログインのリダイレクトが正しい
3. 初回ログインでオンボーディングに遷移する
4. テンプレート適用で習慣が作成される
5. 手動で習慣を追加できる
6. オンボーディング完了後のリダイレクトが切り替わる
7. Today view でログをトグルできる
8. Month view でグリッドと集計が表示される
9. 並び替えと archive が動く
10. Settings 更新で timezone/default view が保存される
11. ログアウトで現在のセッションが失効する

## 現在のプロジェクトルール

- パッケージマネージャーは `pnpm`
- 習慣削除は物理削除ではなく `is_active = false` による soft delete
- 外部ユーザー識別子は `google_sub`
- 日付境界はユーザーのローカル timezone 基準
- Cloudflare 側のインフラは Terraform で管理できる
