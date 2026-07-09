variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_id" {
  type = string
}

variable "cloudfront_oai_id" {
  description = "CloudFront Origin Access Identity ID"
  type        = string
}
