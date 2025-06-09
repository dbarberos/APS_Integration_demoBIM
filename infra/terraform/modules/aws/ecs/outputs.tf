# Outputs for AWS ECS Module

# ECS Cluster
output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# Task Definitions
output "backend_task_definition_arn" {
  description = "ARN of the backend task definition"
  value       = aws_ecs_task_definition.backend.arn
}

output "frontend_task_definition_arn" {
  description = "ARN of the frontend task definition"
  value       = aws_ecs_task_definition.frontend.arn
}

output "celery_worker_task_definition_arn" {
  description = "ARN of the celery worker task definition"
  value       = aws_ecs_task_definition.celery_worker.arn
}

output "backend_task_definition_family" {
  description = "Family of the backend task definition"
  value       = aws_ecs_task_definition.backend.family
}

output "frontend_task_definition_family" {
  description = "Family of the frontend task definition"
  value       = aws_ecs_task_definition.frontend.family
}

output "celery_worker_task_definition_family" {
  description = "Family of the celery worker task definition"
  value       = aws_ecs_task_definition.celery_worker.family
}

output "backend_task_definition_revision" {
  description = "Revision of the backend task definition"
  value       = aws_ecs_task_definition.backend.revision
}

output "frontend_task_definition_revision" {
  description = "Revision of the frontend task definition"
  value       = aws_ecs_task_definition.frontend.revision
}

output "celery_worker_task_definition_revision" {
  description = "Revision of the celery worker task definition"
  value       = aws_ecs_task_definition.celery_worker.revision
}

# ECS Services
output "backend_service_id" {
  description = "ID of the backend ECS service"
  value       = aws_ecs_service.backend.id
}

output "frontend_service_id" {
  description = "ID of the frontend ECS service"
  value       = aws_ecs_service.frontend.id
}

output "celery_worker_service_id" {
  description = "ID of the celery worker ECS service"
  value       = aws_ecs_service.celery_worker.id
}

output "backend_service_name" {
  description = "Name of the backend ECS service"
  value       = aws_ecs_service.backend.name
}

output "frontend_service_name" {
  description = "Name of the frontend ECS service"
  value       = aws_ecs_service.frontend.name
}

output "celery_worker_service_name" {
  description = "Name of the celery worker ECS service"
  value       = aws_ecs_service.celery_worker.name
}

output "backend_service_arn" {
  description = "ARN of the backend ECS service"
  value       = aws_ecs_service.backend.id
}

output "frontend_service_arn" {
  description = "ARN of the frontend ECS service"
  value       = aws_ecs_service.frontend.id
}

output "celery_worker_service_arn" {
  description = "ARN of the celery worker ECS service"
  value       = aws_ecs_service.celery_worker.id
}

# IAM Roles
output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.name
}

output "ecs_task_role_name" {
  description = "Name of the ECS task role"
  value       = aws_iam_role.ecs_task.name
}

# Security Groups
output "ecs_tasks_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_tasks_security_group_arn" {
  description = "ARN of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.arn
}

# CloudWatch Log Groups
output "backend_log_group_name" {
  description = "Name of the backend CloudWatch log group"
  value       = aws_cloudwatch_log_group.backend.name
}

output "frontend_log_group_name" {
  description = "Name of the frontend CloudWatch log group"
  value       = aws_cloudwatch_log_group.frontend.name
}

output "celery_worker_log_group_name" {
  description = "Name of the celery worker CloudWatch log group"
  value       = aws_cloudwatch_log_group.celery_worker.name
}

output "backend_log_group_arn" {
  description = "ARN of the backend CloudWatch log group"
  value       = aws_cloudwatch_log_group.backend.arn
}

output "frontend_log_group_arn" {
  description = "ARN of the frontend CloudWatch log group"
  value       = aws_cloudwatch_log_group.frontend.arn
}

output "celery_worker_log_group_arn" {
  description = "ARN of the celery worker CloudWatch log group"
  value       = aws_cloudwatch_log_group.celery_worker.arn
}

# Auto Scaling
output "backend_autoscaling_target_arn" {
  description = "ARN of the backend autoscaling target"
  value       = var.enable_autoscaling ? aws_appautoscaling_target.backend[0].arn : null
}

output "backend_cpu_autoscaling_policy_arn" {
  description = "ARN of the backend CPU autoscaling policy"
  value       = var.enable_autoscaling ? aws_appautoscaling_policy.backend_cpu[0].arn : null
}

