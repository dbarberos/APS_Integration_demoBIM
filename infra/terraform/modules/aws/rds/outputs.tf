# Outputs for AWS RDS Module

# RDS Instance
output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_hosted_zone_id" {
  description = "RDS instance hosted zone ID"
  value       = aws_db_instance.main.hosted_zone_id
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_instance_address" {
  description = "RDS instance address"
  value       = aws_db_instance.main.address
}

output "db_instance_name" {
  description = "RDS instance database name"
  value       = aws_db_instance.main.db_name
}

output "db_instance_username" {
  description = "RDS instance master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "db_instance_engine_version_actual" {
  description = "Running version of the database"
  value       = aws_db_instance.main.engine_version_actual
}

output "db_instance_resource_id" {
  description = "RDS Resource ID of this instance"
  value       = aws_db_instance.main.resource_id
}

output "db_instance_status" {
  description = "RDS instance status"
  value       = aws_db_instance.main.status
}

output "db_instance_availability_zone" {
  description = "Availability zone of the RDS instance"
  value       = aws_db_instance.main.availability_zone
}

output "db_instance_multi_az" {
  description = "Whether the RDS instance is multi AZ enabled"
  value       = aws_db_instance.main.multi_az
}

# Read Replica
output "db_read_replica_id" {
  description = "RDS read replica instance ID"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].id : null
}

output "db_read_replica_arn" {
  description = "RDS read replica instance ARN"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].arn : null
}

output "db_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].endpoint : null
}

# Security Group
output "security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "security_group_arn" {
  description = "ARN of the RDS security group"
  value       = aws_security_group.rds.arn
}

# Subnet Group
output "db_subnet_group_id" {
  description = "DB subnet group ID"
  value       = aws_db_subnet_group.main.id
}

output "db_subnet_group_arn" {
  description = "DB subnet group ARN"
  value       = aws_db_subnet_group.main.arn
}

# Parameter Group
output "db_parameter_group_id" {
  description = "DB parameter group ID"
  value       = aws_db_parameter_group.main.id
}

output "db_parameter_group_arn" {
  description = "DB parameter group ARN"
  value       = aws_db_parameter_group.main.arn
}

# KMS Key
output "kms_key_id" {
  description = "KMS key ID used for encryption"
  value       = var.create_kms_key ? aws_kms_key.rds[0].key_id : var.kms_key_id
}

output "kms_key_arn" {
  description = "KMS key ARN used for encryption"
  value       = var.create_kms_key ? aws_kms_key.rds[0].arn : null
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = var.create_kms_key ? aws_kms_alias.rds[0].name : null
}

# Secrets Manager
output "master_password_secret_arn" {
  description = "ARN of the master password secret"
  value       = aws_secretsmanager_secret.rds_password.arn
}

output "master_password_secret_name" {
  description = "Name of the master password secret"
  value       = aws_secretsmanager_secret.rds_password.name
}

output "app_password_secret_arn" {
  description = "ARN of the application password secret"
  value       = aws_secretsmanager_secret.app_password.arn
}

output "app_password_secret_name" {
  description = "Name of the application password secret"
  value       = aws_secretsmanager_secret.app_password.name
}

# Database Connection Information
output "database_url" {
  description = "Database URL for applications"
  value       = "postgresql://${var.database_user}:${random_password.app_password.result}@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${var.database_name}"
  sensitive   = true
}

output "connection_info" {
  description = "Database connection information"
  value = {
    hostname = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    database = aws_db_instance.main.db_name
    username = var.database_user
  }
}

# CloudWatch Log Groups
output "postgresql_log_group_name" {
  description = "CloudWatch log group name for PostgreSQL logs"
  value       = contains(var.enabled_cloudwatch_logs_exports, "postgresql") ? aws_cloudwatch_log_group.postgresql[0].name : null
}

output "postgresql_log_group_arn" {
  description = "CloudWatch log group ARN for PostgreSQL logs"
  value       = contains(var.enabled_cloudwatch_logs_exports, "postgresql") ? aws_cloudwatch_log_group.postgresql[0].arn : null
}

# CloudWatch Alarms
output "cpu_alarm_arn" {
  description = "ARN of the CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.database_cpu.arn
}

output "connection_alarm_arn" {
  description = "ARN of the connection count alarm"
  value       = aws_cloudwatch_metric_alarm.database_connections.arn
}

output "storage_alarm_arn" {
  description = "ARN of the free storage alarm"
  value       = aws_cloudwatch_metric_alarm.database_free_storage.arn
}

# Monitoring
output "monitoring_role_arn" {
  description = "ARN of the enhanced monitoring role"
  value       = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null
}

# Instance Configuration
output "instance_configuration" {
  description = "RDS instance configuration summary"
  value = {
    instance_class    = aws_db_instance.main.instance_class
    engine           = aws_db_instance.main.engine
    engine_version   = aws_db_instance.main.engine_version_actual
    allocated_storage = aws_db_instance.main.allocated_storage
    storage_type     = aws_db_instance.main.storage_type
    storage_encrypted = aws_db_instance.main.storage_encrypted
    multi_az         = aws_db_instance.main.multi_az
    backup_retention_period = aws_db_instance.main.backup_retention_period
    backup_window    = aws_db_instance.main.backup_window
    maintenance_window = aws_db_instance.main.maintenance_window
  }
}

# Security Configuration
output "security_configuration" {
  description = "RDS security configuration summary"
  value = {
    vpc_id              = var.vpc_id
    db_subnet_group     = aws_db_subnet_group.main.name
    security_group_id   = aws_security_group.rds.id
    deletion_protection = aws_db_instance.main.deletion_protection
    storage_encrypted   = aws_db_instance.main.storage_encrypted
    kms_key_id         = aws_db_instance.main.kms_key_id
  }
}

# For monitoring and alerting integration
output "monitoring_targets" {
  description = "Monitoring targets for external systems"
  value = {
    db_instance_identifier = aws_db_instance.main.id
    db_instance_arn       = aws_db_instance.main.arn
    security_group_id     = aws_security_group.rds.id
    cloudwatch_log_groups = contains(var.enabled_cloudwatch_logs_exports, "postgresql") ? [aws_cloudwatch_log_group.postgresql[0].name] : []
    alarm_arns = [
      aws_cloudwatch_metric_alarm.database_cpu.arn,
      aws_cloudwatch_metric_alarm.database_connections.arn,
      aws_cloudwatch_metric_alarm.database_free_storage.arn
    ]
  }
}

# Backup Information
output "backup_configuration" {
  description = "Backup configuration details"
  value = {
    backup_retention_period = aws_db_instance.main.backup_retention_period
    backup_window          = aws_db_instance.main.backup_window
    delete_automated_backups = aws_db_instance.main.delete_automated_backups
    final_snapshot_identifier = aws_db_instance.main.final_snapshot_identifier
  }
}
