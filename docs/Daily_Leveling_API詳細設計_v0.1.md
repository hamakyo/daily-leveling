# Daily Leveling API詳細設計 v0.1

## 1. 文書概要

### 1-1. 目的
本書は Daily Leveling MVP の API を、実装可能な粒度まで具体化するための詳細設計書である。  
対象は Cloudflare Workers 上で提供する API / BFF レイヤーであり、認証、習慣管理、日次ログ、ダッシュボード集約を扱う。

### 1-2. 対象範囲
- Google SSO 認証フローに関わる API
- セッション検証 API
- 習慣 CRUD API
- 日次ログ API
- ダッシュボード集約 API
- オンボーディング API

### 1-3. 非対象
- 管理者機能
- 複数認証プロバイダ
- 通知 API
- AI レビュー API
- ソーシャル共有 API

---

## 2. 共通仕様

## 2-1. ベース方針
- `/auth/google/start` と `/auth/google/callback` 以外は認証必須
- Cookie ベースセッションで認証状態を判定する
- レスポンスは JSON を基本とする
- OAuth 開始 / callback / 画面遷移系のみ 302 Redirect を返す
- すべての時刻は UTC 保存、表示用の日付解釈はユーザータイムゾーン基準

## 2-2. 共通レスポンス形式
### 正常系
エンドポイントごとのレスポンス形式に従う。  
一覧は配列をトップレベルのオブジェクト配下に持つ。

### 異常系
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "name is required."
  }
}
```

## 2-3. 共通エラーコード
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_INPUT`
- `INVALID_DATE`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## 2-4. 認証判定
認証必須 API では以下を満たす必要がある。

- セッション Cookie が存在する
- 対応する sessions レコードが存在する
- `revoked_at IS NULL`
- `expires_at > NOW()`

## 2-5. ユーザーコンテキスト
認証済み API ではサーバー内部で `currentUser` を解決し、全処理はそのユーザーに閉じる。  
クライアントから `userId` を受け取って対象ユーザーを切り替える設計は採用しない。

## 2-6. 日付・週の解釈
- 日次ログの `date` は `YYYY-MM-DD`
- 月次集計の `month` は `YYYY-MM`
- 週次集計は指定日を含む **月曜始まり** の週で計算する
- 頻度対象外の日は分母に含めない

---

## 3. 認証 API

## 3-1. GET `/auth/google/start`
### 目的
Google OAuth 認可フローを開始する。

### 認証
不要

### 処理概要
1. state 生成
2. PKCE 用 `code_verifier` / `code_challenge` 生成
3. 一時検証値を Cookie または一時領域に保存
4. Google 認可 URL を生成
5. 302 Redirect を返す

### レスポンス
- `302 Redirect`

### 異常系
- `INTERNAL_ERROR`: 認可 URL 生成失敗

---

## 3-2. GET `/auth/google/callback`
### 目的
Google 認可完了後の callback を処理し、アプリセッションを発行する。

### 認証
不要

### クエリパラメータ
- `code` (required)
- `state` (required)

### 処理概要
1. state 検証
2. authorization code を token に交換
3. ID token を検証
4. `google_sub` / `email` / `name` / `picture` を取得
5. users を upsert
6. 初回ユーザーなら user_settings の初期レコードを作成
7. sessions レコード作成
8. セッション Cookie 発行
9. onboarding 状態に応じてリダイレクト

### リダイレクト先
- `onboarding_completed = false` -> `/onboarding`
- `onboarding_completed = true` -> `/dashboard`

### レスポンス
- `302 Redirect`

### 異常系
- `UNAUTHORIZED`: state 不一致
- `UNAUTHORIZED`: token 検証失敗
- `INTERNAL_ERROR`: DB 保存失敗

---

## 3-3. GET `/auth/me`
### 目的
現在ログイン中のユーザー情報を返す。

### 認証
必須

