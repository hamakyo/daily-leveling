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

## ユーザーデータ分離

API はデータスコープ用の `userId` を client から受け取りません。
すべての habit/log/settings 操作は session から解決した `currentUser.id` を使います。
habit log は API 側で habit 所有権、未来日、対象曜日を検証してから upsert します。
