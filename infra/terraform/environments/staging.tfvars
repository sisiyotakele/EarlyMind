# Staging Environment Configuration
# Usage: terraform apply -var-file=environments/staging.tfvars

aws_region  = "us-east-1"
project_name = "earlymind"
environment = "staging"

# VPC Configuration
vpc_cidr               = "10.0.0.0/16"
availability_zones     = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs   = ["10.0.10.0/24", "10.0.11.0/24"]

# Database Configuration
database_name                = "earlymind_staging"
db_instance_class            = "db.t3.medium"
db_allocated_storage         = 50  # Smaller for staging
db_backup_retention_days     = 7
db_backup_window             = "03:00-04:00"
db_maintenance_window        = "mon:04:00-mon:05:00"

# API Configuration (smaller auto-scaling for staging)
api_instance_type      = "t3.medium"
api_min_instances      = 1
api_max_instances      = 2
api_desired_instances  = 1

# ML Service
ml_instance_type   = "t3.large"
ml_model_version   = "v0.1.0"

# Domain & SSL
domain_name          = "staging.earlymind.app"
acm_certificate_arn  = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# WAF Configuration
waf_rules = {
  rate_limit_per_5_mins = 500
  enable_geo_blocking   = false
  blocked_countries     = []
}

# Monitoring
alarm_email                 = "devops@earlymind.app"
enable_detailed_monitoring  = true

# CORS
cors_allowed_origins = "https://staging.earlymind.app,https://staging-dashboard.earlymind.app"
