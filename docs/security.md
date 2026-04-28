# Daily Leveling セキュリティ設計

## 認証

認証プロバイダは Google OAuth 2.0 / OpenID Connect のみです。
OAuth start では `state` と PKCE を使い、callback で state と code verifier を検証します。
refresh token は保存しないため、Google 認可 URL では `access_type=offline` を要求しません。

ID token 検証は現時点では Google `tokeninfo` endpoint を使います。
検証対象は `iss`、`aud`、`sub`、`email`、`email_verified` です。
JWKS によるローカル検証は次フェーズの hardening 対象です。

## Session

Session は DB-backed sessions です。
Cookie には opaque token のみを入れ、DB には token の hash だけを保存します。

認証済み API の session 判定条件:
- Cookie が存在する
- `sessions.session_token_hash` に一致する record が存在する
- `revoked_at IS NULL`
- `expires_at > NOW()`

`last_seen_at` の更新はレスポンスをブロックしないように `executionCtx.waitUntil()` に渡します。
更新に失敗した場合は `console.error` に記録しますが、認証済みレスポンス自体は失敗させません。

## CSRF / Request Origin

Cookie ベース認証のため、state-changing request は `SameSite=Lax` だけに依存しません。
`POST`, `PUT`, `PATCH`, `DELETE` では Worker 側で `Origin` または `Referer` を確認し、
`APP_BASE_URL` と同一 origin の場合だけ処理します。

例外:
- `GET`, `HEAD`, `OPTIONS`
- `E2E_TEST_MODE=true` のときの `__e2e/*`

不正な request 元は `403 FORBIDDEN` で拒否します。

## Security Headers

API response と静的 HTML response の両方に、最低限以下を付与します。

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

静的 asset 配信も Worker first にして、`ASSETS.fetch()` の response に同じ header を適用します。

## Error Handling

`500 INTERNAL_ERROR` では内部例外の `message` を外部へ返しません。
詳細は server log にだけ残し、client には汎用 message を返します。

## ユーザーデータ分離

API はデータスコープ用の `userId` を client から受け取りません。
すべての habit/log/settings 操作は session から解決した `currentUser.id` を使います。
habit log は API 側で habit 所有権、未来日、対象曜日を検証してから upsert します。
