# RDS PostgreSQL Module for AWS

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  })
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.environment}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
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
    Name = "${var.project_name}-${var.environment}-rds-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  count = var.create_kms_key ? 1 : 0

  description             = "KMS key for RDS encryption"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds-key"
  })
}

resource "aws_kms_alias" "rds" {
  count = var.create_kms_key ? 1 : 0

  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds[0].key_id
}

# Random password for master user
resource "random_password" "master_password" {
  length  = 32
  special = true
}

# Store master password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "rds_password" {
  name                    = "${var.project_name}-${var.environment}/database/master-password"
  description             = "Master password for RDS instance"
  recovery_window_in_days = var.secret_recovery_window

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  secret_id     = aws_secretsmanager_secret.rds_password.id
  secret_string = random_password.master_password.result
}

# Application database password
resource "random_password" "app_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "app_password" {
  name                    = "${var.project_name}-${var.environment}/database/app-password"
  description             = "Application user password for RDS instance"
  recovery_window_in_days = var.secret_recovery_window

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app_password" {
  secret_id = aws_secretsmanager_secret.app_password.id
  secret_string = jsonencode({
    username = var.database_user
    password = random_password.app_password.result
    hostname = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    dbname   = var.database_name
  })
}

# Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.project_name}-${var.environment}-pg"

  dynamic "parameter" {
    for_each = var.db_parameters
    content {
      name         = parameter.value.name
      value        = parameter.value.value
      apply_method = lookup(parameter.value, "apply_method", "immediate")
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-parameter-group"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-db"

  # Engine Configuration
  engine                      = "postgres"
  engine_version              = var.postgres_version
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = var.max_allocated_storage
  storage_type                = var.storage_type
  storage_encrypted           = true
  kms_key_id                  = var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  performance_insights_enabled = var.performance_insights_enabled

  # Database Configuration
  db_name  = var.database_name
  username = var.master_username
  password = random_password.master_password.result
  port     = 5432

  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Backup Configuration
  backup_retention_period   = var.backup_retention_period
  backup_window            = var.backup_window
  maintenance_window       = var.maintenance_window
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  delete_automated_backups = var.delete_automated_backups

  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports

  # Advanced Configuration
  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = var.option_group_name

  # Deletion Protection
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Multi-AZ
  multi_az = var.multi_az

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-database"
  })

  depends_on = [
    aws_db_subnet_group.main,
    aws_security_group.rds
  ]
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0

  name = "${var.project_name}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Read Replica (optional)
resource "aws_db_instance" "read_replica" {
  count = var.create_read_replica ? 1 : 0

  identifier             = "${var.project_name}-${var.environment}-db-replica"
  replicate_source_db    = aws_db_instance.main.identifier
  instance_class         = var.replica_instance_class
  auto_minor_version_upgrade = false
  publicly_accessible    = false
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-database-replica"
  })
}

# CloudWatch Log Groups for RDS logs
resource "aws_cloudwatch_log_group" "postgresql" {
  count = contains(var.enabled_cloudwatch_logs_exports, "postgresql") ? 1 : 0

  name              = "/aws/rds/instance/${aws_db_instance.main.identifier}/postgresql"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.max_connections_threshold
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_free_storage" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "2000000000" # 2GB in bytes
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

# Database creation script (executed via null_resource)
resource "null_resource" "create_app_user" {
  count = var.create_app_user ? 1 : 0

  triggers = {
    db_instance_id = aws_db_instance.main.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      export PGPASSWORD="${random_password.master_password.result}"
      
      # Wait for RDS to be ready
      echo "Waiting for RDS instance to be ready..."
      sleep 60
      
      # Create application user and database
      psql -h ${aws_db_instance.main.endpoint} -U ${var.master_username} -d postgres -c "
        CREATE USER ${var.database_user} WITH PASSWORD '${random_password.app_password.result}';
        CREATE DATABASE ${var.database_name} OWNER ${var.database_user};
        GRANT ALL PRIVILEGES ON DATABASE ${var.database_name} TO ${var.database_user};
      " || echo "User and database may already exist"
    EOT
  }

  depends_on = [aws_db_instance.main]
}