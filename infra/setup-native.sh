#!/bin/bash
set -e

echo "=== Creatools: Migração para Node.js nativo + pm2 ==="

# 1. Instalar Node.js 22
echo "[1/7] Instalando Node.js 22..."
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# 2. Instalar pnpm
echo "[2/7] Instalando pnpm..."
sudo npm install -g pnpm@9

# 3. Instalar pm2
echo "[3/7] Instalando pm2..."
sudo npm install -g pm2

# 4. Instalar Nginx
echo "[4/7] Instalando Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx

# 5. Configurar Nginx
echo "[5/7] Configurando Nginx..."
sudo mkdir -p /var/www/creatools
sudo cp /opt/creatools/infra/nginx-native.conf /etc/nginx/conf.d/creatools.conf
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t && sudo systemctl restart nginx

# 6. Instalar dependências e buildar
echo "[6/7] Instalando dependências e buildando..."
cd /opt/creatools
pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false

# Build backend
cd artifacts/api-server && node build.mjs && cd ../..

# Build frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/creatools run build

# Copiar frontend para Nginx
sudo cp -r artifacts/creatools/dist/public/* /var/www/creatools/

# Criar diretório de uploads
mkdir -p /opt/creatools/uploads
mkdir -p /opt/creatools/artifacts/api-server/data

# 7. Iniciar com pm2
echo "[7/7] Iniciando API com pm2..."
cd /opt/creatools

# Carregar env vars do .env no pm2
set -a
source /opt/creatools/infra/.env
set +a
export NODE_TLS_REJECT_UNAUTHORIZED=0

pm2 start infra/ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | sudo bash

# Parar Docker (não precisa mais)
echo "=== Parando Docker containers antigos ==="
cd /opt/creatools/infra
sudo docker compose down 2>/dev/null || true

echo ""
echo "=== PRONTO! ==="
echo "  API: pm2 status"
echo "  Frontend: /var/www/creatools/"
echo "  Nginx: systemctl status nginx"
echo "  Logs: pm2 logs creatools-api"
echo ""
echo "  Para deploy rápido (2-3s):"
echo "    cd /opt/creatools && git pull && node artifacts/api-server/build.mjs && pm2 restart creatools-api"
echo ""
