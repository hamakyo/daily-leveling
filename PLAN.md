# Daily Leveling MVP 実装計画

## 目標

`SPEC.md` を満たす、最小限で本番運用を見据えた MVP を構築すること。

## 実装順

### Phase 0: Workspace Bootstrap

成果物:
- Worker アプリの scaffold
- React SPA の scaffold
- TypeScript、lint、test、formatting のセットアップ
- 環境変数の取り扱い
- ローカル開発設定と deploy 設定

完了条件:
- アプリがローカルで起動する
- Worker の 1 ルートが応答する
- 選択したアプリ構成を通じて React ページが 1 つ描画される

### Phase 1: Database and Migrations

成果物:
- migration フォルダ
- 初期 schema migration
- ローカル開発用の seed 方針
- DB access module

重要判断:
- `google_id` ではなく `google_sub` を使う
- `users.timezone` ではなく `user_settings.timezone` を使う
- 習慣削除は `is_active = false` による soft delete とする

完了条件:
- 5 つのコアテーブルがすべて migrate できる
- index と trigger が存在する
- session と habit log の一意性が強制される

### Phase 2: Shared Domain and Validation

成果物:
- schema validation layer
- auth/session helper
- timezone/date helper
- frequency target-day helper
- progress-rate helper
- streak helper
- 共通エラーレスポンス形式

完了条件:
- すべての request payload を集中的にバリデーションできる
- すべての日付ロジックが user timezone ベースになる
- 集計ルールが `SPEC.md` と一致する

### Phase 3: Authentication

成果物:
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`

実装メモ:
- `state` と PKCE を使う
- ID token はサーバー側で検証する
- 初回ログイン時に `users` と `user_settings` を作成する
- 成功時に DB session と opaque auth cookie を作成する

完了条件:
- ログインが end-to-end で動作する
- ログアウトで session が失効する
- 保護された API が `currentUser` を解決できる

### Phase 4: Onboarding and Templates

成果物:
- コード上の template 定義
- `POST /onboarding/templates/apply`
- `POST /onboarding/complete`

完了条件:
- 初回ユーザーが starter habits を受け取れる
- onboarding 完了がログイン後の redirect 挙動に反映される

### Phase 5: Habit Management

成果物:
- `GET /habits`
- `POST /habits`
- `PATCH /habits/:habitId`
- `POST /habits/reorder`

実装メモ:
- reorder で `display_order` を更新する
- archive は `is_active = false` で表現する
- 他ユーザーの habit には絶対にアクセスさせない

完了条件:
- habit を一覧取得、作成、編集、並び替え、archive できる

### Phase 6: Habit Logs

成果物:
- `GET /logs`
- `PUT /habits/:habitId/logs/:date`

実装メモ:
- 未来日は拒否する
- 対象外曜日は拒否する
- `user_id + habit_id + log_date` で upsert する

完了条件:
- 今日と過去日のログを安全に書き込める
- 月間グリッド用データを日付範囲で取得できる

### Phase 7: Dashboard Aggregates

成果物:
- `GET /dashboard/today`
- `GET /dashboard/monthly`

実装メモ:
- 画面単位の payload を返す
- 集計は raw table から計算し、事前集計 table は使わない
- 母数には active habit のみを含める

完了条件:
- mobile の today view が 1 回の API 呼び出しで描画できる
- monthly view が 1 回の API 呼び出しで描画できる

### Phase 8: Web UI

成果物:
- ログイン画面
- オンボーディング画面
- ダッシュボード画面
- habit 作成/編集 UI
- settings 画面の shell

優先順:
1. login
2. onboarding
3. mobile today view
4. desktop monthly view
5. habit editor
6. settings

完了条件:
- モックなしでユーザージャーニー全体がブラウザ上で動作する

### Phase 9: Secondary Endpoints

成果物:
- `GET /settings`
- `PATCH /settings`
- `GET /dashboard/weekly`

完了条件:
- settings を編集できる
- コアアーキテクチャを変えずに weekly aggregate を提供できる

### Phase 10: QA and Deployment

成果物:
- helper に対する unit test
- auth、habits、logs、dashboard の API test
- Playwright CLI によるブラウザ E2E test
- 手動テスト checklist
- deploy 設定と secrets checklist

重点的に検証すべき高リスク領域:
- OAuth callback の edge case
- timezone またぎの日付境界挙動
- 曜日 target バリデーション
- log upsert の idempotency
- streak 計算
- archive 済み habit の集計除外
- ログイン後の onboarding / today / monthly のブラウザ導線

完了条件:
- `SPEC.md` のコア受け入れ条件を満たす
- deploy 後のアプリでログインとデータ保存ができる
- `pnpm run test:e2e` で主要ブラウザ導線が通る

### Phase 11: Consistency and Maintainability Hardening

成果物:
- `HYPERDRIVE` binding を優先する DB 接続解決
- `executionCtx.waitUntil()` による session touch
- Google OAuth start から不要な offline access 要求を削除
- Hono route の `auth / onboarding / habits / logs / dashboard / settings` 分割
- DB repository の `users / sessions / habits / logs / onboarding / settings` 分割
- React UI の `pages / components / api.ts` 分割
- README と docs の運用説明更新

完了条件:
- API URL、method、response shape を変えずに分割後のテストが通る
- `HYPERDRIVE.connectionString` が `DATABASE_URL` より優先される
- `DATABASE_URL` は local dev、migration、fallback として引き続き使える
- UI は日本語、sans-serif、グラデーションなしの現行方針を維持する

## Stop-the-Line ルール

以下がコード上で固まるまで feature work を先に進めないこと:
- timezone 境界ロジック
- session cookie 形式と session lookup
- streak 定義
- soft-delete の挙動

## コア MVP が動くまで対象外

- バッジ、XP、ゲーム経済
- 通知
- AI 機能
- ソーシャル機能
- 外部連携
- PWA 対応

## 推奨する最初の縦切り実装

まずは以下の縦切りを作る:
1. schema
2. auth
3. habit を 1 つ作成
4. 今日の log を切り替える
5. 今日の summary を描画する

その後に monthly aggregate と残りの UI を作る。
