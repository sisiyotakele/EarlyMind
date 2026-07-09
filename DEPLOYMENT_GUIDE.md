# EarlyMind Phase 7 Deployment Guide

**Version:** 1.0  
**Date:** 2026-07-08  
**Status:** Phase 7 Infrastructure Setup  

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Steps](#deployment-steps)
4. [Security Checklist](#security-checklist)
5. [Monitoring & Logging](#monitoring--logging)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedure](#rollback-procedure)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Terraform** >= 1.0 (for infrastructure as code)
- **AWS CLI** v2 (configured with credentials)
- **Docker** (for local testing)
- **kubectl** (for future Kubernetes deployments, optional)
- **Git** (for version control)

### AWS Account Setup

1. **Create AWS account** with billing enabled
2. **Create IAM user** with `AdministratorAccess` policy (or custom policy, see below)
3. **Generate access keys** and configure locally:
   ```bash
   aws configure
   # Enter Access Key ID
   # Enter Secret Access Key
   # Region: us-east-1
   # Output format: json
   ```

4. **Create S3 bucket for Terraform state** (must be created manually first):
   ```bash
   aws s3api create-bucket --bucket earlymind-terraform-state --region us-east-1
   aws s3api put-bucket-versioning \
     --bucket earlymind-terraform-state \
     --versioning-configuration Status=Enabled
   aws s3api put-bucket-encryption \
     --bucket earlymind-terraform-state \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```

5. **Create DynamoDB table for Terraform locks**:
   ```bash
   aws dynamodb create-table \
     --table-name terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST \
     --region us-east-1
   ```

### Domain & SSL Certificate

1. **Purchase domain** (e.g., earlymind.app)
2. **Create ACM certificate** in AWS:
   ```bash
   aws acm request-certificate \
     --domain-name earlymind.app \
     --subject-alternative-names dashboard.earlymind.app \
     --region us-east-1 \
     --validation-method DNS
   ```
3. **Validate certificate** via DNS records (AWS provides instructions)
4. **Note the certificate ARN** for use in terraform.tfvars

---

## Architecture Overview

```
                        ┌─────────────────────────────┐
                        │     CloudFront CDN           │
                        │  (S3 static assets, 7-day)   │
                        └──────────────┬────────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │    Route 53 DNS             │
                        │  (earlymind.app)            │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │ ALB (HTTPS, WAF)            │
                        │ :443 → API servers          │
                        └──────────────┬──────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
    ┌───▼────┐  ┌────────┐  ┌────────┐│┌────────┐                     │
    │  EC2   │  │  EC2   │  │  EC2   ││  EC2   │ (Auto-scaling)      │
    │ API 1  │  │ API 2  │  │ API 3  ││ API 4  │ (min 2, max 4)      │
    └───┬────┘  └────┬───┘  └───┬────┘└────┬───┘                     │
        │            │          │          │                         │
        └────────────┼──────────┼──────────┘                         │
                     │          │                                    │
        ┌────────────▼──────────▼────────────┐                      │
        │  RDS Aurora PostgreSQL             │                      │
        │  Multi-AZ (Primary + Replica)      │                      │
        │  db.t3.medium, 100GB auto-scale    │                      │
        │  Encrypted (AES-256), Backups      │                      │
        └────────────────────────────────────┘                      │
                                                                     │
        ┌────────────────────────────────────────────┐              │
        │  EC2 ML Service (t3.large)                 │              │
        │  PyTorch Inference, Model Cache            │              │
        └────────────────────────────────────────────┘              │
                                                                     │
        ┌─────────────────────┬──────────────┬──────────────┐       │
        │ S3 Static           │ S3 Reports   │ S3 Models    │       │
        │ (CloudFront)        │ (Private)    │ (Private)    │       │
        └─────────────────────┴──────────────┴──────────────┘       │
```

---

## Deployment Steps

### Step 1: Clone Repository & Navigate to Infrastructure

```bash
git clone https://github.com/sisiyotakele/EarlyMind.git
cd EarlyMind/infra/terraform
```

### Step 2: Initialize Terraform

```bash
# Create terraform.tfvars (copy from template and fill values)
cp environments/staging.tfvars terraform.tfvars

# Initialize Terraform (downloads providers, sets up backend)
terraform init
```

### Step 3: Create terraform.tfvars with Secrets

Edit `terraform.tfvars` and fill in the **sensitive variables**:

```hcl
# Required: Fill these in before applying
db_master_username      = "earlymind_admin"
db_master_password      = "SecurePassword123!@#"  # Min 8 chars, mixed case + numbers + symbols
jwt_secret              = "your-jwt-secret-key"
gemini_api_key          = "your-google-gemini-api-key"
sms_provider_api_key    = "your-twilio-api-key"
acm_certificate_arn     = "arn:aws:acm:us-east-1:123456789:certificate/cert-id"
alarm_email             = "ops@earlymind.app"
```

### Step 4: Plan Deployment (Staging First)

```bash
# See what will be created (no changes yet)
terraform plan -out=tfplan

# Review the plan carefully
cat tfplan
```

### Step 5: Apply Infrastructure

```bash
# Apply the infrastructure (this takes 15-20 minutes)
terraform apply tfplan

# Terraform will output key information:
# - ALB DNS name
# - RDS endpoint
# - CloudFront domain
# - S3 bucket names
```

### Step 6: Verify Infrastructure

```bash
# Check that all resources were created
aws ec2 describe-instances --region us-east-1 | grep InstanceId
aws rds describe-db-clusters --region us-east-1

# Test ALB health check
curl http://<ALB_DNS_NAME>/health
# Expected response: {"status":"ok","timestamp":"..."}
```

### Step 7: Deploy Application Code

```bash
# Build Docker images
cd ../../apps/web
npm run build
docker build -t earlymind-web:latest .
# Push to ECR (AWS Elastic Container Registry)

cd ../../services/api
npm run build
docker build -t earlymind-api:latest .
# Push to ECR

cd ../../services/ml-service
docker build -t earlymind-ml:latest .
# Push to ECR
```

### Step 8: Configure DNS

```bash
# In Route 53 console or via AWS CLI:
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "earlymind.app",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "<CLOUDFRONT_DOMAIN>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

---

## Security Checklist

**Before deployment to production, verify:**

- [ ] All S3 buckets have encryption enabled (AES-256)
- [ ] RDS database has encryption at rest enabled
- [ ] VPC has private subnets for sensitive resources
- [ ] Security groups follow principle of least privilege
- [ ] WAF rules are enabled at CloudFront
- [ ] HTTPS is enforced (redirect HTTP → HTTPS)
- [ ] HSTS header is set (max-age >= 31536000)
- [ ] CSP header is configured
- [ ] API endpoints require authentication
- [ ] Database backups are automated (7-day retention)
- [ ] CloudWatch alarms are set up
- [ ] Monitoring role is attached to RDS instances
- [ ] KMS keys are configured for sensitive data
- [ ] Deletion protection is enabled on databases
- [ ] No hardcoded secrets in code or Terraform

---

## Monitoring & Logging

### CloudWatch Dashboards

```bash
# Create custom dashboard for API performance
aws cloudwatch put-dashboard \
  --dashboard-name "EarlyMind-API" \
  --dashboard-body file://monitoring/api-dashboard.json
```

### Alarms

```bash
# High CPU alarm (if >80% for 5 minutes)
aws cloudwatch put-metric-alarm \
  --alarm-name "earlymind-api-cpu-high" \
  --alarm-description "Alert if API CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1

# Database connections alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "earlymind-db-connections-high" \
  --alarm-description "Alert if DB connections exceed 80% capacity" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --threshold 75 \
  --comparison-operator GreaterThanThreshold
```

### Logs

- **API logs:** `/aws/ec2/earlymind-api` (CloudWatch Logs)
- **RDS logs:** `/aws/rds/earlymind-cluster` (PostgreSQL slow query log)
- **ML service logs:** `/aws/ec2/earlymind-ml` (PyTorch inference logs)

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# API health endpoint (through ALB)
curl https://earlymind.app/health
# Expected: {"status":"ok","timestamp":"..."}

# Database connectivity
psql -h $(terraform output -raw rds_endpoint) \
     -U earlymind_admin \
     -d earlymind \
     -c "SELECT version();"

# ML service inference test
curl http://<ML_PRIVATE_IP>:8000/health
```

### 2. Load Testing (Staging Only)

```bash
# Use k6 for load testing (install: brew install k6)
k6 run tests/load-test.js --vus 100 --duration 5m
```

### 3. Data Migration

```bash
# Run database migrations if needed
cd services/api
npx prisma migrate deploy --skip-generate

# Seed initial data (optional)
npx prisma db seed
```

### 4. SSL/TLS Validation

```bash
# Check certificate validity
echo | openssl s_client -servername earlymind.app -connect earlymind.app:443 2>/dev/null | openssl x509 -noout -dates

# Verify HSTS header is present
curl -I https://earlymind.app | grep Strict-Transport-Security
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Rollback Procedure

### Option 1: Terraform Rollback

```bash
# View Terraform state history
terraform state list

# Rollback to previous state (use with caution!)
terraform destroy -var-file=terraform.tfvars
```

### Option 2: Blue-Green Deployment (No Downtime)

```bash
# Create new auto-scaling group (green)
terraform apply -target=module.asg_api_v2

# Redirect ALB to new ASG gradually
# Monitor error rates before cutting over fully
```

### Option 3: Database Rollback

```bash
# Restore from RDS snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier earlymind-restore \
  --snapshot-identifier earlymind-snapshot-2026-07-08
```

---

## Troubleshooting

### API Instances Not Launching

```bash
# Check ASG activity
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name earlymind-api-asg \
  --region us-east-1

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx \
  --region us-east-1
```

### Database Connection Errors

```bash
# Verify security group allows API → DB
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=sg-db-xxxxx" \
  --region us-east-1

# Check RDS connectivity from EC2 instance
ssh ec2-user@<API_INSTANCE_IP>
psql -h <RDS_ENDPOINT> -U earlymind_admin -d earlymind -c "SELECT 1;"
```

### CloudFront Cache Issues

```bash
# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"

# Check cache behavior
curl -I https://earlymind.app/assets/app.js | grep X-Cache
```

### High Latency

```bash
# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...

# Monitor RDS Performance Insights
# (AWS Console → RDS → Performance Insights)
```

---

## Support & Escalation

- **Technical Issues:** File issue on GitHub
- **Security Issues:** Email security@earlymind.app
- **Operations:** ops@earlymind.app
- **Emergency:** Call on-call number

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-08  
**Maintained By:** EarlyMind DevOps Team
