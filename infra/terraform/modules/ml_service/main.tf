/**
 * ML Service Module - EC2 Instance for PyTorch Inference
 * Placeholder module - to be expanded with full EC2 configuration
 */

# This module will contain:
# - EC2 instance (t3.large)
# - Security group attachment
# - IAM instance profile
# - User data script (Docker, PyTorch setup)
# - Elastic IP (optional, for static IP)

# Placeholder resource
resource "null_resource" "ml_service" {
  provisioners = "To be implemented in next iteration"
}

# Placeholder outputs
output "instance_id" {
  value = "placeholder-instance-id"
}

output "ec2_private_ip" {
  value = "placeholder-private-ip"
}
