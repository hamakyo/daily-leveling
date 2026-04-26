# Daily Leveling MVP 仕様

## 目的

このファイルは Daily Leveling の MVP を実装するための仕様書です。
現在の要件定義、DDL、基本設計、API 詳細設計を統合し、
実装開始に必要な最小限の曖昧さを解消した内容をまとめています。

参照元ドキュメント:
- `docs/Daily_Leveling_要件定義_v0.2.md`
- `docs/Daily_Leveling_PostgreSQL_DDL草案_v0.1.md`
- `docs/daily_leveling_schema_v0_1.sql`
- `docs/Daily_Leveling_基本設計_v0.1.md`
- `docs/Daily_Leveling_API詳細設計_v0.1.md`

旧来ドキュメントと矛盾する場合は、このファイルを優先します。

## プロダクト概要

Daily Leveling は次の体験に特化した習慣トラッカーです。
- 日々の素早いチェックイン
- 月間グリッドでの可視化
- シンプルな進捗フィードバック

これはタスク管理アプリではありません。MVP は習慣管理のみを扱います。

## 固定済みアーキテクチャ判断

- フロントエンド: React SPA
- BFF/API: Hono on Cloudflare Workers
- データベース: PostgreSQL
- DB 接続経路: Cloudflare Hyperdrive。local dev、migration、fallback 用に `DATABASE_URL` も維持する
- 認証プロバイダ: Google OAuth 2.0 / OpenID Connect のみ
- セッション方式: DB-backed sessions と opaque cookie token

## 固定済みドメイン判断

- 外部ユーザー識別子は `google_sub`
- アプリ内ユーザーの主キーは内部 `users.id`
- ユーザーの timezone は `user_settings.timezone` に保持する
- MVP における習慣削除は `is_active = false` による archive を意味する
- 通常 UI フローでは習慣の物理削除は行わない
- 習慣頻度タイプは `daily` と `weekly_days` のみ
- 曜日表現は `1=Mon ... 7=Sun`
- 習慣ログは `user_id + habit_id + log_date` で一意
- 未来日は表示してよいが書き込みは禁止
- DB の timestamp は UTC で保存する
- 日付境界はユーザーの timezone で解釈する

## 固定済み集計ルール

- 母数には target day のみを含める
- 集計上は `status = true` を達成とみなす
- 集計上は target day に `true` のログがない場合は未達成とみなす
- `progressRate` は百分率で小数 1 桁に丸めて返す
- `currentStreak` は今日まで連続するユーザー現地日ベースの日数で、以下を満たすものとする
  - その日に少なくとも 1 つ target habit がある
  - その日の target habit がすべて達成されている

## MVP 必須ユーザーフロー

1. ユーザーが Google ログインを開始する
2. ユーザーが OAuth callback を完了し、session cookie を受け取る
3. 初回ユーザーは onboarding に遷移する
4. ユーザーはテンプレート適用または手動追加で習慣を作成する
5. ユーザーは onboarding を完了する
6. ユーザーは今日の習慣一覧を見て達成状態を切り替えられる
7. ユーザーは月間ダッシュボードを開いて以下を確認できる
   - 月間合計進捗
   - 日別進捗
   - 習慣別進捗
   - current streak
8. ユーザーは習慣の編集、並び替え、archive を行える
9. ユーザーはログアウトできる

## API スコープ

MVP のコア API:
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

二次 API:
- `GET /settings`
- `PATCH /settings`
- `GET /dashboard/weekly`

必要であれば、二次 API は最初の usable MVP 後に出してよいものとします。

## データモデル

必須テーブル:
- `users`
- `user_settings`
- `sessions`
- `habits`
- `habit_logs`

主な schema 制約:
- `users.google_sub` は一意
- `user_settings.user_id` は一意
- `sessions.session_token_hash` は一意
- `habit_logs(user_id, habit_id, log_date)` は一意
- `habits.frequency_type` は `daily` または `weekly_days`

実装メモ:
- SQL 草案の weekday array バリデーションは、
  壊れやすい inline `CHECK` ではなく PostgreSQL で安全に扱える方法で実装すること

## バリデーションルール

- `name`: 必須、trim 後で 1 文字以上 100 文字以下
- `frequencyType`: 必須、`daily | weekly_days`
- `targetWeekdays`:
  - `daily` のときは未指定または null でなければならない
  - `weekly_days` のときは必須
  - `1..7` の重複しない整数でなければならない
  - 昇順に正規化する
- `date`: `YYYY-MM-DD`
- `month`: `YYYY-MM`
- `defaultView`: `today | month`
- `timezone`: 有効な IANA timezone

## セキュリティルール

- Google auth start/callback 以外の全 API は認証必須
- Session cookie は `HttpOnly`, `Secure`, `SameSite=Lax`
- Session cookie に平文の session hash を入れてはならない
- Session の `last_seen_at` 更新は `executionCtx.waitUntil()` で response をブロックしない
- Session 有効判定には以下をすべて満たす必要がある
  - cookie が存在する
  - session record が存在する
  - `revoked_at IS NULL`
  - `expires_at > NOW()`
- Habit スコープ API では所有権チェックを必須にする
- API は scoping 用に client 提供の `userId` を受け取らない
- Google OAuth では refresh token を保存しないため `access_type=offline` を要求しない

## UX 優先順位

- 日次チェックインは mobile first
- 月間ダッシュボードは desktop first
- 今日のトグル操作は即時に感じられること
- 月間グリッドの表示は通常条件でおおむね 1 秒程度に収まること
- 未達成に対して罰するような文言は避けること

## コア MVP から除外するもの

- 通知
- XP、バッジ、通貨、レベル要素
- ソーシャル機能
- AI レビュー機能
- カレンダー連携
- Widget や PWA 対応
- 習慣の物理削除

## MVP 受け入れ条件

- Google ログインが end-to-end で動作する
- 初回ユーザーが onboarding を完了できる
- 習慣の作成、更新、並び替え、archive ができる
- 今日のチェックインができる
- 月間ダッシュボードが動作する
- 月間合計進捗、日別進捗、習慣別進捗、streak が見える
- モバイルとデスクトップの両方で実用になる
