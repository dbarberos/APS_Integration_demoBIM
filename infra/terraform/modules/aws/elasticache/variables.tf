# Variables for AWS ElastiCache Module

variable "project_name" {
  description = "Name of the project"
  type        = string
  validation {
    condition     = length(var.project_name) > 0
    error_message = "Project name cannot be empty."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "vpc_id" {
  description = "VPC ID where ElastiCache will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for ElastiCache subnet group"
  type        = list(string)
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnets are required for ElastiCache subnet group."
  }
}

variable "allowed_security_groups" {
  description = "List of security group IDs allowed to access Redis"
  type        = list(string)
  default     = []
}

# Redis Configuration
variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
  validation {
    condition = can(regex("^cache\\.", var.node_type))
    error_message = "Node type must be a valid ElastiCache instance type."
  }
}

variable "redis_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes in the replication group"
  type        = number
  default     = 2
  validation {
    condition     = var.num_cache_nodes >= 1 && var.num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

# Security
variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true
}

variable "create_kms_key" {
  description = "Create a new KMS key for encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (if not creating new key)"
  type        = string
  default     = null
}

variable "kms_deletion_window" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 7
  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS deletion window must be between 7 and 30 days."
  }
}

variable "secret_recovery_window" {
  description = "Secrets Manager recovery window in days"
  type        = number
  default     = 7
  validation {
    condition     = var.secret_recovery_window >= 7 && var.secret_recovery_window <= 30
    error_message = "Secret recovery window must be between 7 and 30 days."
  }
}

# Backup and Maintenance
variable "snapshot_retention_limit" {
  description = "Number of days for which ElastiCache retains automatic snapshots"
  type        = number
  default     = 5
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily time range during which ElastiCache begins taking snapshots"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Weekly time range during which maintenance occurs"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "auto_minor_version_upgrade" {
  description = "Enable auto minor version upgrade"
  type        = bool
  default     = true
}

# Monitoring
variable "notification_topic_arn" {
  description = "ARN of SNS topic for notifications"
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

# Redis Parameters
variable "redis_parameters" {
  description = "Redis parameters to set"
  type = list(object({
    name  = string
    value = string
  }))
  default = [
    {
      name  = "maxmemory-policy"
      value = "allkeys-lru"
    },
    {
      name  = "timeout"
      value = "300"
    },
    {
      name  = "tcp-keepalive"
      value = "300"
    }
  ]
}

# Advanced Features
variable "data_tiering_enabled" {
  description = "Enable data tiering"
  type        = bool
  default     = false
}

variable "create_global_replication_group" {
  description = "Create global replication group for cross-region replication"
  type        = bool
  default     = false
}

variable "create_user_group" {
  description = "Create user group for RBAC (Redis 6.0+)"
  type        = bool
  default     = false
}

# Alerting
variable "alarm_actions" {
  description = "List of ARNs to notify when alarm triggers"
  type        = list(string)
  default     = []
}

variable "max_connections_threshold" {
  description = "Threshold for connection count alarm"
  type        = number
  default     = 100
}

# Tags
variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default = {
    Terraform   = "true"
    Environment = "production"
    Project     = "aps-integration"
  }
}
