#!/usr/bin/env bash
# ============================================================================
# AWS Provisioning Script for Creatools
# Creates EC2 c6i.large + RDS PostgreSQL db.t3.small + Security Groups + Elastic IP
#
# Usage:
#   ./aws-provision.sh                         # Auto-detect SSH IP
#   ./aws-provision.sh --ssh-cidr 203.0.113.5/32  # Restrict SSH to specific CIDR
#   ./aws-provision.sh --ssh-cidr 0.0.0.0/0       # Open SSH to world (not recommended)
# ============================================================================
set -euo pipefail

# Parse arguments
SSH_CIDR=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --ssh-cidr)
            SSH_CIDR="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [--ssh-cidr CIDR]"
            exit 1
            ;;
    esac
done

# Configuration - Modify these as needed
AWS_REGION="${AWS_REGION:-us-east-1}"
KEY_NAME="${KEY_NAME:-creatools-key}"
VPC_ID="${VPC_ID:-}"  # Leave empty to use default VPC
DB_USERNAME="${DB_USERNAME:-creatools_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"  # Will prompt if empty
DB_NAME="${DB_NAME:-creatools}"
INSTANCE_TYPE="c6i.large"
DB_INSTANCE_CLASS="db.t3.small"
AMI_ID="${AMI_ID:-}"  # Will auto-detect Ubuntu 22.04 if empty

echo "============================================"
echo "Creatools AWS Infrastructure Provisioning"
echo "============================================"
echo ""

