#!/usr/bin/env bash
# ============================================================================
# SSL Certificate Setup for Creatools
# Obtains Let's Encrypt SSL certificates for all 3 domains using Certbot
# Uses --webroot mode to match the Nginx config (/.well-known/acme-challenge/)
# ============================================================================
set -euo pipefail

# Configuration
EMAIL="${CERTBOT_EMAIL:-}"
WEBROOT="/var/www/html"

echo "============================================"
echo "SSL Certificate Setup for Creatools"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Prompt for email if not set
if [ -z "$EMAIL" ]; then
    echo "Enter your email for Let's Encrypt notifications:"
    read -r EMAIL
    echo ""
fi

# Ensure Nginx config is in place
if [ ! -f /etc/nginx/sites-available/creatools.conf ]; then
    echo "ERROR: Nginx config not found at /etc/nginx/sites-available/creatools.conf"
    echo "Please copy the config first:"
    echo "  cp deploy/nginx/creatools.conf /etc/nginx/sites-available/creatools.conf"
    echo "  ln -sf /etc/nginx/sites-available/creatools.conf /etc/nginx/sites-enabled/"
    exit 1
fi

# Ensure webroot directory exists
mkdir -p "$WEBROOT/.well-known/acme-challenge"

# Temporarily switch to HTTP-only config for initial cert obtainment
echo "[1/4] Preparing Nginx for certificate obtainment..."
# Create a temporary HTTP-only config for certbot
cat > /etc/nginx/sites-available/creatools-temp.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name creatools.co www.creatools.co creatools.stream www.creatools.stream creatools.live www.creatools.live;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 200 'Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
EOF

# Use temporary config
ln -sf /etc/nginx/sites-available/creatools-temp.conf /etc/nginx/sites-enabled/creatools.conf
nginx -t && systemctl reload nginx

# Obtain certificate for creatools.co
echo "[2/4] Obtaining SSL certificate for creatools.co..."
certbot certonly --webroot \
    -w "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d creatools.co \
    -d www.creatools.co

# Obtain certificate for creatools.stream
echo "[3/4] Obtaining SSL certificate for creatools.stream..."
certbot certonly --webroot \
    -w "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d creatools.stream \
    -d www.creatools.stream

# Obtain certificate for creatools.live
echo "[4/4] Obtaining SSL certificate for creatools.live..."
certbot certonly --webroot \
    -w "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d creatools.live \
    -d www.creatools.live

# Restore full config with SSL
echo "Restoring full Nginx config with SSL..."
rm -f /etc/nginx/sites-available/creatools-temp.conf
ln -sf /etc/nginx/sites-available/creatools.conf /etc/nginx/sites-enabled/creatools.conf
nginx -t && systemctl reload nginx

# Set up auto-renewal
echo "Setting up auto-renewal..."
# Certbot installs a systemd timer by default, verify it's active
systemctl enable certbot.timer
systemctl start certbot.timer

# Also add a cron job as backup
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo ""
echo "============================================"
echo "SSL Setup Complete!"
echo "============================================"
echo ""
echo "Certificates obtained for:"
echo "  - creatools.co + www.creatools.co"
echo "  - creatools.stream + www.creatools.stream"
echo "  - creatools.live + www.creatools.live"
echo ""
echo "Auto-renewal is configured via:"
echo "  - systemd timer (certbot.timer)"
echo "  - cron job (daily at 3 AM as backup)"
echo ""
echo "Verify renewal works:"
echo "  certbot renew --dry-run"
