/**
 * S3 Module - Object Storage
 * SRS §2.4.3: S3 buckets for static assets, reports, models, backups
 * SRS §2.4.4: Encryption at rest (AES-256), private access
 */

# ─────────────────────────────────────────────────────────────────
# S3 Bucket: Static Assets (CDN via CloudFront)
# ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "static" {
  bucket_prefix = "${var.project_name}-static-"

  tags = {
    Name = "${var.project_name}-static-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────
# S3 Bucket: Reports (Private, Accessed via Signed URLs)
# ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "reports" {
  bucket_prefix = "${var.project_name}-reports-"

  tags = {
    Name = "${var.project_name}-reports-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket = aws_s3_bucket.reports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle: Delete old reports after 90 days (GDPR retention)
resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "delete-old-reports"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ─────────────────────────────────────────────────────────────────
# S3 Bucket: ML Models (Private)
# ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "models" {
  bucket_prefix = "${var.project_name}-models-"

  tags = {
    Name = "${var.project_name}-models-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "models" {
  bucket = aws_s3_bucket.models.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "models" {
  bucket = aws_s3_bucket.models.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "models" {
  bucket = aws_s3_bucket.models.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────
# S3 Bucket: Backups (Private, Encrypted)
# ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "backups" {
  bucket_prefix = "${var.project_name}-backups-"

  tags = {
    Name = "${var.project_name}-backups-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle: Transition old backups to Glacier after 30 days (cost optimization)
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "archive-old-backups"
    status = "Enabled"

    transitions {
      days          = 30
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 7
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# ─────────────────────────────────────────────────────────────────
# Bucket Policies (Principle of Least Privilege)
# ─────────────────────────────────────────────────────────────────

# Static bucket: Allow CloudFront only
resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOnly"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::cloudfront:user/CloudFront Origin Access Principal/${var.cloudfront_oai_id}"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static.arn}/*"
      }
    ]
  })
}

# Deny unencrypted uploads
resource "aws_s3_bucket_policy" "deny_unencrypted" {
  for_each = {
    static   = aws_s3_bucket.static.id
    reports  = aws_s3_bucket.reports.id
    models   = aws_s3_bucket.models.id
    backups  = aws_s3_bucket.backups.id
  }

  bucket = each.value

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.static[each.key].arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket.static,
    aws_s3_bucket.reports,
    aws_s3_bucket.models,
    aws_s3_bucket.backups,
  ]
}

# ─────────────────────────────────────────────────────────────────
# Logging (optional: for audit trail)
# ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_logging" "buckets" {
  for_each = {
    static  = aws_s3_bucket.static.id
    reports = aws_s3_bucket.reports.id
    models  = aws_s3_bucket.models.id
  }

  bucket = each.value

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "${each.key}/"
}

resource "aws_s3_bucket" "logs" {
  bucket_prefix = "${var.project_name}-logs-"

  tags = {
    Name = "${var.project_name}-s3-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
