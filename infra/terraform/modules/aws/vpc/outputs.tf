# Outputs for AWS VPC Module

# VPC
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_arn" {
  description = "ARN of the VPC"
  value       = aws_vpc.main.arn
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "vpc_instance_tenancy" {
  description = "Tenancy of instances spin up within VPC"
  value       = aws_vpc.main.instance_tenancy
}

output "vpc_enable_dns_support" {
  description = "Whether or not the VPC has DNS support"
  value       = aws_vpc.main.enable_dns_support
}

output "vpc_enable_dns_hostnames" {
  description = "Whether or not the VPC has DNS hostname support"
  value       = aws_vpc.main.enable_dns_hostnames
}

output "vpc_main_route_table_id" {
  description = "ID of the main route table associated with this VPC"
  value       = aws_vpc.main.main_route_table_id
}

output "vpc_default_network_acl_id" {
  description = "ID of the default network ACL"
  value       = aws_vpc.main.default_network_acl_id
}

output "vpc_default_security_group_id" {
  description = "ID of the security group created by default on VPC creation"
  value       = aws_vpc.main.default_security_group_id
}

output "vpc_default_route_table_id" {
  description = "ID of the default route table"
  value       = aws_vpc.main.default_route_table_id
}

# Internet Gateway
output "igw_id" {
  description = "ID of the Internet Gateway"
  value       = var.enable_internet_gateway ? aws_internet_gateway.main.id : null
}

output "igw_arn" {
  description = "ARN of the Internet Gateway"
  value       = var.enable_internet_gateway ? aws_internet_gateway.main.arn : null
}

# Subnets
output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_arns" {
  description = "List of ARNs of public subnets"
  value       = aws_subnet.public[*].arn
}

output "public_subnet_cidr_blocks" {
  description = "List of CIDR blocks of public subnets"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "private_subnet_arns" {
  description = "List of ARNs of private subnets"
  value       = aws_subnet.private[*].arn
}

output "private_subnet_cidr_blocks" {
  description = "List of CIDR blocks of private subnets"
  value       = aws_subnet.private[*].cidr_block
}

output "database_subnet_ids" {
  description = "List of IDs of database subnets"
  value       = aws_subnet.database[*].id
}

output "database_subnet_arns" {
  description = "List of ARNs of database subnets"
  value       = aws_subnet.database[*].arn
}

output "database_subnet_cidr_blocks" {
  description = "List of CIDR blocks of database subnets"
  value       = aws_subnet.database[*].cidr_block
}

# NAT Gateway
output "nat_gateway_ids" {
  description = "List of IDs of NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_public_ips" {
  description = "List of public Elastic IPs associated with NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}

output "nat_gateway_private_ips" {
  description = "List of private IPs associated with NAT Gateways"
  value       = aws_nat_gateway.main[*].private_ip
}

output "nat_gateway_subnet_ids" {
  description = "List of subnet IDs containing NAT Gateways"
  value       = aws_nat_gateway.main[*].subnet_id
}

# Route Tables
output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of IDs of private route tables"
  value       = aws_route_table.private[*].id
}

output "database_route_table_id" {
  description = "ID of the database route table"
  value       = aws_route_table.database.id
}

# Network ACLs
output "public_network_acl_id" {
  description = "ID of the public network ACL"
  value       = var.enable_network_acls ? aws_network_acl.public.id : null
}

output "private_network_acl_id" {
  description = "ID of the private network ACL"
  value       = var.enable_network_acls ? aws_network_acl.private.id : null
}

output "database_network_acl_id" {
  description = "ID of the database network ACL"
  value       = var.enable_network_acls ? aws_network_acl.database.id : null
}

# VPC Endpoints
output "s3_vpc_endpoint_id" {
  description = "ID of the S3 VPC Endpoint"
  value       = var.enable_s3_endpoint ? aws_vpc_endpoint.s3[0].id : null
}

output "dynamodb_vpc_endpoint_id" {
  description = "ID of the DynamoDB VPC Endpoint"
  value       = var.enable_dynamodb_endpoint ? aws_vpc_endpoint.dynamodb[0].id : null
}

# Flow Logs
output "vpc_flow_log_id" {
  description = "ID of the VPC Flow Log"
  value       = var.enable_flow_logs ? aws_flow_log.vpc[0].id : null
}

output "vpc_flow_log_cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group for VPC Flow Logs"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.vpc_flow_log[0].name : null
}

# Availability Zones
output "availability_zones" {
  description = "List of availability zones used"
  value       = data.aws_availability_zones.available.names
}

# Region
output "aws_region" {
  description = "AWS region"
  value       = data.aws_region.current.name
}

# Useful computed values
output "vpc_cidr_block_associations" {
  description = "List of CIDR block association IDs"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_count" {
  description = "Number of public subnets"
  value       = length(aws_subnet.public)
}

output "private_subnet_count" {
  description = "Number of private subnets"
  value       = length(aws_subnet.private)
}

output "database_subnet_count" {
  description = "Number of database subnets"
  value       = length(aws_subnet.database)
}

output "nat_gateway_count" {
  description = "Number of NAT Gateways"
  value       = length(aws_nat_gateway.main)
}

# Subnet mappings for ALB/ECS
output "subnet_mapping" {
  description = "Map of subnet types to subnet IDs"
  value = {
    public   = aws_subnet.public[*].id
    private  = aws_subnet.private[*].id
    database = aws_subnet.database[*].id
  }
}

# All subnet IDs
output "all_subnet_ids" {
  description = "List of all subnet IDs"
  value       = concat(aws_subnet.public[*].id, aws_subnet.private[*].id, aws_subnet.database[*].id)
}

# Network configuration summary
output "network_configuration" {
  description = "Network configuration summary"
  value = {
    vpc_id               = aws_vpc.main.id
    vpc_cidr             = aws_vpc.main.cidr_block
    availability_zones   = data.aws_availability_zones.available.names
    public_subnets       = aws_subnet.public[*].id
    private_subnets      = aws_subnet.private[*].id
    database_subnets     = aws_subnet.database[*].id
    nat_gateways         = aws_nat_gateway.main[*].id
    internet_gateway     = aws_internet_gateway.main.id
    route_tables = {
      public   = aws_route_table.public.id
      private  = aws_route_table.private[*].id
      database = aws_route_table.database.id
    }
  }
}
