output "api_instance_profile_name" {
  description = "API instance profile name"
  value       = aws_iam_instance_profile.api.name
}

output "api_role_arn" {
  description = "API IAM role ARN"
  value       = aws_iam_role.api.arn
}

output "ml_instance_profile_name" {
  description = "ML instance profile name"
  value       = aws_iam_instance_profile.ml.name
}

output "ml_role_arn" {
  description = "ML IAM role ARN"
  value       = aws_iam_role.ml.arn
}
