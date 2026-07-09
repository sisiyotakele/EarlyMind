/**
 * Terraform Variables - Phase 7 Infrastructure
 * These are set via terraform.tfvars or environment variables
 */

# ──────────────────────────────────────────────────────────────────
# General AWS Configuration
# ──────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "earlymind"
}

variable "environment" {
  description = "Environment (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

# ──────────────────────────────────────────────────────────────────
# VPC & Networking
# ──────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ──────────────────────────────────────────────────────────────────
# Database Configuration
# ──────────────────────────────────────────────────────────────────

variable "database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "earlymind"
}

variable "db_master_username" {
  description = "RDS master username"
  type        = string
  sensitive   = true
}

variable "db_master_password" {
  description = "RDS master password (min 8 chars, must include uppercase, lowercase, number, special char)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class (SRS: db.t3.medium)"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "db_backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "mon:04:00-mon:05:00"
}

# ──────────────────────────────────────────────────────────────────
# API Configuration (ASG EC2)
# ──────────────────────────────────────────────────────────────────

variable "api_instance_type" {
  description = "EC2 instance type for API servers (SRS: t3.medium)"
  type        = string
  default     = "t3.medium"
}

variable "api_min_instances" {
  description = "Minimum number of API instances"
  type        = number
  default     = 2
}

variable "api_max_instances" {
  description = "Maximum number of API instances"
  type        = number
  default     = 4
}

variable "api_desired_instances" {
  description = "Desired number of API instances"
  type        = number
  default     = 2
}

# ──────────────────────────────────────────────────────────────────
# ML Service Configuration
# ──────────────────────────────────────────────────────────────────

variable "ml_instance_type" {
  description = "EC2 instance type for ML service (SRS: t3.large)"
  type        = string
  default     = "t3.large"
}

variable "ml_model_version" {
  description = "ML model version to deploy"
  type        = string
  default     = "v0.1.0"
}

# ──────────────────────────────────────────────────────────────────
# API Secrets & Configuration
# ──────────────────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT secret key for session tokens"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key for report generation"
  type        = string
  sensitive   = true
}

variable "sms_provider_api_key" {
  description = "SMS provider API key (e.g., Twilio)"
  type        = string
  sensitive   = true
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins (comma-separated)"
  type        = string
  default     = "https://earlymind.app,https://dashboard.earlymind.app"
}

# ──────────────────────────────────────────────────────────────────
# SSL/TLS & Domain
# ──────────────────────────────────────────────────────────────────

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (must be pre-created)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for Route 53"
  type        = string
  default     = "earlymind.app"
}

# ──────────────────────────────────────────────────────────────────
# WAF Rules
# ──────────────────────────────────────────────────────────────────

variable "waf_rules" {
  description = "WAF rules configuration"
  type = object({
    rate_limit_per_5_mins = number
    enable_geo_blocking   = bool
    blocked_countries     = list(string)
  })
  default = {
    rate_limit_per_5_mins = 500
    enable_geo_blocking   = false
    blocked_countries     = []
  }
}

# ──────────────────────────────────────────────────────────────────
# Monitoring
# ──────────────────────────────────────────────────────────────────

variable "alarm_email" {
  description = "Email for CloudWatch alarms"
  type        = string
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}
