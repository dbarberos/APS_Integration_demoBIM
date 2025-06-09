# Variables for AWS VPC Module

variable "project_name" {
  description = "Name of the project"
  type        = string
  validation {
    condition     = length(var.project_name) > 0
    error_message = "Project name cannot be empty."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least two public subnets are required for high availability."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least two private subnets are required for high availability."
  }
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.100.0/24", "10.0.200.0/24"]
  validation {
    condition     = length(var.database_subnet_cidrs) >= 2
    error_message = "At least two database subnets are required for RDS subnet group."
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for outbound internet access from private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for all private subnets (cost optimization)"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in the VPC"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Number of days to retain flow logs"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.flow_logs_retention_days)
    error_message = "Flow logs retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "enable_s3_endpoint" {
  description = "Enable S3 VPC Endpoint"
  type        = bool
  default     = true
}

variable "enable_dynamodb_endpoint" {
  description = "Enable DynamoDB VPC Endpoint"
  type        = bool
  default     = false
}

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default = {
    Terraform   = "true"
    Environment = "production"
    Project     = "aps-integration"
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

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = []
  validation {
    condition     = length(var.availability_zones) == 0 || length(var.availability_zones) >= 2
    error_message = "If specified, at least two availability zones must be provided."
  }
}

variable "enable_internet_gateway" {
  description = "Enable Internet Gateway"
  type        = bool
  default     = true
}

variable "enable_public_subnets" {
  description = "Enable public subnets"
  type        = bool
  default     = true
}

variable "enable_private_subnets" {
  description = "Enable private subnets"
  type        = bool
  default     = true
}

variable "enable_database_subnets" {
  description = "Enable database subnets"
  type        = bool
  default     = true
}

variable "enable_network_acls" {
  description = "Enable custom Network ACLs"
  type        = bool
  default     = true
}

variable "create_database_subnet_group" {
  description = "Create database subnet group"
  type        = bool
  default     = true
}

variable "create_elasticache_subnet_group" {
  description = "Create ElastiCache subnet group"
  type        = bool
  default     = true
}

variable "public_subnet_tags" {
  description = "Additional tags for public subnets"
  type        = map(string)
  default     = {}
}

variable "private_subnet_tags" {
  description = "Additional tags for private subnets"
  type        = map(string)
  default     = {}
}

variable "database_subnet_tags" {
  description = "Additional tags for database subnets"
  type        = map(string)
  default     = {}
}

variable "vpc_tags" {
  description = "Additional tags for the VPC"
  type        = map(string)
  default     = {}
}

variable "igw_tags" {
  description = "Additional tags for the Internet Gateway"
  type        = map(string)
  default     = {}
}

variable "nat_gateway_tags" {
  description = "Additional tags for NAT Gateways"
  type        = map(string)
  default     = {}
}

variable "nat_eip_tags" {
  description = "Additional tags for NAT EIPs"
  type        = map(string)
  default     = {}
}
