# AWS Security Groups for Creatools

This document describes the security group rules created by `aws-provision.sh`.

## EC2 Security Group: `creatools-ec2-sg`

The EC2 instance security group allows inbound traffic for web serving and SSH access.

### Inbound Rules

| Type   | Protocol | Port Range | Source    | Description              |
|--------|----------|------------|-----------|--------------------------|
| SSH    | TCP      | 22         | 0.0.0.0/0 | SSH access (restrict to your IP in production) |
| HTTP   | TCP      | 80         | 0.0.0.0/0 | HTTP (redirects to HTTPS) |
| HTTPS  | TCP      | 443        | 0.0.0.0/0 | HTTPS traffic            |

### Outbound Rules

| Type       | Protocol | Port Range | Destination | Description        |
|------------|----------|------------|-------------|--------------------|
| All traffic | All      | All        | 0.0.0.0/0   | Allow all outbound |

### Recommendations

- **Restrict SSH**: After initial setup, restrict port 22 to your specific IP or a VPN CIDR:
  ```bash
  # Remove open SSH rule
  aws ec2 revoke-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp --port 22 --cidr 0.0.0.0/0

  # Add restricted rule (replace with your IP)
  aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp --port 22 --cidr YOUR_IP/32
  ```

---

## RDS Security Group: `creatools-rds-sg`

The RDS instance security group only allows PostgreSQL connections from the EC2 security group.

### Inbound Rules

| Type       | Protocol | Port Range | Source            | Description                    |
|------------|----------|------------|-------------------|--------------------------------|
| PostgreSQL | TCP      | 5432       | creatools-ec2-sg  | DB access from EC2 only        |

### Outbound Rules

| Type       | Protocol | Port Range | Destination | Description        |
|------------|----------|------------|-------------|--------------------|
| All traffic | All      | All        | 0.0.0.0/0   | Allow all outbound |

### Key Security Points

- The RDS instance is **not publicly accessible** (`--no-publicly-accessible`)
- Only traffic from the EC2 security group can reach the database
- Storage is encrypted at rest (`--storage-encrypted`)
- Automated backups are retained for 7 days (`--backup-retention-period 7`)

---

## Architecture Diagram

```
Internet
    |
    v
[EC2 Security Group: creatools-ec2-sg]
    - Port 22 (SSH)
    - Port 80 (HTTP -> redirect to HTTPS)
    - Port 443 (HTTPS)
    |
    v
EC2 Instance (c6i.large)
    - Nginx (ports 80/443)
    - PM2 + Node.js API (port 8080, localhost only)
    |
    v (internal, via SG reference)
[RDS Security Group: creatools-rds-sg]
    - Port 5432 (from EC2 SG only)
    |
    v
RDS PostgreSQL (db.t3.small)
    - Not publicly accessible
    - Encrypted storage
```

---

## Monitoring Recommendations

1. Enable VPC Flow Logs to monitor traffic patterns
2. Set up CloudWatch alarms for unusual connection patterns
3. Regularly review security group rules with:
   ```bash
   aws ec2 describe-security-groups --group-names creatools-ec2-sg creatools-rds-sg
   ```
