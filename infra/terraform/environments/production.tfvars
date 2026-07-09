# Production Environment Configuration
# Usage: terraform apply -var-file=environments/production.tfvars
# ⚠️  WARNING: Changes here affect live system. Review carefully before apply.

aws_region  = "us-east-1"
project_name = "earlymind"
environment = "production"

# VPC Configuration
vpc_cidr               = "10.0.0.0/16"
availability_zones     = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs   = ["10.0.10.0/24", "10.0.11.0/24"]

# Database Configuration (SRS §2.4.3: db.t3.medium, 100GB)
database_name                = "earlymind"
db_instance_class            = "db.t3.medium"
db_allocated_storage         = 100
db_backup_retention_days     = 7  # SRS requirement
db_backup_window             = "03:00-04:00"
db_maintenance_window        = "mon:04:00-mon:05:00"

# API Configuration (SRS: 2 instances, scale to 4)
api_instance_type      = "t3.medium"
api_min_instances      = 2
api_max_instances      = 4
api_desired_instances  = 2

# ML Service (SRS: t3.large, scale to 2)
ml_instance_type   = "t3.large"
ml_model_version   = "v0.1.0"

# Domain & SSL
domain_name          = "earlymind.app"
acm_certificate_arn  = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# WAF Configuration (stricter for production)
waf_rules = {
  rate_limit_per_5_mins = 500
  enable_geo_blocking   = true
  blocked_countries     = []  # Add countries outside Ethiopia if needed
}

# Monitoring (send to security team)
alarm_email                 = "ops@earlymind.app"
enable_detailed_monitoring  = true

# CORS (production domains only)
cors_allowed_origins = "https://earlymind.app,https://dashboard.earlymind.app"