# Auto-detect SSH CIDR if not provided
if [ -z "$SSH_CIDR" ]; then
    echo "Detecting your public IP for SSH access..."
    MY_IP=$(curl -sf --connect-timeout 5 https://ifconfig.me || curl -sf --connect-timeout 5 https://api.ipify.org || echo "")
    if [ -n "$MY_IP" ]; then
        SSH_CIDR="${MY_IP}/32"
        echo "  SSH will be restricted to: $SSH_CIDR"
    else
        echo "WARNING: Could not auto-detect public IP."
        echo "Falling back to 0.0.0.0/0 (open to all). Consider restricting later."
        SSH_CIDR="0.0.0.0/0"
    fi
    echo ""
fi

# Prompt for DB password if not set
if [ -z "$DB_PASSWORD" ]; then
    echo "Enter a password for the RDS database (min 8 characters):"
    read -rs DB_PASSWORD
    echo ""
fi

# Get default VPC if not specified
if [ -z "$VPC_ID" ]; then
    echo "[1/10] Getting default VPC..."
    VPC_ID=$(aws ec2 describe-vpcs \
        --region "$AWS_REGION" \
        --filters "Name=isDefault,Values=true" \
        --query "Vpcs[0].VpcId" \
        --output text)
    echo "  Using default VPC: $VPC_ID"
fi

# Get first available subnet
echo "[2/10] Getting available subnet..."
SUBNET_ID=$(aws ec2 describe-subnets \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[0].SubnetId" \
    --output text)
echo "  Using subnet: $SUBNET_ID"

# Get all subnets for RDS subnet group (needs at least 2 AZs)
SUBNET_IDS=$(aws ec2 describe-subnets \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[*].SubnetId" \
    --output text | tr '\t' ',')
echo "  All subnets for RDS: $SUBNET_IDS"

# Auto-detect Ubuntu 22.04 AMI if not specified
if [ -z "$AMI_ID" ]; then
    echo "[3/10] Finding Ubuntu 22.04 LTS AMI..."
    AMI_ID=$(aws ec2 describe-images \
        --region "$AWS_REGION" \
        --owners 099720109477 \
        --filters \
            "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
            "Name=state,Values=available" \
        --query "sort_by(Images, &CreationDate)[-1].ImageId" \
        --output text)
    echo "  Using AMI: $AMI_ID"
fi

# Create key pair
echo "[4/10] Creating key pair: $KEY_NAME..."
if aws ec2 describe-key-pairs --region "$AWS_REGION" --key-names "$KEY_NAME" &>/dev/null; then
    echo "  Key pair already exists, skipping..."
else
    aws ec2 create-key-pair \
        --region "$AWS_REGION" \
        --key-name "$KEY_NAME" \
        --query "KeyMaterial" \
        --output text > "${KEY_NAME}.pem"
    chmod 400 "${KEY_NAME}.pem"
    echo "  Key pair saved to ${KEY_NAME}.pem"
fi

# Create EC2 Security Group
echo "[5/10] Creating EC2 security group..."
EC2_SG_ID=$(aws ec2 create-security-group \
    --region "$AWS_REGION" \
    --group-name "creatools-ec2-sg" \
    --description "Creatools EC2 Security Group - HTTP, HTTPS, SSH" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --region "$AWS_REGION" \
        --filters "Name=group-name,Values=creatools-ec2-sg" "Name=vpc-id,Values=$VPC_ID" \
        --query "SecurityGroups[0].GroupId" \
        --output text)
echo "  EC2 Security Group: $EC2_SG_ID"

# Add EC2 security group rules
echo "  Adding inbound rules..."
echo "  SSH (22) restricted to: $SSH_CIDR"
aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$EC2_SG_ID" \
    --protocol tcp --port 22 --cidr "$SSH_CIDR" 2>/dev/null || true
aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$EC2_SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$EC2_SG_ID" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true

# Create RDS Security Group
echo "[6/10] Creating RDS security group..."
RDS_SG_ID=$(aws ec2 create-security-group \
    --region "$AWS_REGION" \
    --group-name "creatools-rds-sg" \
    --description "Creatools RDS Security Group - PostgreSQL from EC2 only" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --region "$AWS_REGION" \
        --filters "Name=group-name,Values=creatools-rds-sg" "Name=vpc-id,Values=$VPC_ID" \
        --query "SecurityGroups[0].GroupId" \
        --output text)
echo "  RDS Security Group: $RDS_SG_ID"

# Allow PostgreSQL access from EC2 security group only
echo "  Adding inbound rule (PostgreSQL 5432 from EC2 SG only)..."
aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$RDS_SG_ID" \
    --protocol tcp --port 5432 \
    --source-group "$EC2_SG_ID" 2>/dev/null || true

# Create DB Subnet Group
echo "[7/10] Creating RDS subnet group..."
aws rds create-db-subnet-group \
    --region "$AWS_REGION" \
    --db-subnet-group-name "creatools-db-subnet" \
    --db-subnet-group-description "Creatools DB Subnet Group" \
    --subnet-ids $(echo "$SUBNET_IDS" | tr ',' ' ') 2>/dev/null || true

# Launch EC2 instance
echo "[8/10] Launching EC2 instance ($INSTANCE_TYPE)..."
INSTANCE_ID=$(aws ec2 run-instances \
    --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$EC2_SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=creatools-server}]" \
    --query "Instances[0].InstanceId" \
    --output text)
echo "  Instance ID: $INSTANCE_ID"
echo "  Waiting for instance to be running..."
aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"

# Allocate and associate Elastic IP
echo "[9/10] Allocating Elastic IP..."
ALLOCATION_ID=$(aws ec2 allocate-address \
    --region "$AWS_REGION" \
    --domain vpc \
    --query "AllocationId" \
    --output text)
ELASTIC_IP=$(aws ec2 describe-addresses \
    --region "$AWS_REGION" \
    --allocation-ids "$ALLOCATION_ID" \
    --query "Addresses[0].PublicIp" \
    --output text)
aws ec2 associate-address \
    --region "$AWS_REGION" \
    --instance-id "$INSTANCE_ID" \
    --allocation-id "$ALLOCATION_ID"
echo "  Elastic IP: $ELASTIC_IP"

# Create RDS instance
echo "[10/10] Creating RDS PostgreSQL instance ($DB_INSTANCE_CLASS)..."
echo "  This may take 5-10 minutes..."
aws rds create-db-instance \
    --region "$AWS_REGION" \
    --db-instance-identifier "creatools-db" \
    --db-instance-class "$DB_INSTANCE_CLASS" \
    --engine postgres \
    --engine-version "15" \
    --master-username "$DB_USERNAME" \
    --master-user-password "$DB_PASSWORD" \
    --db-name "$DB_NAME" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --vpc-security-group-ids "$RDS_SG_ID" \
    --db-subnet-group-name "creatools-db-subnet" \
    --backup-retention-period 7 \
    --no-publicly-accessible \
    --storage-encrypted \
    --tags "Key=Name,Value=creatools-db"

echo ""
echo "============================================"
echo "Provisioning Complete!"
echo "============================================"
echo ""
echo "EC2 Instance ID:  $INSTANCE_ID"
echo "Elastic IP:       $ELASTIC_IP"
echo "EC2 SG ID:        $EC2_SG_ID"
echo "RDS SG ID:        $RDS_SG_ID"
echo "SSH CIDR:         $SSH_CIDR"
echo "Key Pair:         ${KEY_NAME}.pem"
echo ""
echo "Wait for RDS to become available:"
echo "  aws rds wait db-instance-available --db-instance-identifier creatools-db --region $AWS_REGION"
echo ""
echo "Get RDS endpoint:"
echo "  aws rds describe-db-instances --db-instance-identifier creatools-db --region $AWS_REGION --query 'DBInstances[0].Endpoint.Address' --output text"
echo ""
echo "SSH into EC2:"
echo "  ssh -i ${KEY_NAME}.pem ubuntu@${ELASTIC_IP}"
echo ""
echo "DATABASE_URL will be:"
echo "  postgres://${DB_USERNAME}:${DB_PASSWORD}@<RDS_ENDPOINT>:5432/${DB_NAME}"
