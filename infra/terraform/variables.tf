variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "worker_name" {
  description = "Worker service name."
  type        = string
  default     = "daily-leveling"
}

variable "enable_workers_dev" {
  description = "Whether the workers.dev subdomain should stay enabled."
  type        = bool
  default     = true
}

variable "zone_id" {
  description = "Cloudflare zone ID for custom domains or routes."
  type        = string
  default     = null
  nullable    = true
}

variable "custom_domain_hostname" {
  description = "Custom domain hostname when the Worker is the origin."
  type        = string
  default     = null
  nullable    = true
}

variable "route_pattern" {
  description = "Worker route pattern when the Worker sits in front of another origin."
  type        = string
  default     = null
  nullable    = true
}
