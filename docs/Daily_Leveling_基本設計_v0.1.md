# Daily Leveling 基本設計 v0.1

## 1. 文書概要

### 1-1. 目的
本書は Daily Leveling の MVP 開発に向けて、要件定義をもとに以下を整理した基本設計書である。

- システム全体像
- 認証フロー
- 画面遷移
- API 一覧
- データモデル要約
- 実装上の方針

### 1-2. 対象範囲
本書の対象は MVP であり、以下を中心に扱う。

- Google SSO による認証
- 習慣管理
- 日次ログ記録
- 月間 / 週次 / 今日ビューのダッシュボード
- Cloudflare Workers + PostgreSQL + Hyperdrive 構成

### 1-3. MVP の前提
- 認証は Google OAuth 2.0 / OpenID Connect のみ
- 本体 DB は PostgreSQL
- DB 接続は Hyperdrive を利用
- セッションは DB 保持型
- 習慣は boolean で達成 / 未達を記録
- 頻度は `daily` / `weekly_days` のみ

---

## 2. システム全体像

## 2-1. 構成概要
```text
[Browser / Mobile Web]
        |
        v
[Cloudflare Workers]
  - Auth callback
  - Session validation
  - API/BFF
        |
        v
[Hyperdrive]
        |
        v
[PostgreSQL]
  - users
  - sessions
  - user_settings
  - habits
  - habit_logs
```

## 2-2. 責務分担
### ブラウザ
- 画面描画
- ユーザー操作
- Cookie 付き API 呼び出し

### Workers
- Google OAuth callback 処理
- セッション検証
- 認可制御
- 習慣・ログ API 提供
- 月次 / 週次 / 今日ビュー向け集約レスポンス生成

### PostgreSQL
- 永続化
- 制約による整合性担保
- 集計クエリの実行

---

## 3. 認証設計

## 3-1. 方針
- Google SSO（OAuth 2.0 / OIDC）を利用する
- OAuth callback は Workers で受ける
- ID トークンはサーバー側で検証する
- ユーザーの外部識別子は `google_sub` を利用する
- セッションは `sessions` テーブルで保持する
- Cookie は `HttpOnly`, `Secure`, `SameSite=Lax` を前提とする

## 3-2. 認証フロー図
```text
[未ログイン]
    |
    | GET /auth/google/start
    v
[Workers]
    |
    | state / PKCE 生成
    | 認可 URL 作成
    v
[Google 認可画面]
    |
    | 認可成功
    v
GET /auth/google/callback?code=...&state=...
    |
    v
[Workers]
    |- state 検証
    |- code -> token 交換
    |- ID token 検証
    |- google_sub, email, name, picture 取得
    |- users upsert
    |- sessions 作成
    |- session cookie 発行
    v
[ログイン済み]
    |
    +--> GET /auth/me
    |
    +--> POST /auth/logout
            |
            |- session revoke
            |- cookie 削除
            v
          [未ログイン]
```

## 3-3. 認証時の主な処理
### ログイン開始
- state 生成
- PKCE 用 code_verifier / code_challenge 生成
- 一時情報を Cookie またはサーバー側一時領域に保持
- Google 認可 URL へリダイレクト

### コールバック
- state 検証
- 認可コードをトークンへ交換
- ID トークンを検証
- `google_sub` をキーに users を upsert
- sessions レコードを作成
- セッション Cookie を返却
- 初回利用時はオンボーディングへ遷移

### ログアウト
- sessions を revoke
- セッション Cookie を削除

## 3-4. セッション設計
### sessions テーブルで持つもの
- `user_id`
- `session_token_hash`
- `expires_at`
- `revoked_at`
- `last_seen_at`

### セッション有効条件
- `revoked_at IS NULL`
- `expires_at > NOW()`

### 有効期限
- MVP では 7 日〜14 日程度を想定
- 詳細値は実装時に最終確定する

---

## 4. 画面設計

## 4-1. 画面一覧
1. ログイン画面
2. オンボーディング画面
3. ダッシュボード画面（PC）
4. ダッシュボード画面（モバイル）
5. 習慣作成 / 編集画面
6. 設定画面

## 4-2. 画面遷移図
```text
[ログイン画面]
    |
    | Google ログイン成功
    v
[初回判定]
    |-- onboarding_completed = false --> [オンボーディング画面]
    |                                       |
    |                                       | 完了
    |                                       v
    |----------------------------------> [ダッシュボード]
                                            |
                                            +--> [習慣作成 / 編集]
                                            |
                                            +--> [設定]
                                            |
                                            +--> [ログアウト]
                                                    |
                                                    v
                                                [ログイン画面]
```

