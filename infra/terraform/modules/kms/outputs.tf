output "s3_key_id" {
  description = "KMS key ID for S3 encryption"
  value       = aws_kms_key.main.id
}

output "s3_key_arn" {
  description = "KMS key ARN for S3 encryption"
  value       = aws_kms_key.main.arn
}

output "rds_key_id" {
  description = "KMS key ID for RDS encryption"
  value       = aws_kms_key.rds.id
}

output "rds_key_arn" {
  description = "KMS key ARN for RDS encryption"
  value       = aws_kms_key.rds.arn
}