### レスポンス例
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Otaku",
    "avatarUrl": "https://example.com/avatar.png",
    "onboardingCompleted": true,
    "timezone": "Asia/Tokyo",
    "defaultView": "today"
  }
}
```

### 備考
- `timezone` / `defaultView` は `user_settings` から返す
- 画面初期化時のセッション確認に利用する

### 異常系
- `UNAUTHORIZED`: セッションなし / 失効 / 期限切れ

---

## 3-4. POST `/auth/logout`
### 目的
セッションを失効させ、ログアウトする。

### 認証
必須

### 処理概要
1. 対象 session を revoke
2. セッション Cookie を削除
3. 成功レスポンスを返す

### レスポンス例
```json
{
  "ok": true
}
```

### 異常系
- `UNAUTHORIZED`: セッション不正
- `INTERNAL_ERROR`: revoke 失敗

---

## 4. オンボーディング API

## 4-1. POST `/onboarding/templates/apply`
### 目的
テンプレートから初期習慣を一括作成する。

### 認証
必須

### リクエスト例
```json
{
  "templateId": "health_basic"
}
```

### リクエスト仕様
- `templateId`: required
- MVP ではサーバー内固定テンプレートから選択する

### 処理概要
1. `templateId` を検証
2. テンプレート定義から habits を複数作成
3. display_order を採番して保存
4. 作成結果を返す

### レスポンス例
```json
{
  "createdHabits": [
    {
      "id": "uuid",
      "name": "Wake up early"
    },
    {
      "id": "uuid",
      "name": "Reading"
    }
  ]
}
```

### 異常系
- `INVALID_INPUT`: 不正な templateId
- `CONFLICT`: 想定外の重複
- `INTERNAL_ERROR`: 保存失敗

---

## 4-2. POST `/onboarding/complete`
### 目的
オンボーディング完了状態を更新する。

### 認証
必須

### リクエスト例
```json
{
  "completed": true
}
```

### 処理概要
1. `users.onboarding_completed` を `true` に更新
2. 成功レスポンスを返す

### レスポンス例
```json
{
  "ok": true
}
```

### 異常系
- `UNAUTHORIZED`
- `INTERNAL_ERROR`

---

## 5. 習慣 API

## 5-1. GET `/habits`
### 目的
習慣一覧を返す。

### 認証
必須

### クエリパラメータ
- `activeOnly`: optional, `true | false`

### デフォルト動作
- 指定なしの場合は全件返す
- UI 初期表示用途では `activeOnly=true` を推奨

### レスポンス例
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
      "displayOrder": 0,
      "createdAt": "2026-04-19T00:00:00Z",
      "updatedAt": "2026-04-19T00:00:00Z"
    }
  ]
}
```

### ソート
- `display_order ASC`

### 異常系
- `UNAUTHORIZED`

---

## 5-2. POST `/habits`
### 目的
新規習慣を作成する。

### 認証
必須

### リクエスト例
```json
{
  "name": "Gym",
  "emoji": "💪",
  "color": "green",
  "frequencyType": "weekly_days",
  "targetWeekdays": [1, 3, 5]
}
```

### バリデーション
- `name`: required, 1〜100文字
- `emoji`: optional
- `color`: optional
- `frequencyType`: required, `daily | weekly_days`
- `targetWeekdays`:
  - `daily` の場合は `null` または未指定
  - `weekly_days` の場合は required
  - 値は 1〜7 の整数のみ
  - 重複不可
  - 昇順に正規化して保存

### 処理概要
1. 入力検証
2. 既存最大 `display_order + 1` を採番
3. habits に insert
4. 作成結果を返す

### レスポンス例
```json
{
  "habit": {
    "id": "uuid",
    "name": "Gym",
    "emoji": "💪",
    "color": "green",
    "frequencyType": "weekly_days",
    "targetWeekdays": [1, 3, 5],
    "isActive": true,
    "displayOrder": 4
  }
}
```

### 異常系
- `INVALID_INPUT`
- `INTERNAL_ERROR`

---

## 5-3. PATCH `/habits/:habitId`
### 目的
習慣を更新する。

### 認証
必須

### パスパラメータ
- `habitId`: required

### リクエスト例
```json
{
  "name": "Morning Reading",
  "color": "indigo",
  "frequencyType": "daily",
  "targetWeekdays": null,
  "isActive": true
}
```

### 更新可能項目
- `name`
- `emoji`
- `color`
- `frequencyType`
- `targetWeekdays`
- `isActive`

### 更新不可項目
- `id`
- `userId`
- `displayOrder`
- `createdAt`

### 処理概要
1. 対象習慣が `currentUser` 所有か確認
2. 入力検証
3. update
4. 更新後レコードを返す

### レスポンス例
```json
{
  "habit": {
    "id": "uuid",
    "name": "Morning Reading",
    "emoji": "📚",
    "color": "indigo",
    "frequencyType": "daily",
    "targetWeekdays": null,
    "isActive": true,
    "displayOrder": 1
  }
}
```

### 異常系
- `NOT_FOUND`: 対象習慣なし
- `FORBIDDEN`: 他ユーザーの習慣
- `INVALID_INPUT`

---

## 5-4. POST `/habits/reorder`
### 目的
習慣の並び順を一括更新する。

### 認証
必須

### リクエスト例
```json
{
  "habitIds": ["uuid3", "uuid1", "uuid2"]
}
```