## 4-3. 画面ごとの役割

### ログイン画面
**役割**
- Google SSO の入口

**主な要素**
- アプリ名 / ロゴ
- Google でログインボタン
- アプリ説明

---

### オンボーディング画面
**役割**
- 初回利用時の習慣登録

**主な要素**
- テンプレート選択
- 習慣の手動追加
- 完了ボタン

---

### ダッシュボード画面（PC）
**役割**
- 月間グリッド中心に進捗を一覧管理する

**主な要素**
- 月切替
- 月間総達成率
- current streak
- 習慣 × 日付の月間グリッド
- 日別達成率
- 習慣別達成率

---

### ダッシュボード画面（モバイル）
**役割**
- 今日の入力を最短操作で行う

**主な要素**
- 今日ビュー（デフォルト）
- 月間ビュー切替
- 今日の達成率
- 習慣一覧
- 各習慣のトグル

---

### 習慣作成 / 編集画面
**役割**
- 習慣マスタの登録・更新

**主な要素**
- 習慣名
- 絵文字
- 色
- 頻度
- 曜日指定
- アクティブ切替
- 保存ボタン

---

### 設定画面
**役割**
- ユーザー設定の管理

**主な要素**
- タイムゾーン
- デフォルト表示
- ログアウト

---

## 5. API 設計

## 5-1. API 設計方針
- CRUD はリソース中心
- ダッシュボード表示は集約 API を提供
- `/auth/google/start` と `/auth/google/callback` 以外は認証必須
- エラー形式は共通化する

## 5-2. API 一覧

### 認証系
| Method | Path | 用途 |
|---|---|---|
| GET | `/auth/google/start` | Google ログイン開始 |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/me` | 現在ログイン中のユーザー取得 |
| POST | `/auth/logout` | ログアウト |

### オンボーディング系
| Method | Path | 用途 |
|---|---|---|
| POST | `/onboarding/templates/apply` | テンプレート適用 |
| POST | `/onboarding/complete` | オンボーディング完了 |

### 習慣系
| Method | Path | 用途 |
|---|---|---|
| GET | `/habits` | 習慣一覧取得 |
| POST | `/habits` | 習慣作成 |
| PATCH | `/habits/:habitId` | 習慣更新 |
| POST | `/habits/reorder` | 並び順更新 |

### ログ系
| Method | Path | 用途 |
|---|---|---|
| GET | `/logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | 指定期間ログ取得 |
| PUT | `/habits/:habitId/logs/:date` | 日次ログ upsert |

### ダッシュボード系
| Method | Path | 用途 |
|---|---|---|
| GET | `/dashboard/today` | 今日ビュー取得 |
| GET | `/dashboard/weekly?date=YYYY-MM-DD` | 週次ダッシュボード取得 |
| GET | `/dashboard/monthly?month=YYYY-MM` | 月次ダッシュボード取得 |

## 5-3. 主な API 詳細

### GET `/auth/me`
**目的**
- 現在ログイン中のユーザーを返す

**レスポンス例**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Otaku",
    "avatarUrl": "https://example.com/avatar.png",
    "onboardingCompleted": true
  }
}
```

---

### GET `/habits`
**目的**
- ユーザーの習慣一覧を返す

**クエリ**
- `activeOnly=true` は任意

**レスポンス例**
```json
{
  "habits": [
    {
      "id": "uuid",
      "name": "Reading",
      "emoji": "📚",
      "color": "blue",
      "frequencyType": "daily",
      "targetWeekdays": null,
      "isActive": true,
      "displayOrder": 0
    }
  ]
}
```

---

### POST `/habits`
**目的**
- 習慣作成

**リクエスト例**
```json
{
  "name": "Gym",
  "emoji": "💪",
  "color": "green",
  "frequencyType": "weekly_days",
  "targetWeekdays": [1, 3, 5]
}
```

**バリデーション**
- `name` 必須
- `frequencyType` は `daily` / `weekly_days`
- `weekly_days` の場合 `targetWeekdays` 必須

---

### PATCH `/habits/:habitId`
**目的**
- 習慣更新

**更新対象**
- `name`
- `emoji`
- `color`
- `frequencyType`
- `targetWeekdays`
- `isActive`

---

### POST `/habits/reorder`
**目的**
- 並び順更新

**リクエスト例**
```json
{
  "habitIds": ["uuid3", "uuid1", "uuid2"]
}
```

---

### PUT `/habits/:habitId/logs/:date`
**目的**
- 1 日分のログを upsert する

**リクエスト例**
```json
{
  "status": true
}
```

**ルール**
- 未来日は不可
- 対象外曜日は入力拒否または UI 側で無効化
- 既存ログがあれば update、なければ insert

**レスポンス例**
```json
{
  "log": {
    "habitId": "uuid",
    "date": "2026-04-19",
    "status": true
  }
}
```

---

### GET `/dashboard/today`
**目的**
- モバイル向け今日ビューを返す

**レスポンス例**
```json
{
  "date": "2026-04-19",
  "summary": {
    "completedCount": 3,
    "targetCount": 5,
    "progressRate": 60
  },
  "habits": [
    {
      "habitId": "uuid",
      "name": "Reading",
      "emoji": "📚",
      "status": true,
      "isTargetDay": true
    }
  ]
}
```

---

### GET `/dashboard/weekly?date=YYYY-MM-DD`
**目的**
- 指定日を含む週のサマリを返す

**含める情報**
- 週開始日 / 終了日
- 日別達成率
- 習慣別達成率
- 週次総達成率

---

### GET `/dashboard/monthly?month=YYYY-MM`
**目的**
- 月間画面向けの集約データを返す

**含める情報**
- 月情報
- 習慣一覧
- 月内ログ
- 日別達成率
- 習慣別達成率
- 月間総達成率
- current streak

## 5-4. エラーレスポンス形式
```json
{
  "error": {
    "code": "INVALID_DATE",
    "message": "Future dates are not allowed."
  }
}
```

## 5-5. 代表的なエラーコード
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_INPUT`
- `INVALID_DATE`
- `CONFLICT`
- `INTERNAL_ERROR`

