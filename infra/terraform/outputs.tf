output "worker_name" {
  value       = cloudflare_worker.daily_leveling.name
  description = "Worker service name."
}

output "workers_dev_enabled" {
  value       = var.enable_workers_dev
  description = "Whether workers.dev is enabled."
}

output "custom_domain_hostname" {
  value       = try(cloudflare_workers_custom_domain.daily_leveling[0].hostname, null)
  description = "Configured custom domain hostname, if any."
}

output "route_pattern" {
  value       = try(cloudflare_workers_route.daily_leveling[0].pattern, null)
  description = "Configured route pattern, if any."
}

output "auth_rate_limits_namespace_id" {
  value       = var.auth_rate_limits_namespace_id != null ? var.auth_rate_limits_namespace_id : cloudflare_workers_kv_namespace.auth_rate_limits[0].id
  description = "KV namespace ID for auth route rate limiting."
}