### バリデーション
- `habitIds`: required, array
- 配列内重複不可
- 配列要素はすべて `currentUser` の習慣であること
- 対象は通常 active habits を想定するが、実装では currentUser 所有で統一確認する

### 処理概要
1. 習慣所有確認
2. 先頭から順に `display_order` を再採番
3. 成功レスポンス返却

### レスポンス例
```json
{
  "ok": true
}
```

### 異常系
- `INVALID_INPUT`
- `FORBIDDEN`
- `NOT_FOUND`

---

## 6. ログ API

## 6-1. GET `/logs`
### 目的
指定期間のログ一覧を返す。

### 認証
必須

### クエリパラメータ
- `from`: required, `YYYY-MM-DD`
- `to`: required, `YYYY-MM-DD`

### バリデーション
- `from <= to`
- 期間上限は MVP では最大 62 日程度を想定
- 日付形式不正は `INVALID_INPUT`

### レスポンス例
```json
{
  "logs": [
    {
      "habitId": "uuid",
      "date": "2026-04-19",
      "status": true
    },
    {
      "habitId": "uuid",
      "date": "2026-04-20",
      "status": false
    }
  ]
}
```

### 用途
- 月間グリッド描画
- 週次表示
- 一括状態復元

### 異常系
- `INVALID_INPUT`
- `UNAUTHORIZED`

---

## 6-2. PUT `/habits/:habitId/logs/:date`
### 目的
指定習慣・指定日付のログを upsert する。

### 認証
必須

### パスパラメータ
- `habitId`: required
- `date`: required, `YYYY-MM-DD`

### リクエスト例
```json
{
  "status": true
}
```

### バリデーション
- `status`: required, boolean
- `date` は未来日不可
- 対象習慣が `currentUser` 所有であること
- `weekly_days` の場合、対象曜日外は拒否または UI で操作不可にする
- MVP では API 側でも対象曜日チェックを行う

### 処理概要
1. habit 所有確認
2. 日付妥当性確認
3. 頻度対象日判定
4. habit_logs を upsert
5. 更新結果を返す

### レスポンス例
```json
{
  "log": {
    "habitId": "uuid",
    "date": "2026-04-19",
    "status": true
  }
}
```

### 異常系
- `NOT_FOUND`: habit 不存在
- `FORBIDDEN`: 他ユーザー habit
- `INVALID_DATE`: 未来日 / 対象外曜日
- `INVALID_INPUT`

---

## 7. ダッシュボード API

## 7-1. GET `/dashboard/today`
### 目的
今日ビュー用の集約データを返す。

### 認証
必須

