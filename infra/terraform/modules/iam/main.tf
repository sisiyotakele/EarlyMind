/**
 * IAM Module - Identity and Access Management
 * Principle of least privilege for API and ML service roles
 */

# ─────────────────────────────────────────────────────────────────
# IAM Role for API Servers
# ─────────────────────────────────────────────────────────────────

resource "aws_iam_role" "api" {
  name_prefix = "${var.project_name}-api-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-api-role-${var.environment}"
  }
}

resource "aws_iam_instance_profile" "api" {
  name_prefix = "${var.project_name}-api-"
  role        = aws_iam_role.api.name
}

# Allow API to write to S3 (reports, models)
resource "aws_iam_role_policy" "api_s3" {
  name_prefix = "api-s3-"
  role        = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${var.s3_bucket_arns.reports}/*",
          "${var.s3_bucket_arns.models}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = [
          var.s3_bucket_arns.reports,
          var.s3_bucket_arns.models
        ]
      }
    ]
  })
}

# Allow API to write CloudWatch logs
resource "aws_iam_role_policy" "api_logs" {
  name_prefix = "api-logs-"
  role        = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${var.cloudwatch_log_group_arn}/*"
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────
# IAM Role for ML Service
# ─────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ml" {
  name_prefix = "${var.project_name}-ml-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ml-role-${var.environment}"
  }
}

resource "aws_iam_instance_profile" "ml" {
  name_prefix = "${var.project_name}-ml-"
  role        = aws_iam_role.ml.name
}

# Allow ML to read models from S3
resource "aws_iam_role_policy" "ml_s3" {
  name_prefix = "ml-s3-"
  role        = aws_iam_role.ml.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arns.models,
          "${var.s3_bucket_arns.models}/*"
        ]
      }
    ]
  })
}

# Allow ML to write CloudWatch logs
resource "aws_iam_role_policy" "ml_logs" {
  name_prefix = "ml-logs-"
  role        = aws_iam_role.ml.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${var.cloudwatch_log_group_arn}/*"
      }
    ]
  })
}