output "backend_memory_autoscaling_policy_arn" {
  description = "ARN of the backend memory autoscaling policy"
  value       = var.enable_autoscaling ? aws_appautoscaling_policy.backend_memory[0].arn : null
}

# Service Configuration
output "service_configuration" {
  description = "ECS service configuration summary"
  value = {
    cluster_name = aws_ecs_cluster.main.name
    services = {
      backend = {
        name         = aws_ecs_service.backend.name
        desired_count = aws_ecs_service.backend.desired_count
        task_definition = aws_ecs_task_definition.backend.family
        cpu          = var.backend_cpu
        memory       = var.backend_memory
        port         = var.backend_port
      }
      frontend = {
        name         = aws_ecs_service.frontend.name
        desired_count = aws_ecs_service.frontend.desired_count
        task_definition = aws_ecs_task_definition.frontend.family
        cpu          = var.frontend_cpu
        memory       = var.frontend_memory
        port         = var.frontend_port
      }
      celery_worker = {
        name         = aws_ecs_service.celery_worker.name
        desired_count = aws_ecs_service.celery_worker.desired_count
        task_definition = aws_ecs_task_definition.celery_worker.family
        cpu          = var.celery_cpu
        memory       = var.celery_memory
      }
    }
  }
}

# Resource ARNs for monitoring
output "resource_arns" {
  description = "ARNs of ECS resources for monitoring"
  value = {
    cluster           = aws_ecs_cluster.main.arn
    backend_service   = aws_ecs_service.backend.id
    frontend_service  = aws_ecs_service.frontend.id
    celery_service    = aws_ecs_service.celery_worker.id
    security_group    = aws_security_group.ecs_tasks.arn
    task_role         = aws_iam_role.ecs_task.arn
    execution_role    = aws_iam_role.ecs_task_execution.arn
  }
}

# Container Insights
output "container_insights_enabled" {
  description = "Whether Container Insights is enabled"
  value       = var.enable_container_insights
}

# Service endpoints for health checks
output "service_endpoints" {
  description = "Service endpoints for health checks"
  value = {
    backend_health_check = "http://localhost:${var.backend_port}/health"
    frontend_health_check = "http://localhost:${var.frontend_port}/health"
  }
}

# Deployment configuration
output "deployment_configuration" {
  description = "Deployment configuration for services"
  value = {
    backend = {
      minimum_healthy_percent = aws_ecs_service.backend.deployment_configuration[0].minimum_healthy_percent
      maximum_percent        = aws_ecs_service.backend.deployment_configuration[0].maximum_percent
    }
    frontend = {
      minimum_healthy_percent = aws_ecs_service.frontend.deployment_configuration[0].minimum_healthy_percent
      maximum_percent        = aws_ecs_service.frontend.deployment_configuration[0].maximum_percent
    }
    celery_worker = {
      minimum_healthy_percent = aws_ecs_service.celery_worker.deployment_configuration[0].minimum_healthy_percent
      maximum_percent        = aws_ecs_service.celery_worker.deployment_configuration[0].maximum_percent
    }
  }
}

# Task definition ARNs with revisions
output "task_definition_arns_with_revisions" {
  description = "Task definition ARNs with their current revisions"
  value = {
    backend      = "${aws_ecs_task_definition.backend.family}:${aws_ecs_task_definition.backend.revision}"
    frontend     = "${aws_ecs_task_definition.frontend.family}:${aws_ecs_task_definition.frontend.revision}"
    celery_worker = "${aws_ecs_task_definition.celery_worker.family}:${aws_ecs_task_definition.celery_worker.revision}"
  }
}

# Service discovery (if enabled)
output "service_discovery_services" {
  description = "Service discovery service ARNs"
  value = {
    enabled = var.enable_service_discovery
    namespace_id = var.service_discovery_namespace_id
  }
}

# Auto scaling configuration
output "autoscaling_configuration" {
  description = "Auto scaling configuration"
  value = var.enable_autoscaling ? {
    backend = {
      min_capacity = var.backend_min_capacity
      max_capacity = var.backend_max_capacity
      target_arn   = aws_appautoscaling_target.backend[0].arn
      policies = {
        cpu    = aws_appautoscaling_policy.backend_cpu[0].arn
        memory = aws_appautoscaling_policy.backend_memory[0].arn
      }
    }
  } : null
}

# Network configuration
output "network_configuration" {
  description = "Network configuration for ECS services"
  value = {
    vpc_id              = var.vpc_id
    private_subnet_ids  = var.private_subnet_ids
    security_group_ids  = [aws_security_group.ecs_tasks.id]
  }
}
