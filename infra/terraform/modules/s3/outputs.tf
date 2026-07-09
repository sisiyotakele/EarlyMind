output "static_bucket_name" {
  description = "Static assets S3 bucket name"
  value       = aws_s3_bucket.static.id
}

output "static_bucket_regional_domain" {
  description = "Static bucket regional domain for CloudFront"
  value       = aws_s3_bucket.static.bucket_regional_domain_name
}

output "reports_bucket_name" {
  description = "Reports S3 bucket name"
  value       = aws_s3_bucket.reports.id
}

output "models_bucket_name" {
  description = "Models S3 bucket name"
  value       = aws_s3_bucket.models.id
}

output "backups_bucket_name" {
  description = "Backups S3 bucket name"
  value       = aws_s3_bucket.backups.id
}

output "bucket_arns" {
  description = "All bucket ARNs for IAM policies"
  value = {
    static  = aws_s3_bucket.static.arn
    reports = aws_s3_bucket.reports.arn
    models  = aws_s3_bucket.models.arn
    backups = aws_s3_bucket.backups.arn
  }
}

output "logs_bucket_name" {
  description = "S3 access logs bucket"
  value       = aws_s3_bucket.logs.id
}
