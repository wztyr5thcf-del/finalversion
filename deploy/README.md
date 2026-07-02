# Creatools Deployment Guide

Complete deployment guide for the Creatools application on AWS (EC2 + RDS PostgreSQL).

## Architecture Overview

- **EC2 c6i.large** (2 vCPUs, 4GB RAM) - Application server
- **RDS PostgreSQL db.t3.small** - Managed database
- **Nginx** - Reverse proxy + static file serving + SSL termination
- **PM2** - Process manager in cluster mode (2 instances)
- **Let's Encrypt/Certbot** - Free SSL certificates

### Domains

All 3 domains point to the same application:
- `creatools.co` - Main site (frontend SPA + API)
- `creatools.stream` - Overlay links (same app, routes by hostname)
- `creatools.live` - User profile pages (same app, routes like /profile/public/:username)

### Request Flow

```
Client -> Nginx (HTTPS/443)
  /api/* -> reverse proxy -> PM2/Node.js (port 8080)
  /*     -> static files from /opt/creatools/frontend/ (SPA fallback to index.html)
```

---

## Prerequisites

- AWS CLI configured with appropriate permissions (`aws configure`)
- AWS account with permissions for EC2, RDS, VPC, and Elastic IP
- Domains registered and DNS access available
- Git repository accessible from the server

---

## Step 1: Provision AWS Infrastructure

Run the provisioning script from your local machine:

```bash
cd deploy

# Set optional environment variables (or the script will prompt/use defaults)
export AWS_REGION=us-east-1
export DB_PASSWORD="your-secure-database-password"

# Run the provisioning script
chmod +x aws-provision.sh
./aws-provision.sh
```

This creates:
- EC2 c6i.large instance with 30GB gp3 storage
- RDS PostgreSQL db.t3.small with 20GB encrypted storage
- Security groups for EC2 (SSH, HTTP, HTTPS) and RDS (PostgreSQL from EC2 only)
- Elastic IP for stable addressing
- SSH key pair (saved as `creatools-key.pem`)

Wait for RDS to become available:
```bash
aws rds wait db-instance-available --db-instance-identifier creatools-db --region us-east-1
```

Get the RDS endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier creatools-db \
  --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

---

## Step 2: Configure DNS

Point all 3 domains to your Elastic IP. See `dns-setup.md` for detailed instructions.

| Domain           | Type | Value          |
|------------------|------|----------------|
| creatools.co     | A    | ELASTIC_IP     |
| www.creatools.co | CNAME| creatools.co   |
| creatools.stream | A    | ELASTIC_IP     |
| www.creatools.stream | CNAME | creatools.stream |
| creatools.live   | A    | ELASTIC_IP     |
| www.creatools.live | CNAME | creatools.live |

Wait for DNS propagation (verify with `dig creatools.co +short`).

---

## Step 3: Set Up the Server

SSH into the EC2 instance and run the setup script:

```bash
ssh -i creatools-key.pem ubuntu@YOUR_ELASTIC_IP

# Upload and run the setup script
# Option A: Clone repo first, then run from it
git clone <your-repo-url> /opt/creatools/app
cd /opt/creatools/app/deploy
sudo chmod +x server-setup.sh
sudo ./server-setup.sh
```

This installs Node.js 20, pnpm, PM2, Nginx, Certbot, and configures the firewall.

---

## Step 4: Configure Nginx

```bash
# Copy Nginx config
sudo cp /opt/creatools/app/deploy/nginx/creatools.conf /etc/nginx/sites-available/creatools.conf
sudo ln -sf /etc/nginx/sites-available/creatools.conf /etc/nginx/sites-enabled/creatools.conf

# Test config (will show SSL errors until certs are obtained - that's OK)
sudo nginx -t
```

---

## Step 5: Obtain SSL Certificates

DNS must be propagated before this step.

