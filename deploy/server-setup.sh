#!/usr/bin/env bash
# ============================================================================
# Server Setup Script for Creatools
# Run on a fresh EC2 Ubuntu 22.04 instance
# Installs: Node.js 20 LTS, pnpm, PM2, Nginx, Certbot
# ============================================================================
set -euo pipefail

echo "============================================"
echo "Creatools Server Setup"
echo "============================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Update system
echo "[1/8] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install essential tools
echo "[2/8] Installing essential tools..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    htop

# Install Node.js 20 LTS
echo "[3/8] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "  Node.js version: $(node --version)"

# Install pnpm
echo "[4/8] Installing pnpm..."
npm install -g pnpm@latest
echo "  pnpm version: $(pnpm --version)"

# Install PM2
echo "[5/8] Installing PM2..."
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
echo "  PM2 version: $(pm2 --version)"

# Install Nginx
echo "[6/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
echo "  Nginx version: $(nginx -v 2>&1)"

# Install Certbot
echo "[7/8] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx
echo "  Certbot version: $(certbot --version 2>&1)"

# Configure firewall (ufw)
echo "[8/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "  Firewall status:"
ufw status

# Create app directory structure
echo ""
echo "Creating application directory structure..."
mkdir -p /opt/creatools/app
mkdir -p /opt/creatools/frontend
mkdir -p /opt/creatools/backups
mkdir -p /opt/creatools/logs

# Set ownership to ubuntu user
chown -R ubuntu:ubuntu /opt/creatools

# Configure Nginx for optimal performance
echo "Configuring Nginx worker processes..."
cat > /etc/nginx/nginx.conf << 'NGINX_MAIN'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    client_max_body_size 50M;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/rss+xml
        image/svg+xml;

    # Rate limiting zone
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # Virtual Host Configs
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINX_MAIN

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Set up PM2 startup for ubuntu user
echo ""
echo "Setting up PM2 startup..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
systemctl enable pm2-ubuntu

# Install PostgreSQL client (for backups)
echo "Installing PostgreSQL client..."
apt-get install -y postgresql-client

echo ""
echo "============================================"
echo "Server Setup Complete!"
echo "============================================"
echo ""
echo "Installed:"
echo "  - Node.js $(node --version)"
echo "  - pnpm $(pnpm --version)"
echo "  - PM2 $(pm2 --version)"
echo "  - Nginx $(nginx -v 2>&1 | awk '{print $3}')"
echo "  - Certbot $(certbot --version 2>&1 | awk '{print $2}')"
echo "  - PostgreSQL client"
echo ""
echo "Directory structure:"
echo "  /opt/creatools/app/       - Application code"
echo "  /opt/creatools/frontend/  - Frontend static files (served by Nginx)"
echo "  /opt/creatools/backups/   - Database backups"
echo "  /opt/creatools/logs/      - Application logs"
echo ""
echo "Next steps:"
echo "  1. Clone your repository to /opt/creatools/app/"
echo "  2. Copy nginx/creatools.conf to /etc/nginx/sites-available/"
echo "  3. Run nginx/ssl-setup.sh to obtain SSL certificates"
echo "  4. Set up .env file and run deploy.sh"
