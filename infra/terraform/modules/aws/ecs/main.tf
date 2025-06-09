# AWS ECS Module for APS Application
# Creates ECS Cluster with Fargate services

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  configuration {
    execute_command_configuration {
      kms_key_id = var.kms_key_id
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_cluster.name
      }
    }
  }

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 100
  }

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-ecs-cluster"
    Type = "ECS Cluster"
  })
}

# CloudWatch Log Group for ECS Cluster
resource "aws_cloudwatch_log_group" "ecs_cluster" {
  name              = "/aws/ecs/cluster/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.project_name}-ecs-cluster-logs"
    Type = "CloudWatch Log Group"
  })
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for secrets and parameter store
resource "aws_iam_role_policy" "ecs_task_execution_additional" {
  name = "${var.project_name}-ecs-task-execution-additional"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Role for ECS Tasks
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Task role policy for application permissions
resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.project_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_name}",
          "arn:aws:s3:::${var.s3_bucket_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for ECS Services
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.backend_port
    to_port     = var.backend_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Backend API port"
  }

  ingress {
    from_port   = var.frontend_port
    to_port     = var.frontend_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Frontend port"
  }

  ingress {
    from_port   = var.flower_port
    to_port     = var.flower_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Celery Flower monitoring"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-ecs-tasks-sg"
    Type = "Security Group"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Backend Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.backend_cpu
  memory                  = var.backend_memory
  execution_role_arn      = aws_iam_role.ecs_task_execution.arn
  task_role_arn          = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${var.backend_image}:${var.backend_image_tag}"
      
      portMappings = [
        {
          containerPort = var.backend_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "POSTGRES_SERVER"
          value = var.database_host
        },
        {
          name  = "POSTGRES_PORT"
          value = tostring(var.database_port)
        },
        {
          name  = "POSTGRES_DB"
          value = var.database_name
        },
        {
          name  = "REDIS_HOST"
          value = var.redis_host
        },
        {
          name  = "REDIS_PORT"
          value = tostring(var.redis_port)
        }
      ]

      secrets = [
        {
          name      = "POSTGRES_USER"
          valueFrom = "${var.secrets_manager_prefix}/database/username"
        },
        {
          name      = "POSTGRES_PASSWORD"
          valueFrom = "${var.secrets_manager_prefix}/database/password"
        },
        {
          name      = "SECRET_KEY"
          valueFrom = "${var.secrets_manager_prefix}/app/secret-key"
        },
        {
          name      = "APS_CLIENT_ID"
          valueFrom = "${var.secrets_manager_prefix}/aps/client-id"
        },
        {
          name      = "APS_CLIENT_SECRET"
          valueFrom = "${var.secrets_manager_prefix}/aps/client-secret"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:${var.backend_port}/health || exit 1"]
        interval = 30
        timeout = 10
        retries = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.project_name}-backend-task"
    Type = "ECS Task Definition"
  })
}

# Frontend Task Definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.frontend_cpu
  memory                  = var.frontend_memory
  execution_role_arn      = aws_iam_role.ecs_task_execution.arn
  task_role_arn          = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = "${var.frontend_image}:${var.frontend_image_tag}"
      
      portMappings = [
        {
          containerPort = var.frontend_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "REACT_APP_API_URL"
          value = var.api_url
        },
        {
          name  = "REACT_APP_ENVIRONMENT"
          value = var.environment
        }
      ]

      secrets = [
        {
          name      = "REACT_APP_APS_CLIENT_ID"
          valueFrom = "${var.secrets_manager_prefix}/aps/client-id"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.frontend.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:${var.frontend_port}/health || exit 1"]
        interval = 30
        timeout = 10
        retries = 3
        startPeriod = 30
      }

      essential = true
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.project_name}-frontend-task"
    Type = "ECS Task Definition"
  })
}

# Celery Worker Task Definition
resource "aws_ecs_task_definition" "celery_worker" {
  family                   = "${var.project_name}-celery-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.celery_cpu
  memory                  = var.celery_memory
  execution_role_arn      = aws_iam_role.ecs_task_execution.arn
  task_role_arn          = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "celery-worker"
      image = "${var.backend_image}:${var.backend_image_tag}"
      
      command = ["celery", "-A", "app.core.celery", "worker", "--loglevel=info", "--concurrency=4"]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "POSTGRES_SERVER"
          value = var.database_host
        },
        {
          name  = "POSTGRES_PORT"
          value = tostring(var.database_port)
        },
        {
          name  = "POSTGRES_DB"
          value = var.database_name
        },
        {
          name  = "REDIS_HOST"
          value = var.redis_host
        },
        {
          name  = "REDIS_PORT"
          value = tostring(var.redis_port)
        }
      ]

      secrets = [
        {
          name      = "POSTGRES_USER"
          valueFrom = "${var.secrets_manager_prefix}/database/username"
        },
        {
          name      = "POSTGRES_PASSWORD"
          valueFrom = "${var.secrets_manager_prefix}/database/password"
        },
        {
          name      = "SECRET_KEY"
          valueFrom = "${var.secrets_manager_prefix}/app/secret-key"
        },
        {
          name      = "APS_CLIENT_ID"
          valueFrom = "${var.secrets_manager_prefix}/aps/client-id"
        },
        {
          name      = "APS_CLIENT_SECRET"
          valueFrom = "${var.secrets_manager_prefix}/aps/client-secret"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.celery_worker.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.project_name}-celery-worker-task"
    Type = "ECS Task Definition"
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}/backend"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.project_name}-backend-logs"
    Type = "CloudWatch Log Group"
  })
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}/frontend"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.project_name}-frontend-logs"
    Type = "CloudWatch Log Group"
  })
}

resource "aws_cloudwatch_log_group" "celery_worker" {
  name              = "/ecs/${var.project_name}/celery-worker"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.project_name}-celery-worker-logs"
    Type = "CloudWatch Log Group"
  })
}

# ECS Services
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = var.backend_target_group_arn
    container_name   = "backend"
    container_port   = var.backend_port
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = var.enable_execute_command

  depends_on = [var.backend_target_group_arn]

  tags = merge(var.tags, {
    Name = "${var.project_name}-backend-service"
    Type = "ECS Service"
  })
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = var.frontend_target_group_arn
    container_name   = "frontend"
    container_port   = var.frontend_port
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = var.enable_execute_command

  depends_on = [var.frontend_target_group_arn]

  tags = merge(var.tags, {
    Name = "${var.project_name}-frontend-service"
    Type = "ECS Service"
  })
}

resource "aws_ecs_service" "celery_worker" {
  name            = "${var.project_name}-celery-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.celery_worker.arn
  desired_count   = var.celery_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = var.enable_execute_command

  tags = merge(var.tags, {
    Name = "${var.project_name}-celery-worker-service"
    Type = "ECS Service"
  })
}

# Auto Scaling
resource "aws_appautoscaling_target" "backend" {
  count = var.enable_autoscaling ? 1 : 0

  max_capacity       = var.backend_max_capacity
  min_capacity       = var.backend_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.project_name}-backend-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend[0].resource_id
  scalable_dimension = aws_appautoscaling_target.backend[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_policy" "backend_memory" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.project_name}-backend-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend[0].resource_id
  scalable_dimension = aws_appautoscaling_target.backend[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
  }
}