```bash
cd /opt/creatools/app/deploy/nginx
sudo chmod +x ssl-setup.sh
sudo CERTBOT_EMAIL=your-email@example.com ./ssl-setup.sh
```

This obtains SSL certificates for all 3 domains and sets up auto-renewal.

Verify SSL is working:
```bash
# Check certificate renewal
sudo certbot renew --dry-run

# Reload Nginx with full config
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 6: Configure Environment Variables

```bash
cd /opt/creatools/app/deploy
cp .env.example .env
nano .env  # Edit with your actual values
```

Key values to set:
- `DATABASE_URL` - Use the RDS endpoint from Step 1
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` - From Stripe dashboard
- `TIKTOOLS_API_KEY` - Your TikTools API key
- Google Cloud Storage credentials

---

## Step 7: Deploy the Application

```bash
cd /opt/creatools/app/deploy
chmod +x deploy.sh
./deploy.sh
```

The deploy script will:
1. Pull latest code from git
2. Install dependencies with pnpm
3. Build the API server (esbuild)
4. Build the frontend (Vite)
5. Copy frontend files to Nginx serve directory
6. Push database schema
7. Start/restart PM2 processes

---

## Step 8: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs creatools-api

# Test API endpoint
curl -s https://creatools.co/api/health

# Test all domains
curl -sI https://creatools.co
curl -sI https://creatools.stream
curl -sI https://creatools.live
```

---

## Step 9: Set Up Backups

```bash
chmod +x /opt/creatools/app/deploy/backup.sh

# Test backup manually
/opt/creatools/app/deploy/backup.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/creatools/app/deploy/backup.sh >> /opt/creatools/logs/backup.log 2>&1
```

---

## Subsequent Deployments

After initial setup, deploy updates by running:

```bash
cd /opt/creatools/app/deploy
./deploy.sh
```

Or SSH in and run:
```bash
ssh -i creatools-key.pem ubuntu@YOUR_ELASTIC_IP
cd /opt/creatools/app/deploy && ./deploy.sh
```

---

## Troubleshooting

### PM2 Issues
```bash
pm2 status                    # Check process status
pm2 logs creatools-api        # View logs
pm2 restart creatools-api     # Restart processes
pm2 delete creatools-api      # Remove and re-add
pm2 start /opt/creatools/app/deploy/ecosystem.config.cjs
```

### Nginx Issues
```bash
sudo nginx -t                 # Test configuration
sudo systemctl status nginx   # Check status
sudo tail -f /var/log/nginx/error.log  # View error logs
```

### Database Connection
```bash
# Test connection from EC2
psql $DATABASE_URL -c "SELECT 1;"

# Check RDS status
aws rds describe-db-instances --db-instance-identifier creatools-db
```

### SSL Certificate Renewal
```bash
sudo certbot renew --dry-run  # Test renewal
sudo certbot certificates     # List certificates and expiry dates
```

---

## File Structure

```
deploy/
  README.md              - This file
  aws-provision.sh       - AWS infrastructure provisioning
  server-setup.sh        - EC2 server setup (Node.js, pnpm, PM2, Nginx, Certbot)
  deploy.sh              - Automated deployment script
  backup.sh              - Database backup script
  ecosystem.config.cjs   - PM2 process configuration
  .env.example           - Environment variables template
  dns-setup.md           - DNS configuration guide
  security-groups.md     - AWS security groups documentation
  nginx/
    creatools.conf       - Nginx server configuration for all 3 domains
    ssl-setup.sh         - SSL certificate obtainment script
```

---

## Monthly Cost Estimate

| Resource            | Estimated Cost |
|---------------------|---------------|
| EC2 c6i.large       | ~$62/month    |
| RDS db.t3.small     | ~$25/month    |
| Elastic IP          | $0 (attached) |
| EBS 30GB gp3        | ~$2.40/month  |
| RDS Storage 20GB    | ~$2.30/month  |
| Data Transfer       | ~$5-10/month  |
| **Total**           | **~$97-102/month** |
