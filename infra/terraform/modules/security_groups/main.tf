/**
 * Security Groups Module
 * Principle of least privilege: each component has minimal required access
 * SRS §2.4.4: web 443 from ALB, db 5432 from web, ml 8000 from web
 */

# ─────────────────────────────────────────────────────────────────
# ALB Security Group (web: inbound 80/443)
# ─────────────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-"
  description = "Security group for ALB"
  vpc_id      = var.vpc_id

  # Allow HTTP (redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP"
  }

  # Allow HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS"
  }

  # Egress to API servers
  egress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "Allow traffic to API servers"
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# API Security Group (web servers in private subnet)
# ─────────────────────────────────────────────────────────────────

resource "aws_security_group" "api" {
  name_prefix = "${var.project_name}-api-"
  description = "Security group for API servers"
  vpc_id      = var.vpc_id

  # Inbound from ALB on port 3000 (Node.js API)
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow traffic from ALB"
  }

  # Egress to database
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
    description     = "Allow traffic to RDS"
  }

  # Egress to ML service
  egress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.ml.id]
    description     = "Allow traffic to ML service"
  }

  # Egress to internet (for external APIs, SMS, etc.)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS outbound"
  }

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP outbound"
  }

  tags = {
    Name = "${var.project_name}-api-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# Database Security Group (RDS)
# ─────────────────────────────────────────────────────────────────

resource "aws_security_group" "db" {
  name_prefix = "${var.project_name}-db-"
  description = "Security group for RDS database"
  vpc_id      = var.vpc_id

  # Inbound from API servers on PostgreSQL port
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "PostgreSQL from API servers"
  }

  # Egress (minimal)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = []
    description = "Deny all outbound (DB should not initiate)"
  }

  tags = {
    Name = "${var.project_name}-db-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# ML Service Security Group
# ─────────────────────────────────────────────────────────────────

resource "aws_security_group" "ml" {
  name_prefix = "${var.project_name}-ml-"
  description = "Security group for ML service"
  vpc_id      = var.vpc_id

  # Inbound from API servers on port 8000
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "ML inference requests from API"
  }

  # Egress to database
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
    description     = "Database access"
  }

  # Egress to internet for model downloads
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for model downloads"
  }

  tags = {
    Name = "${var.project_name}-ml-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────
# Output the security group IDs
# ─────────────────────────────────────────────────────────────────
