# Outputs for AWS ElastiCache Module

# Replication Group
output "replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.replication_group_id
}

output "replication_group_arn" {
  description = "ARN of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.arn
}

# Endpoints
output "primary_endpoint_address" {
  description = "Primary endpoint address"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "configuration_endpoint_address" {
  description = "Configuration endpoint address (for cluster mode)"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

# Connection Information
output "redis_url" {
  description = "Redis connection URL"
  value = var.transit_encryption_enabled ? (
    var.create_user_group ? 
      "rediss://${aws_elasticache_user.app[0].user_name}:${random_password.app_user_password[0].result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}" :
      "rediss://:${random_password.auth_token[0].result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  ) : "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  sensitive = true
}

output "connection_info" {
  description = "Redis connection information"
  value = {
    endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
    port     = aws_elasticache_replication_group.redis.port
    ssl      = var.transit_encryption_enabled
  }
}

# Security Group
output "security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "security_group_arn" {
  description = "ARN of the Redis security group"
  value       = aws_security_group.redis.arn
}

# Subnet Group
output "subnet_group_name" {
  description = "Name of the ElastiCache subnet group"
  value       = aws_elasticache_subnet_group.main.name
}

# Parameter Group
output "parameter_group_name" {
  description = "Name of the ElastiCache parameter group"
  value       = aws_elasticache_parameter_group.redis.name
}

# KMS Key
output "kms_key_id" {
  description = "KMS key ID used for encryption"
  value       = var.create_kms_key ? aws_kms_key.redis[0].key_id : var.kms_key_id
}

output "kms_key_arn" {
  description = "KMS key ARN used for encryption"
  value       = var.create_kms_key ? aws_kms_key.redis[0].arn : null
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = var.create_kms_key ? aws_kms_alias.redis[0].name : null
}

# Secrets Manager
output "auth_token_secret_arn" {
  description = "ARN of the auth token secret"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_auth_token[0].arn : null
}

output "auth_token_secret_name" {
  description = "Name of the auth token secret"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_auth_token[0].name : null
}

output "app_user_secret_arn" {
  description = "ARN of the application user secret"
  value       = var.create_user_group ? aws_secretsmanager_secret.redis_app_user[0].arn : null
}

output "app_user_secret_name" {
  description = "Name of the application user secret"
  value       = var.create_user_group ? aws_secretsmanager_secret.redis_app_user[0].name : null
}

# User Group (RBAC)
output "user_group_id" {
  description = "ID of the user group"
  value       = var.create_user_group ? aws_elasticache_user_group.main[0].user_group_id : null
}

output "app_user_id" {
  description = "ID of the application user"
  value       = var.create_user_group ? aws_elasticache_user.app[0].user_id : null
}

# CloudWatch Log Groups
output "slow_log_group_name" {
  description = "CloudWatch log group name for Redis slow logs"
  value       = aws_cloudwatch_log_group.redis_slow.name
}

output "slow_log_group_arn" {
  description = "CloudWatch log group ARN for Redis slow logs"
  value       = aws_cloudwatch_log_group.redis_slow.arn
}

# CloudWatch Alarms
output "cpu_alarm_arn" {
  description = "ARN of the CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.redis_cpu.arn
}

output "memory_alarm_arn" {
  description = "ARN of the memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.redis_memory.arn
}

output "evictions_alarm_arn" {
  description = "ARN of the evictions alarm"
  value       = aws_cloudwatch_metric_alarm.redis_evictions.arn
}

output "connections_alarm_arn" {
  description = "ARN of the connections alarm"
  value       = aws_cloudwatch_metric_alarm.redis_connections.arn
}

# Global Replication Group
output "global_replication_group_id" {
  description = "ID of the global replication group"
  value       = var.create_global_replication_group ? aws_elasticache_global_replication_group.redis[0].global_replication_group_id : null
}

# Instance Configuration
output "instance_configuration" {
  description = "ElastiCache instance configuration summary"
  value = {
    node_type                   = aws_elasticache_replication_group.redis.node_type
    engine_version             = aws_elasticache_replication_group.redis.engine_version
    num_cache_clusters         = aws_elasticache_replication_group.redis.num_cache_clusters
    automatic_failover_enabled = aws_elasticache_replication_group.redis.automatic_failover_enabled
    multi_az_enabled           = aws_elasticache_replication_group.redis.multi_az_enabled
    snapshot_retention_limit   = aws_elasticache_replication_group.redis.snapshot_retention_limit
    snapshot_window            = aws_elasticache_replication_group.redis.snapshot_window
    maintenance_window         = aws_elasticache_replication_group.redis.maintenance_window
  }
}

# Security Configuration
output "security_configuration" {
  description = "ElastiCache security configuration summary"
  value = {
    vpc_id                      = var.vpc_id
    subnet_group_name          = aws_elasticache_subnet_group.main.name
    security_group_id          = aws_security_group.redis.id
    at_rest_encryption_enabled = aws_elasticache_replication_group.redis.at_rest_encryption_enabled
    transit_encryption_enabled = aws_elasticache_replication_group.redis.transit_encryption_enabled
    kms_key_id                 = aws_elasticache_replication_group.redis.kms_key_id
    auth_token_enabled         = var.transit_encryption_enabled
    user_group_enabled         = var.create_user_group
  }
}

# For monitoring and alerting integration
output "monitoring_targets" {
  description = "Monitoring targets for external systems"
  value = {
    replication_group_id = aws_elasticache_replication_group.redis.replication_group_id
    replication_group_arn = aws_elasticache_replication_group.redis.arn
    security_group_id    = aws_security_group.redis.id
    cloudwatch_log_groups = [aws_cloudwatch_log_group.redis_slow.name]
    alarm_arns = [
      aws_cloudwatch_metric_alarm.redis_cpu.arn,
      aws_cloudwatch_metric_alarm.redis_memory.arn,
      aws_cloudwatch_metric_alarm.redis_evictions.arn,
      aws_cloudwatch_metric_alarm.redis_connections.arn
    ]
  }
}

# Member Clusters
output "member_clusters" {
  description = "List of member cluster IDs"
  value       = aws_elasticache_replication_group.redis.member_clusters
}

# Configuration Endpoint (for cluster mode)
output "configuration_endpoint" {
  description = "Configuration endpoint for cluster mode"
  value = {
    address = aws_elasticache_replication_group.redis.configuration_endpoint_address
    port    = aws_elasticache_replication_group.redis.port
  }
}

# Reader Endpoint
output "reader_endpoint" {
  description = "Reader endpoint for read replicas"
  value = {
    address = aws_elasticache_replication_group.redis.reader_endpoint_address
    port    = aws_elasticache_replication_group.redis.port
  }
}
