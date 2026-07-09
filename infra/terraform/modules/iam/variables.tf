variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "s3_bucket_arns" {
  type = object({
    static  = string
    reports = string
    models  = string
    backups = string
  })
}

variable "cloudwatch_log_group_arn" {
  type = string
}
