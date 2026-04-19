# Cloudflare Terraform

This directory holds Cloudflare-side infrastructure as code for Daily Leveling.

## Scope

This Terraform layer is intended to manage:
- the Worker service shell
- `workers.dev` enablement
- optional custom domain attachment
- optional Worker route attachment

This Terraform layer is not the primary build pipeline for the Worker bundle.
Use Wrangler for local development and code deployment.

## Files

- `versions.tf`: Terraform and provider requirements
- `variables.tf`: input variables
- `main.tf`: Cloudflare resources
- `outputs.tf`: useful outputs
- `terraform.tfvars.example`: example variable values

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- Set either `custom_domain_hostname` or `route_pattern` depending on how you expose the Worker.
- Use a custom domain when the Worker is the origin.
- Use a route when the Worker sits in front of another origin.
- Keep Worker code deployment in Wrangler unless you intentionally move version management into Terraform.
