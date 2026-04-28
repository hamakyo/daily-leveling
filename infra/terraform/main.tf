resource "cloudflare_worker" "daily_leveling" {
  account_id = var.account_id
  name       = var.worker_name

  observability = {
    enabled = true
  }

  subdomain = {
    enabled = var.enable_workers_dev
  }
}

resource "cloudflare_workers_kv_namespace" "auth_rate_limits" {
  count      = var.auth_rate_limits_namespace_id == null ? 1 : 0
  account_id = var.account_id
  title      = "${var.worker_name}-auth-rate-limits"
}

resource "cloudflare_workers_custom_domain" "daily_leveling" {
  count = var.custom_domain_hostname == null ? 0 : 1

  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.custom_domain_hostname
  service    = cloudflare_worker.daily_leveling.name

  lifecycle {
    precondition {
      condition     = var.zone_id != null
      error_message = "zone_id is required when custom_domain_hostname is set."
    }
  }
}

resource "cloudflare_workers_route" "daily_leveling" {
  count = var.route_pattern == null ? 0 : 1

  zone_id = var.zone_id
  pattern = var.route_pattern
  script  = cloudflare_worker.daily_leveling.name

  lifecycle {
    precondition {
      condition     = var.zone_id != null
      error_message = "zone_id is required when route_pattern is set."
    }
  }
}
