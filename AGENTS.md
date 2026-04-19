# AGENTS.md

## 目的

このリポジトリは現在、設計ドキュメントを起点に構築されています。
このファイルは実装エージェント向けの作業契約として扱います。

読む順序:
1. `SPEC.md`
2. `PLAN.md`
3. さらに詳細が必要な場合だけ `docs/` 配下の関連ファイル

ドキュメント間で矛盾がある場合の優先順位:
1. `SPEC.md`
2. `PLAN.md`
3. `docs/` 配下の最新設計書

## プロジェクト制約

- これはタスクマネージャーではなく habit tracker である
- MVP のスコープは狭く保つ
- アーキテクチャはシンプルかつ本番運用を意識した形にする
- コアフローが完成する前にスコープを広げる機能を追加しない

## 固定済み技術判断

- クライアントには React SPA を使う
- API/BFF には Cloudflare Workers 上の Hono を使う
- 正本データストアは PostgreSQL とする
- セッションは DB-backed sessions を使う
- 認証は Google OAuth のみ
- パッケージマネージャーは `pnpm`
- UI のフォントスタックは sans-serif のみを使う

導入しないもの:
- Next.js
- 2 つ目の認証プロバイダ
- client-managed auth token
- 2 つ目のデータベース

## 固定済みドメイン判断

- `google_id` ではなく常に `google_sub` を使う
- timezone は `user_settings.timezone` に置く
- delete は `is_active = false` による archive として扱う
- session secret は平文で保持せず hash を保存する
- すべての habit/log 操作でユーザー所有権を強制する
- 日付境界は user-local time で解釈する

## 必須挙動

- auth start/callback 以外の API はすべて認証必須
- API はデータスコープのために `userId` を受け取ってはならない
- 未来日の log は拒否する
- 対象外曜日は API 側で拒否する
- 集計は target day のみを母数に使う
- target day に `status=true` がない場合は未達成として集計する

## ディレクトリ方針

コードベースは追いやすく保つこと。基本レイアウトの目安は以下:

- `src/api` に route handler
- `src/auth` に OAuth と session code
- `src/db` に query と migration wiring
- `src/domain` に habits、logs、aggregate logic
- `src/lib` に共通 utility
- `src/web` に React UI
- `tests` に unit test と integration test
- `migrations` に SQL migration

必要に応じて命名は調整してよいが、責務境界は明確に保つこと。

## 実装ガイダンス

- 分断された層ではなく縦切りで実装する
- end-to-end の価値を最短で証明する経路から作る
- クライアントで小さな API をつなぐより、画面単位の aggregate API を優先する
- バリデーションは集約する
- 日付と timezone ロジックは再利用可能な helper に寄せる
- コメントは誤読しやすいロジックにだけ最小限で付ける

## データとクエリのガイダンス

- SQL はシンプルに保ち、index を前提にした access pattern を優先する
- 初手では caching や materialized view を入れない
- 通常フローで habit を物理削除しない
- `display_order` は決定的に保つ
- log upsert は idempotent にする

## テストガイダンス

最低限カバーすべき領域:
- auth session validation
- weekday targeting
- future-date rejection
- monthly aggregate correctness
- streak correctness
- archive behavior

時間が限られる場合は、UI より先に domain logic をテストすること。

## ローカル開発ルール

- フルスタック開発の標準コマンドは `pnpm dev`
- コード変更が完了したら、Worker と build 済み asset の両方を確実に更新するため実行中の dev server を再起動する
- Cloudflare 環境管理では、account-side resource は Terraform、Worker build/deploy は Wrangler を優先する

## 完了条件

以下を満たさない限りタスク完了とはみなさない:
- `SPEC.md` に一致している
- `PLAN.md` の現在フェーズに収まっている
- 必要なバリデーションが入っている
- ユーザーデータ分離を壊していない
- 振る舞いを信頼できるだけの検証がある

## アンチパターン

やってはいけないこと:
- コアフロー未完成のままスコープを広げる
- 推測ベースの抽象化を先回りで追加する
- 未解決の仕様衝突をコードに埋め込んで隠す
- 同じワークフローで user-local date logic と生の UTC 前提を混在させる
- API でも守るべきルールを UI ガードだけで済ませる

## エスカレーションルール

実装タスクが本当の spec gap で詰まった場合は、黙って推測しないこと。
ギャップを明示し、MVP のスコープを保てる最小の判断を選ぶこと。
