# Variables for AWS ECS Module

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
  description = "VPC ID where resources will be created"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets are required for high availability."
  }
}

# Container Images
variable "backend_image" {
  description = "Backend container image"
  type        = string
  default     = "aps-backend"
}

variable "backend_image_tag" {
  description = "Backend container image tag"
  type        = string
  default     = "latest"
}

variable "frontend_image" {
  description = "Frontend container image"
  type        = string
  default     = "aps-frontend"
}

variable "frontend_image_tag" {
  description = "Frontend container image tag"
  type        = string
  default     = "latest"
}

# Resource Allocations
variable "backend_cpu" {
  description = "CPU units for backend task (1024 = 1 vCPU)"
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.backend_cpu)
    error_message = "Backend CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "backend_memory" {
  description = "Memory (MB) for backend task"
  type        = number
  default     = 2048
  validation {
    condition     = var.backend_memory >= 512 && var.backend_memory <= 30720
    error_message = "Backend memory must be between 512 MB and 30720 MB."
  }
}

variable "frontend_cpu" {
  description = "CPU units for frontend task (1024 = 1 vCPU)"
  type        = number
  default     = 512
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.frontend_cpu)
    error_message = "Frontend CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "frontend_memory" {
  description = "Memory (MB) for frontend task"
  type        = number
  default     = 1024
  validation {
    condition     = var.frontend_memory >= 512 && var.frontend_memory <= 30720
    error_message = "Frontend memory must be between 512 MB and 30720 MB."
  }
}

variable "celery_cpu" {
  description = "CPU units for celery worker task (1024 = 1 vCPU)"
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.celery_cpu)
    error_message = "Celery CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "celery_memory" {
  description = "Memory (MB) for celery worker task"
  type        = number
  default     = 2048
  validation {
    condition     = var.celery_memory >= 512 && var.celery_memory <= 30720
    error_message = "Celery memory must be between 512 MB and 30720 MB."
  }
}

# Service Configuration
variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.backend_desired_count >= 1
    error_message = "Backend desired count must be at least 1."
  }
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.frontend_desired_count >= 1
    error_message = "Frontend desired count must be at least 1."
  }
}

variable "celery_desired_count" {
  description = "Desired number of celery worker tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.celery_desired_count >= 1
    error_message = "Celery desired count must be at least 1."
  }
}

# Ports
variable "backend_port" {
  description = "Port for backend service"
  type        = number
  default     = 8000
}

variable "frontend_port" {
  description = "Port for frontend service"
  type        = number
  default     = 80
}

variable "flower_port" {
  description = "Port for Celery Flower monitoring"
  type        = number
  default     = 5555
}

# Database Configuration
variable "database_host" {
  description = "Database host"
  type        = string
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "aps_db"
}

# Redis Configuration
variable "redis_host" {
  description = "Redis host"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

# Load Balancer Target Groups
variable "backend_target_group_arn" {
  description = "ARN of the backend target group"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "ARN of the frontend target group"
  type        = string
}

# Secrets Manager
variable "secrets_manager_prefix" {
  description = "Prefix for secrets in AWS Secrets Manager"
  type        = string
  default     = "aps"
}

# S3 Configuration
variable "s3_bucket_name" {
  description = "S3 bucket name for file storage"
  type        = string
}

# API Configuration
variable "api_url" {
  description = "API URL for frontend"
  type        = string
}

# Auto Scaling
variable "enable_autoscaling" {
  description = "Enable auto scaling for ECS services"
  type        = bool
  default     = true
}

variable "backend_min_capacity" {
  description = "Minimum number of backend tasks"
  type        = number
  default     = 2
}

variable "backend_max_capacity" {
  description = "Maximum number of backend tasks"
  type        = number
  default     = 10
}

variable "frontend_min_capacity" {
  description = "Minimum number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_max_capacity" {
  description = "Maximum number of frontend tasks"
  type        = number
  default     = 10
}

# Monitoring
variable "enable_container_insights" {
  description = "Enable Container Insights for ECS cluster"
  type        = bool
  default     = true
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for debugging"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

# Security
variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}

variable "enable_service_discovery" {
  description = "Enable AWS Cloud Map service discovery"
  type        = bool
  default     = false
}

variable "service_discovery_namespace_id" {
  description = "AWS Cloud Map namespace ID"
  type        = string
  default     = null
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

# Health Check Configuration
variable "health_check_grace_period_seconds" {
  description = "Health check grace period for ECS services"
  type        = number
  default     = 300
}

variable "health_check_path" {
  description = "Health check path for load balancer"
  type        = string
  default     = "/health"
}

# Capacity Provider Strategy
variable "use_fargate_spot" {
  description = "Use Fargate Spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "fargate_spot_percentage" {
  description = "Percentage of tasks to run on Fargate Spot"
  type        = number
  default     = 50
  validation {
    condition     = var.fargate_spot_percentage >= 0 && var.fargate_spot_percentage <= 100
    error_message = "Fargate Spot percentage must be between 0 and 100."
  }
}

# Service Connect Configuration
variable "enable_service_connect" {
  description = "Enable ECS Service Connect"
  type        = bool
  default     = false
}

variable "service_connect_namespace" {
  description = "Service Connect namespace"
  type        = string
  default     = null
}

# Deployment Configuration
variable "deployment_minimum_healthy_percent" {
  description = "Minimum healthy percent during deployment"
  type        = number
  default     = 50
  validation {
    condition     = var.deployment_minimum_healthy_percent >= 0 && var.deployment_minimum_healthy_percent <= 100
    error_message = "Deployment minimum healthy percent must be between 0 and 100."
  }
}

variable "deployment_maximum_percent" {
  description = "Maximum percent during deployment"
  type        = number
  default     = 200
  validation {
    condition     = var.deployment_maximum_percent >= 100
    error_message = "Deployment maximum percent must be at least 100."
  }
}

# Task placement constraints
variable "enable_task_placement_constraints" {
  description = "Enable task placement constraints"
  type        = bool
  default     = false
}

variable "task_placement_strategy" {
  description = "Task placement strategy"
  type        = string
  default     = "spread"
  validation {
    condition     = contains(["spread", "binpack", "random"], var.task_placement_strategy)
    error_message = "Task placement strategy must be one of: spread, binpack, random."
  }
}
