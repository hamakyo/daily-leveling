# Cloudflare Terraform

このディレクトリは、Daily Leveling の Cloudflare 側インフラを Terraform で管理するためのものです。

## 管理対象

この Terraform レイヤーでは主に以下を扱います。
- Worker サービス定義
- `workers.dev` の有効化/無効化
- 任意の Custom Domain
- 任意の Worker Route

Worker バンドルのビルドパイプライン自体はここでは管理しません。
ローカル開発と Worker コードのデプロイは Wrangler を使います。

## ファイル構成

- `versions.tf`
  Terraform 本体と provider の要求バージョン
- `variables.tf`
  入力変数
- `main.tf`
  Cloudflare リソース定義
- `outputs.tf`
  出力値
- `terraform.tfvars.example`
  変数ファイルの雛形
- `environments/*.tfvars.example`
  `test / staging / production` ごとの雛形

## 使い方

```bash
cd infra/terraform
cp environments/staging.tfvars.example staging.tfvars
terraform init
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

環境別の雛形:

- `environments/test.tfvars.example`
- `environments/staging.tfvars.example`
- `environments/production.tfvars.example`

推奨する worker 名:

- test: `daily-leveling-test`
- staging: `daily-leveling-staging`
- production: `daily-leveling`

## 注意点

- `custom_domain_hostname` か `route_pattern` のどちらを使うかは公開方式に合わせて選んでください。
- Worker 自体がオリジンになる場合は Custom Domain を使います。
- 既存オリジンの前段に Worker を挟む場合は Route を使います。
- Worker コードのバージョン管理まで Terraform に寄せる意図がない限り、コード配備は Wrangler のままにしてください。
- 実運用では `test / staging / production` で Terraform の `tfvars` と state を分けてください。