---

## 6. データモデル要約

## 6-1. エンティティ一覧
- `users`
- `user_settings`
- `sessions`
- `habits`
- `habit_logs`

## 6-2. リレーション
```text
users
 ├─< sessions
 ├─< habits
 ├─< habit_logs
 └─1 user_settings

habits
 └─< habit_logs
```

## 6-3. テーブル要約

### users
- Google SSO の外部識別子 `google_sub` を保持
- ユーザー本体

### user_settings
- タイムゾーン
- デフォルト表示

### sessions
- セッションハッシュ
- 有効期限
- revoke 状態

### habits
- 習慣定義
- 頻度
- 曜日
- 表示順
- アクティブ状態

### habit_logs
- 日次実績
- `UNIQUE(user_id, habit_id, log_date)`

---

## 7. 集計設計

## 7-1. 日次
- 今日の対象習慣数
- 今日の達成数
- 今日の達成率

## 7-2. 週次
- 週は月曜始まり
- ユーザーのタイムゾーン基準
- 頻度対象日のみ母数に含める
- 今週の総達成率
- 習慣別週次達成率
- 日別達成率

## 7-3. 月次
- 月間総達成率
- 日別達成率
- 習慣別達成率
- current streak

## 7-4. 計算方式
- MVP では事前集計テーブルを持たず都度クエリで計算する
- 必要に応じて将来 materialized view やキャッシュを導入する

---

## 8. 実装上の重要方針

## 8-1. 習慣削除
- MVP では物理削除より `is_active = false` を基本運用とする
- 過去ログの整合性を維持する

## 8-2. タイムゾーン
- 日付境界はユーザーのローカル日付基準
- DB 保存時刻は UTC
- 表示時にユーザータイムゾーンへ変換する

## 8-3. セキュリティ
- 未認証アクセス拒否
- Cookie は HttpOnly
- セッショントークン平文保存禁止
- Google ID トークンはサーバー側検証

## 8-4. バリデーション
- 未来日のログ記録不可
- 曜日指定外の日は記録対象外
- `weekly_days` は 1〜7 の曜日値のみ許容

---

## 9. 未決事項
- フロントエンド実装方式の最終決定
  - Next.js on Workers
  - React SPA + Hono
- セッション有効期限の最終値
- モバイル月間グリッドの具体UI
- 色選択UI / 絵文字選択UI
- ログ未入力時の扱いを UI 上どう見せるか
- current streak の厳密定義

---

## 10. 次フェーズ
次フェーズでは以下を作成する。

1. API 詳細設計書 v0.1
2. 認証実装方針メモ
3. フロントエンド構成比較
4. 実装タスク分解
5. Codex 実装用プロンプト素案

---

## 11. 要約
Daily Leveling の MVP 基本設計として、以下を整理した。

- Cloudflare Workers + PostgreSQL + Hyperdrive の全体像
- Google SSO と DB セッションによる認証フロー
- 主要画面と画面遷移
- 習慣・ログ・ダッシュボード API
- MVP に必要なデータモデルと集計方針

この状態で、実装前に必要な土台はかなり揃っており、次は API 詳細化または実装タスク分解へ進める。
