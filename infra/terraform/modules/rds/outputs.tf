output "cluster_id" {
  description = "RDS cluster identifier"
  value       = aws_rds_cluster.main.id
}

output "cluster_endpoint" {
  description = "RDS cluster writer endpoint"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = true
}

output "cluster_reader_endpoint" {
  description = "RDS cluster reader endpoint (for read replicas)"
  value       = aws_rds_cluster.main.reader_endpoint
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${aws_rds_cluster.main.master_username}:${var.master_password}@${aws_rds_cluster.main.endpoint}:5432/${var.database_name}"
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = aws_rds_cluster.main.database_name
}

output "master_username" {
  description = "Master username"
  value       = aws_rds_cluster.main.master_username
}

output "port" {
  description = "Database port"
  value       = aws_rds_cluster.main.port
}
