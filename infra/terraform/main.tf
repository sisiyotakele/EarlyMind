/**
 * EarlyMind Terraform Main Configuration
 * Phase 7: Infrastructure Deployment
 * 
 * Architecture (SRS §2.4.3):
 * - CloudFront CDN → Static assets (S3)
 * - ALB → Auto-scaling API (EC2, t3.medium)
 * - RDS Aurora PostgreSQL (db.t3.medium, Multi-AZ)
 * - ML Service (EC2 t3.large, Python/PyTorch)
 * - S3 buckets: static, reports, models, backups
 * - VPC with private subnets for DB/ML
 * - IAM roles for principle of least privilege
 * 
 * Security (SRS §2.4.4):
 * - TLS 1.2+, HSTS, CSP headers
 * - WAF at CloudFront (SQLi/XSS, rate limiting 100 req/min/IP)
 * - Encryption at rest (AES-256) and in transit (TLS)
 * - KMS key management
 */

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Store state in S3 with locking (DynamoDB)
  backend "s3" {
    bucket         = "earlymind-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "EarlyMind"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# ──────────────────────────────────────────────────────────────────
# VPC & Networking
# ──────────────────────────────────────────────────────────────────

module "vpc" {
  source = "./modules/vpc"

  project_name           = var.project_name
  environment            = var.environment
  vpc_cidr               = var.vpc_cidr
  availability_zones     = var.availability_zones
  public_subnet_cidrs    = var.public_subnet_cidrs
  private_subnet_cidrs   = var.private_subnet_cidrs
  enable_nat_gateway     = true
  enable_vpc_endpoints   = true  # For S3, DynamoDB
}

# ──────────────────────────────────────────────────────────────────
# Security Groups
# ──────────────────────────────────────────────────────────────────

module "security_groups" {
  source = "./modules/security_groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
}

# ──────────────────────────────────────────────────────────────────
# S3 Buckets (SRS §2.4.3: static, reports, models, backups)
# ──────────────────────────────────────────────────────────────────

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  kms_key_id   = module.kms.s3_key_id
}

# ──────────────────────────────────────────────────────────────────
# KMS Keys (encryption at rest)
# ──────────────────────────────────────────────────────────────────

module "kms" {
  source = "./modules/kms"

  project_name = var.project_name
  environment  = var.environment
}

# ──────────────────────────────────────────────────────────────────
# RDS Aurora PostgreSQL (SRS §2.4.3: db.t3.medium, Multi-AZ)
# ──────────────────────────────────────────────────────────────────

module "rds" {
  source = "./modules/rds"

  project_name             = var.project_name
  environment              = var.environment
  database_name            = var.database_name
  master_username          = var.db_master_username
  master_password          = var.db_master_password
  instance_class           = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  db_security_group_id     = module.security_groups.db_security_group_id
  kms_key_id               = module.kms.rds_key_id
  backup_retention_days    = var.db_backup_retention_days
  backup_window            = var.db_backup_window
  maintenance_window       = var.db_maintenance_window
  multi_az                 = true
  enable_storage_autoscaling = true
}

# ──────────────────────────────────────────────────────────────────
# IAM Roles (principle of least privilege)
# ──────────────────────────────────────────────────────────────────

module "iam" {
  source = "./modules/iam"

  project_name      = var.project_name
  environment       = var.environment
  s3_bucket_arns    = module.s3.bucket_arns
  cloudwatch_log_group_arn = module.monitoring.log_group_arn
}

# ──────────────────────────────────────────────────────────────────
# ALB (Application Load Balancer)
# ──────────────────────────────────────────────────────────────────

module "alb" {
  source = "./modules/alb"

  project_name              = var.project_name
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  public_subnet_ids         = module.vpc.public_subnet_ids
  alb_security_group_id     = module.security_groups.alb_security_group_id
  enable_https              = true
  certificate_arn           = var.acm_certificate_arn
  health_check_path         = "/health"
  health_check_interval     = 30
  health_check_timeout      = 10
}

# ──────────────────────────────────────────────────────────────────
# Auto-scaling EC2 (API Servers: t3.medium, SRS §2.4.3)
# ──────────────────────────────────────────────────────────────────

module "asg_api" {
  source = "./modules/asg_api"

  project_name               = var.project_name
  environment                = var.environment
  instance_type              = var.api_instance_type
  min_size                   = var.api_min_instances
  max_size                   = var.api_max_instances
  desired_capacity           = var.api_desired_instances
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  api_security_group_id      = module.security_groups.api_security_group_id
  iam_instance_profile_name  = module.iam.api_instance_profile_name
  target_group_arn           = module.alb.target_group_arn
  
