# ElastiCache Redis Module for AWS

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-cache-subnet"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cache-subnet-group"
  })
}

# Security Group for ElastiCache
resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# KMS Key for ElastiCache encryption
resource "aws_kms_key" "redis" {
  count = var.create_kms_key ? 1 : 0

  description             = "KMS key for ElastiCache encryption"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-key"
  })
}

resource "aws_kms_alias" "redis" {
  count = var.create_kms_key ? 1 : 0

  name          = "alias/${var.project_name}-${var.environment}-redis"
  target_key_id = aws_kms_key.redis[0].key_id
}

# Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7.x"
  name   = "${var.project_name}-${var.environment}-redis-params"

  dynamic "parameter" {
    for_each = var.redis_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-parameter-group"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "Redis cluster for ${var.project_name} ${var.environment}"

  # Node configuration
  node_type               = var.node_type
  port                   = 6379
  parameter_group_name   = aws_elasticache_parameter_group.redis.name

  # Cluster configuration
  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled          = var.multi_az_enabled

  # Engine configuration
  engine_version = var.redis_version

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  kms_key_id                = var.create_kms_key ? aws_kms_key.redis[0].arn : var.kms_key_id

  # Auth token for transit encryption
  auth_token = var.transit_encryption_enabled ? random_password.auth_token[0].result : null

  # Backup configuration
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window         = var.snapshot_window
  maintenance_window      = var.maintenance_window

  # Notification
  notification_topic_arn = var.notification_topic_arn

  # Auto minor version upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # Data tiering
  data_tiering_enabled = var.data_tiering_enabled

  # Log configuration
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-cluster"
  })

  depends_on = [
    aws_elasticache_subnet_group.main,
    aws_security_group.redis,
    aws_elasticache_parameter_group.redis
  ]
}

# Generate auth token for Redis if transit encryption is enabled
resource "random_password" "auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  length  = 32
  special = false
}

# Store auth token in AWS Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  name                    = "${var.project_name}-${var.environment}/redis/auth-token"
  description             = "Redis auth token for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.secret_recovery_window

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  secret_id = aws_secretsmanager_secret.redis_auth_token[0].id
  secret_string = jsonencode({
    auth_token = random_password.auth_token[0].result
    endpoint   = aws_elasticache_replication_group.redis.configuration_endpoint_address != "" ? aws_elasticache_replication_group.redis.configuration_endpoint_address : aws_elasticache_replication_group.redis.primary_endpoint_address
    port       = aws_elasticache_replication_group.redis.port
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/redis/${aws_elasticache_replication_group.redis.replication_group_id}/slow-log"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "This metric monitors Redis memory utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors Redis evictions"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-curr-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = var.max_connections_threshold
  alarm_description   = "This metric monitors Redis current connections"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

# Global Datastore (for cross-region replication) - Optional
resource "aws_elasticache_global_replication_group" "redis" {
  count = var.create_global_replication_group ? 1 : 0

  global_replication_group_id_suffix = "${var.project_name}-${var.environment}-global"
  primary_replication_group_id       = aws_elasticache_replication_group.redis.replication_group_id

  description = "Global replication group for ${var.project_name} ${var.environment}"

  tags = var.tags
}

# User Group for RBAC (Redis 6.0+)
resource "aws_elasticache_user_group" "main" {
  count = var.create_user_group ? 1 : 0

  engine        = "REDIS"
  user_group_id = "${var.project_name}-${var.environment}-users"
  user_ids      = [aws_elasticache_user.app[0].user_id, "default"]

  tags = var.tags
}

# Application User for RBAC
resource "aws_elasticache_user" "app" {
  count = var.create_user_group ? 1 : 0

  user_id       = "${var.project_name}-${var.environment}-app-user"
  user_name     = "app-user"
  access_string = "on ~* &* +@all"
  engine        = "REDIS"
  passwords     = [random_password.app_user_password[0].result]

  tags = var.tags
}

resource "random_password" "app_user_password" {
  count = var.create_user_group ? 1 : 0

  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis_app_user" {
  count = var.create_user_group ? 1 : 0

  name                    = "${var.project_name}-${var.environment}/redis/app-user"
  description             = "Redis application user credentials"
  recovery_window_in_days = var.secret_recovery_window

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_app_user" {
  count = var.create_user_group ? 1 : 0

  secret_id = aws_secretsmanager_secret.redis_app_user[0].id
  secret_string = jsonencode({
    username = aws_elasticache_user.app[0].user_name
    password = random_password.app_user_password[0].result
    endpoint = aws_elasticache_replication_group.redis.configuration_endpoint_address != "" ? aws_elasticache_replication_group.redis.configuration_endpoint_address : aws_elasticache_replication_group.redis.primary_endpoint_address
    port     = aws_elasticache_replication_group.redis.port
  })
}
