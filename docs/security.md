# Daily Leveling セキュリティ設計

## 認証

認証プロバイダは Google OAuth 2.0 / OpenID Connect のみです。
OAuth start では `state` と PKCE を使い、callback で state と code verifier を検証します。
refresh token は保存しないため、Google 認可 URL では `access_type=offline` を要求しません。

ID token は Worker 内で Google JWKS を使ってローカル検証します。
署名方式は `RS256` のみ許可し、JWT header の `alg` と `kid` を確認したうえで、
Google 公開鍵を `crypto.subtle.verify()` へ渡して署名を検証します。
claims では `iss`, `aud`, `sub`, `email`, `email_verified`, `exp` を必須検証します。

JWKS は module scope で cache し、Google の `Cache-Control: max-age=...` を優先して TTL を決めます。
有効 cache が無い状態で JWKS 再取得に失敗した場合は fail-closed とし、認証を拒否します。

## Auth Rate Limit

auth 系 endpoint には Cloudflare KV を使った固定窓 rate limit を入れます。
binding 名は `AUTH_RATE_LIMITS` です。

対象 route:
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `POST /auth/logout`

キーは `route + clientIp + minuteBucket` です。
client IP は `CF-Connecting-IP` を優先し、無ければ `X-Forwarded-For` の先頭を使います。

現在の制限値:
- `/auth/google/start`: `10 req / 1 min / IP`
- `/auth/google/callback`: `10 req / 1 min / IP`
- `/auth/logout`: `30 req / 1 min / IP`

超過時は `429 RATE_LIMITED` と `Retry-After` header を返します。

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
