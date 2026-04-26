# Daily Leveling アーキテクチャ

## 概要

Daily Leveling は React SPA、Hono on Cloudflare Workers、PostgreSQL で構成する習慣トラッカー MVP です。
Worker runtime の DB 接続は `HYPERDRIVE` binding を優先し、local dev と migration では `DATABASE_URL` を使います。

```mermaid
flowchart LR
    browser["React SPA"]
    worker["Cloudflare Workers\nHono API / BFF"]
    routes["src/worker/routes\nroute modules"]
    auth["src/auth\nGoogle OAuth / Session"]
    repositories["src/db/repositories\nDomain repositories"]
    hyperdrive["Cloudflare Hyperdrive\nHYPERDRIVE"]
    postgres["PostgreSQL"]

    browser --> worker
    worker --> routes
    routes --> auth
    routes --> repositories
    repositories --> hyperdrive
    hyperdrive --> postgres
```

## 主要な責務境界

- `src/worker/app.ts` は error handler、404、healthz、route mount だけを持つ。
- `src/worker/routes/*` は URL、method、request validation、response shape を扱う。
- `src/db/repositories/*` は domain ごとの SQL と mapper を扱う。
- `src/domain/*` は target day、集計、template、validation の純粋なドメインルールを扱う。
- `src/web/api.ts` は frontend からの API 呼び出しを集約する。
- `src/web/pages` は画面単位の state と orchestration を持つ。
- `src/web/components` は表示とフォーム部品を持つ。

## DB 接続

`src/db/client.ts` は次の順序で接続文字列を解決します。

1. `env.HYPERDRIVE?.connectionString`
2. `env.DATABASE_URL`
3. どちらも無ければ `DB_MISCONFIGURED` で fail fast

`DATABASE_URL` は廃止しません。migration、local dev、Hyperdrive 作成元、緊急時の fallback として残します。