  # Environment variables for API container
  api_environment = {
    NODE_ENV                = var.environment
    DATABASE_URL            = module.rds.connection_string
    ML_SERVICE_URL          = "http://${module.ml_service.ec2_private_ip}:8000"
    REDIS_URL               = "redis://localhost:6379"  # For session store
    JWT_SECRET              = var.jwt_secret
    SESSION_EXPIRY_DAYS     = "7"
    S3_BUCKET_REPORTS       = module.s3.reports_bucket_name
    S3_BUCKET_MODELS        = module.s3.models_bucket_name
    GEMINI_API_KEY          = var.gemini_api_key
    SMS_PROVIDER_API_KEY    = var.sms_provider_api_key
    CORS_ALLOWED_ORIGINS    = var.cors_allowed_origins
  }

  ami_owner = "amazon"
  ami_name  = "amzn2-ami-hvm-*-x86_64-gp2"

  tags = {
    Name = "${var.project_name}-api-asg-${var.environment}"
  }
}

# ──────────────────────────────────────────────────────────────────
# ML Service (EC2: t3.large, Python/PyTorch, SRS §9.3)
# ──────────────────────────────────────────────────────────────────

module "ml_service" {
  source = "./modules/ml_service"

  project_name               = var.project_name
  environment                = var.environment
  instance_type              = var.ml_instance_type
  vpc_id                     = module.vpc.vpc_id
  private_subnet_id          = module.vpc.private_subnet_ids[0]
  ml_security_group_id       = module.security_groups.ml_security_group_id
  iam_instance_profile_name  = module.iam.ml_instance_profile_name

  ml_environment = {
    NODE_ENV            = var.environment
    DATABASE_URL        = module.rds.connection_string
    MODEL_VERSION       = var.ml_model_version
    S3_BUCKET_MODELS    = module.s3.models_bucket_name
    AWS_REGION          = var.aws_region
    INFERENCE_TIMEOUT   = "30"
    MAX_BATCH_SIZE      = "32"
  }

  ami_owner = "canonical"
  ami_name  = "ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"

  tags = {
    Name = "${var.project_name}-ml-service-${var.environment}"
  }
}

# ──────────────────────────────────────────────────────────────────
# CloudFront CDN (SRS §2.4.3: serves static from S3, 7-day TTL)
# ──────────────────────────────────────────────────────────────────

module "cloudfront" {
  source = "./modules/cloudfront"

  project_name          = var.project_name
  environment           = var.environment
  s3_bucket_name        = module.s3.static_bucket_name
  s3_regional_domain    = module.s3.static_bucket_regional_domain
  alb_domain_name       = module.alb.dns_name
  certificate_arn       = var.acm_certificate_arn
  domain_name           = var.domain_name
  enable_waf            = true  # WAF at CloudFront edge
  waf_rules             = var.waf_rules

  tags = {
    Name = "${var.project_name}-cdn-${var.environment}"
  }
}

# ──────────────────────────────────────────────────────────────────
# Route 53 DNS
# ──────────────────────────────────────────────────────────────────

module "route53" {
  source = "./modules/route53"

  project_name       = var.project_name
  domain_name        = var.domain_name
  cloudfront_domain  = module.cloudfront.domain_name
  cloudfront_zone_id = module.cloudfront.zone_id
}

# ──────────────────────────────────────────────────────────────────
# Monitoring & Logging (CloudWatch)
# ──────────────────────────────────────────────────────────────────

module "monitoring" {
  source = "./modules/monitoring"

  project_name           = var.project_name
  environment            = var.environment
  api_asg_name           = module.asg_api.asg_name
  ml_instance_id         = module.ml_service.instance_id
  rds_cluster_id         = module.rds.cluster_id
  cloudfront_distribution_id = module.cloudfront.distribution_id
  alarm_email            = var.alarm_email

  tags = {
    Name = "${var.project_name}-monitoring-${var.environment}"
  }
}

# ──────────────────────────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.domain_name
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
  sensitive   = true
}

output "s3_static_bucket" {
  description = "S3 bucket for static assets"
  value       = module.s3.static_bucket_name
}

output "api_auto_scaling_group" {
  description = "API Auto Scaling Group name"
  value       = module.asg_api.asg_name
}

output "ml_service_private_ip" {
  description = "ML Service EC2 private IP"
  value       = module.ml_service.ec2_private_ip
}