### レスポンス例
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
      "color": "blue",
      "status": true,
      "isTargetDay": true,
      "frequencyType": "daily"
    },
    {
      "habitId": "uuid2",
      "name": "Gym",
      "emoji": "💪",
      "color": "green",
      "status": null,
      "isTargetDay": false,
      "frequencyType": "weekly_days"
    }
  ]
}
```

### 集約仕様
- `targetCount`: 当日対象の active habits 数
- `completedCount`: 当日対象かつ `status=true` 数
- `progressRate`: `completedCount / targetCount * 100`
- 対象外習慣は `isTargetDay=false` で返す

### 異常系
- `UNAUTHORIZED`

---

## 7-2. GET `/dashboard/weekly`
### 目的
指定日を含む週の集約データを返す。

### 認証
必須

### クエリパラメータ
- `date`: required, `YYYY-MM-DD`

### 週の定義
- 指定日を含む月曜始まり〜日曜終わり

### レスポンス例
```json
{
  "week": {
    "startDate": "2026-04-13",
    "endDate": "2026-04-19"
  },
  "summary": {
    "completedCount": 12,
    "targetCount": 17,
    "progressRate": 70.6
  },
  "dailyStats": [
    {
      "date": "2026-04-13",
      "completedCount": 2,
      "targetCount": 3,
      "progressRate": 66.7
    }
  ],
  "habitStats": [
    {
      "habitId": "uuid",
      "name": "Reading",
      "completedCount": 6,
      "targetCount": 7,
      "progressRate": 85.7
    }
  ]
}
```

### 集約仕様
- active habits のみ対象
- 頻度対象日のみ分母に含める
- ログ未入力は未達として扱うか、単なる未実施として扱うかは UI 表現と切り分ける  
  MVP の集計上は **対象日で `status=true` のみ達成、その他は未達扱い** とする

### 異常系
- `INVALID_INPUT`
- `UNAUTHORIZED`

---

## 7-3. GET `/dashboard/monthly`
### 目的
月間ダッシュボード描画用の集約データを返す。

### 認証
必須

### クエリパラメータ
- `month`: required, `YYYY-MM`

### レスポンス例
```json
{
  "month": "2026-04",
  "summary": {
    "completedCount": 42,
    "targetCount": 60,
    "progressRate": 70,
    "currentStreak": 4
  },
  "habits": [
    {
      "habitId": "uuid",
      "name": "Reading",
      "emoji": "📚",
      "color": "blue",
      "frequencyType": "daily",
      "targetWeekdays": null,
      "displayOrder": 0
    }
  ],
  "logs": [
    {
      "habitId": "uuid",
      "date": "2026-04-01",
      "status": true
    }
  ],
  "dailyStats": [
    {
      "date": "2026-04-01",
      "completedCount": 2,
      "targetCount": 3,
      "progressRate": 66.7
    }
  ],
  "habitStats": [
    {
      "habitId": "uuid",
      "completedCount": 20,
      "targetCount": 30,
      "progressRate": 66.7
    }
  ]
}
```

### 集約仕様
- `logs` は月間グリッド描画のため返す
- `dailyStats` は各日付ごとの達成率
- `habitStats` は習慣別達成率
- `currentStreak` は別途定義したルールに従って計算

### 異常系
- `INVALID_INPUT`
- `UNAUTHORIZED`

---

## 8. 設定 API

## 8-1. GET `/settings`
### 目的
ユーザー設定を取得する。

### 認証
必須

### レスポンス例
```json
{
  "settings": {
    "timezone": "Asia/Tokyo",
    "defaultView": "today"
  }
}
```

---

## 8-2. PATCH `/settings`
### 目的
ユーザー設定を更新する。

### 認証
必須

### リクエスト例
```json
{
  "timezone": "Asia/Tokyo",
  "defaultView": "month"
}
```

### バリデーション
- `timezone`: IANA timezone 文字列
- `defaultView`: `today | month`

### レスポンス例
```json
{
  "settings": {
    "timezone": "Asia/Tokyo",
    "defaultView": "month"
  }
}
```

### 異常系
- `INVALID_INPUT`
- `UNAUTHORIZED`

---

## 9. バリデーション詳細

## 9-1. name
- 必須
- 前後空白 trim
- 空文字不可
- 最大 100 文字

## 9-2. color
- MVP では自由文字列でもよいが、実装ではプリセット列挙に寄せることを推奨

## 9-3. emoji
- optional
- 1絵文字前提だが、MVP では厳密制御しなくてもよい

## 9-4. targetWeekdays
- 配列必須（`weekly_days` の場合）
- 1〜7 の整数
- 重複禁止
- 昇順保存推奨

## 9-5. date / month
- `date`: `YYYY-MM-DD`
- `month`: `YYYY-MM`
- 不正書式は `INVALID_INPUT`

---

## 10. ステータスコード方針

- `200 OK`: 取得 / 更新成功
- `201 Created`: 新規作成成功
- `302 Found`: OAuth 開始 / callback のリダイレクト
- `400 Bad Request`: 入力不正
- `401 Unauthorized`: 未認証 / セッション不正
- `403 Forbidden`: 所有権違反
- `404 Not Found`: 対象なし
- `409 Conflict`: 重複 / 整合性衝突
- `429 Too Many Requests`: 将来のレート制御用
- `500 Internal Server Error`: 想定外エラー

---

## 11. 実装メモ

## 11-1. 集約 API
- フロント側で複数 API を合成しすぎないよう、`/dashboard/*` は画面単位の集約 API とする

## 11-2. ログ更新
- `PUT /habits/:habitId/logs/:date` は upsert 前提
- トグル UI との相性を優先する

## 11-3. 所有権確認
- `habitId` を含む API は必ず `currentUser` 所有確認を行う

## 11-4. セキュリティ
- セッション Cookie は HttpOnly
- セッショントークン平文保存禁止
- OAuth の state / PKCE 検証必須

---

## 12. 未決事項
- settings API を MVP 必須にするかどうか
- `progressRate` の丸め方（整数 / 小数1桁）
- streak 計算ルールの最終確定
- target 日に未入力だった場合の UI 表現
- テンプレート定義の固定方式（コード内定義 / DB 管理）

---

## 13. 次フェーズ候補
1. 実装タスク分解 v0.1
2. フロントエンド構成比較メモ
3. Codex 実装用プロンプト素案
4. 認証実装詳細メモ

---

## 14. 要約
Daily Leveling MVP の API は、認証、習慣、ログ、ダッシュボード、設定の5系統で構成する。  
CRUD はリソース中心、画面描画は集約 API 中心とし、Cloudflare Workers 上で BFF として実装する。  
この設計により、モバイルの今日ビューと PC の月間グリッドの両方をシンプルに支えられる。
