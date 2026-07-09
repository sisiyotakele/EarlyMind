/**
 * RDS Aurora PostgreSQL Module
 * SRS §2.4.3: db.t3.medium, Multi-AZ, 100GB auto-scaling, daily snapshots (7-day retention)
 * SRS §2.4.4: AES-256 encryption at rest via KMS
 */

# ─────────────────────────────────────────────────────────────────
# DB Subnet Group (for Multi-AZ deployment)
# ─────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name_prefix            = "${var.project_name}-"
  subnet_ids             = var.private_subnet_ids
  skip_final_snapshot    = false
  final_snapshot_identifier_prefix = "${var.project_name}-final-snapshot"

  tags = {
    Name = "${var.project_name}-db-subnet-group-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# RDS Aurora PostgreSQL Cluster
# ─────────────────────────────────────────────────────────────────

resource "aws_rds_cluster" "main" {
  cluster_identifier              = "${var.project_name}-db-${var.environment}"
  engine                          = "aurora-postgresql"
  engine_version                  = "14.7"
  database_name                   = var.database_name
  master_username                 = var.master_username
  master_password                 = var.master_password
  db_subnet_group_name            = aws_db_subnet_group.main.name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name
  vpc_security_group_ids          = [var.db_security_group_id]

  # Backup & Recovery (SRS: daily snapshots, 7-day retention)
  backup_retention_period      = var.backup_retention_days
  preferred_backup_window      = var.backup_window
  preferred_maintenance_window = var.maintenance_window
  copy_tags_to_snapshot        = true

  # Multi-AZ for high availability
  availability_zones = slice(data.aws_availability_zones.available.names, 0, length(var.private_subnet_ids))

  # Encryption (SRS §2.4.4: AES-256)
  storage_encrypted   = true
  kms_key_id          = var.kms_key_id
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  # Enable CloudWatch logs
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Performance Insights (for monitoring)
  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_id
  performance_insights_retention_period = 7

  # Deletion protection
  deletion_protection = true

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  tags = {
    Name = "${var.project_name}-cluster-${var.environment}"
  }

  lifecycle {
    ignore_changes = [master_password]
  }

  depends_on = [aws_db_subnet_group.main]
}

# ─────────────────────────────────────────────────────────────────
# RDS Cluster Instances (Primary + Read Replica)
# ─────────────────────────────────────────────────────────────────

resource "aws_rds_cluster_instance" "primary" {
  cluster_identifier           = aws_rds_cluster.main.id
  instance_class               = var.instance_class
  engine                       = aws_rds_cluster.main.engine
  engine_version               = aws_rds_cluster.main.engine_version
  publicly_accessible          = false
  auto_minor_version_upgrade   = true
  monitoring_interval          = 60  # Enhanced monitoring every 60 seconds
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  identifier                   = "${var.project_name}-db-instance-1-${var.environment}"

  tags = {
    Name = "${var.project_name}-db-primary-${var.environment}"
    Role = "Primary"
  }
}

resource "aws_rds_cluster_instance" "replica" {
  cluster_identifier           = aws_rds_cluster.main.id
  instance_class               = var.instance_class
  engine                       = aws_rds_cluster.main.engine
  engine_version               = aws_rds_cluster.main.engine_version
  publicly_accessible          = false
  auto_minor_version_upgrade   = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  identifier                   = "${var.project_name}-db-instance-2-${var.environment}"

  tags = {
    Name = "${var.project_name}-db-replica-${var.environment}"
    Role = "Replica"
  }

  depends_on = [aws_rds_cluster_instance.primary]
}

# ─────────────────────────────────────────────────────────────────
# DB Cluster Parameter Group
# ─────────────────────────────────────────────────────────────────

resource "aws_rds_cluster_parameter_group" "main" {
  name_prefix = "${var.project_name}-"
  family      = "aurora-postgresql14"
  description = "Cluster parameter group for ${var.project_name}"

  # Log queries taking longer than 1 second (for performance analysis)
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Enable query logging
  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  tags = {
    Name = "${var.project_name}-db-cluster-param-group-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# IAM Role for Enhanced Monitoring
# ─────────────────────────────────────────────────────────────────

resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "${var.project_name}-rds-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-rds-monitoring-role-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ─────────────────────────────────────────────────────────────────
# Data Sources
# ─────────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}
