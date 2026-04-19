# Daily Leveling PostgreSQL DDL草案 v0.1

## 1. 目的
Daily Leveling の MVP 向けに、現時点の ER 設計を PostgreSQL の DDL に落とした草案。  
対象は以下の5テーブル。

- users
- user_settings
- sessions
- habits
- habit_logs

---

## 2. 設計方針

### 2-1. 採用方針
- 主キーは UUID
- `updated_at` は trigger で自動更新
- 習慣削除は MVP では物理削除より `is_active = false` を基本運用とする
- セッショントークンは平文保存せず、ハッシュのみ保存する
- 曜日は `1=Mon ... 7=Sun` で統一する

### 2-2. 認証まわり
- Google SSO の外部識別子は `users.google_sub` に保持
- セッションは `sessions` テーブルで管理
- Cookie 側には対応するセッション識別情報のみを持たせる前提

### 2-3. 頻度まわり
- `frequency_type` は `daily` / `weekly_days` の2種
- `weekly_days` の場合のみ `target_weekdays` を持つ
- 頻度対象外の日は達成率母数に含めない

---

## 3. テーブル概要

## 3-1. users
アプリ内ユーザー本体。Google SSO の `google_sub` を一意に保持する。

主要カラム:
- `id`
- `google_sub`
- `email`
- `display_name`
- `avatar_url`
- `onboarding_completed`

## 3-2. user_settings
ユーザーごとの設定。MVP ではタイムゾーンとデフォルト表示モードを持つ。

主要カラム:
- `user_id`
- `timezone`
- `default_view`

## 3-3. sessions
ログイン状態を保持する。失効、期限切れ、ログアウトをサーバー側で判定可能にする。

主要カラム:
- `user_id`
- `session_token_hash`
- `expires_at`
- `revoked_at`
- `last_seen_at`

## 3-4. habits
習慣マスタ。表示順、頻度、色、絵文字、アクティブ状態を持つ。

主要カラム:
- `user_id`
- `name`
- `emoji`
- `color`
- `frequency_type`
- `target_weekdays`
- `is_active`
- `display_order`

## 3-5. habit_logs
習慣の日次実績。1ユーザー・1習慣・1日につき1レコードまで。

主要カラム:
- `user_id`
- `habit_id`
- `log_date`
- `status`

一意制約:
- `UNIQUE (user_id, habit_id, log_date)`

---

## 4. インデックス方針

- `users.google_sub` は一意インデックス
- `sessions.session_token_hash` は一意インデックス
- `sessions.user_id`, `sessions.expires_at` にインデックス
- `habits(user_id, is_active, display_order)` にインデックス
- `habit_logs(user_id, log_date)` にインデックス
- `habit_logs(habit_id, log_date)` にインデックス

---

## 5. 整合性方針

### 5-1. habit_logs と habits の user_id 一致
`habit_logs.user_id` と `habits.user_id` の不整合を防ぐため、trigger で一致を強制する。

### 5-2. 習慣削除
`habit_logs.habit_id` は `ON DELETE RESTRICT`。  
MVP では習慣を物理削除せず、`is_active = false` で運用する前提に寄せる。

### 5-3. セッション有効判定
有効セッションの条件は以下。

- `revoked_at IS NULL`
- `expires_at > NOW()`

---

## 6. 補足
この草案は MVP 向け。将来的には以下を追加検討できる。

- 週次 / 月次集計用 materialized view
- 通知設定テーブル
- AIレビュー履歴テーブル
- 監査ログ
- 複数認証プロバイダ対応

---

## 7. SQLファイル
同梱ファイル:
- `daily_leveling_schema_v0_1.sql`
