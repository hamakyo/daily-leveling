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

4. 初期 migration を PostgreSQL に適用します。

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
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
pnpm run infra:fmt
pnpm run infra:validate
pnpm run deploy:dry-run
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
# 本番環境変数を設定した後は wrangler deploy を使う
```

## デプロイ

ローカルからの事前確認:

```bash
pnpm run deploy:dry-run
```

実デプロイ:

```bash
pnpm run deploy
```

GitHub Actions からの deploy も可能です。`.github/workflows/deploy.yml` を使い、手動実行で Worker を Cloudflare に配備できます。

必要な GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## CI

GitHub Actions で以下を検証するようにしています。

- TypeScript 型チェック
- Vitest
- Vite build
- Terraform fmt
- Terraform validate

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
