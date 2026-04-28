# テスト方針

Daily Leveling のテストは、ドメインロジック、API 境界、ブラウザ上の主要導線を分けて確認します。

## コマンド

```bash
pnpm run check
pnpm test
pnpm run build
pnpm run test:e2e
```

`pnpm test` は Vitest の unit / integration test を実行します。
Playwright の spec は `tests/e2e` に置き、Vitest からは除外します。

## Playwright E2E

Playwright CLI の設定は `playwright.config.ts` にあります。
`pnpm run test:e2e` は `webServer` 経由で `pnpm dev:e2e` を起動し、`http://127.0.0.1:8788` に対してブラウザテストを実行します。

初回だけ Chromium をインストールします。

```bash
pnpm exec playwright install chromium
```

事前条件:
- `.dev.vars` に `DATABASE_URL`, `APP_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` がある
- ローカル PostgreSQL が起動している
- `pnpm run db:migrate` が適用済みである

E2E 実行時は `.dev.vars` の後に `config/e2e.vars` を読み込みます。
これにより `APP_BASE_URL=http://127.0.0.1:8788` と `E2E_TEST_MODE=true` を上書きし、ローカル E2E 用 Worker だけで `__e2e` 補助 API を有効にします。

## E2E 補助 API

`/__e2e/*` は Playwright 専用の補助 API です。

- `POST /__e2e/login`
  テストユーザーを作成し、DB-backed session を発行します。
- `POST /__e2e/reset`
  `e2e:<testId>` のテストユーザーを削除します。

この API は `E2E_TEST_MODE=true` 以外では `404` を返します。
Google OAuth の実画面操作は E2E では行わず、OAuth start URL の生成と、ログイン後のコア導線を分けて検証します。

## 現在の E2E カバー範囲

- 未ログイン時にログイン画面が表示される
- Google OAuth start URL に `access_type=offline` が含まれない
- 初回ログイン後にオンボーディングを完了できる
- テンプレート習慣が Today view に表示される
- 認証済みユーザーが習慣を作成できる
- Today view でログを記録できる
- Today view で簡易レベル表示と達成時フィードバックが更新される
- Weekly view に集計が表示される
- Monthly view に集計が表示される

## Security Regression

Vitest の integration test では、少なくとも以下を固定します。

- `YYYY-MM-DD` と `YYYY-MM` の異常値が `400` で拒否される
- `500 INTERNAL_ERROR` に内部例外 message が露出しない
- 不正な `Origin` を持つ state-changing request が `403` になる
- `/healthz` と `/` に security header が付く
- auth route の rate limit 超過で `429 RATE_LIMITED` と `Retry-After` が返る
- Google ID token の JWKS 検証で invalid signature が拒否される

この領域は regress しやすいため、配信経路や middleware 順序を変えるときは必ず再確認します。
