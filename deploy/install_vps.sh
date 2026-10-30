#!/usr/bin/env bash
# ==============================================================================
# ULTRA DOWNLOAD HUB - Automated Linux VPS Deployment Script
# Target OS: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS / Debian 12
# Requirements: VPS provider that explicitly permits BitTorrent / P2P traffic
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "    ULTRA DOWNLOAD HUB: LINUX VPS INSTALLATION SCRIPT     "
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this installation script as root (sudo)."
  exit 1
fi

echo "[1/6] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw fail2ban ca-certificates gnupg lsb-release

echo "[2/6] Configuring UFW Firewall for Web and P2P ports..."
# SSH
ufw allow 22/tcp comment 'SSH'
# Web & Reverse Proxy
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
# Dedicated BitTorrent P2P Traffic (Inbound/Outbound)
ufw allow 6881/tcp comment 'BitTorrent TCP'
ufw allow 6881/udp comment 'BitTorrent DHT/UDP'
# Enable firewall non-interactively
ufw --force enable

echo "[3/6] Installing Docker & Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

echo "[4/6] Creating Persistent Storage Directories..."
mkdir -p /opt/ultra-download-hub/storage/incomplete
mkdir -p /opt/ultra-download-hub/storage/completed
mkdir -p /opt/ultra-download-hub/storage/temp
mkdir -p /opt/ultra-download-hub/certs
chmod -R 775 /opt/ultra-download-hub/storage

echo "[5/6] Generating Secure Environment Credentials..."
APP_SECRET=$(openssl rand -hex 32)
POSTGRES_PASS=$(openssl rand -hex 16)

cat <<EOF > /opt/ultra-download-hub/.env
NODE_ENV=production
PORT=3000
APP_SECRET=${APP_SECRET}
POSTGRES_USER=ultrahub
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=ultrahub_db
EOF

echo "[6/6] Launching Containers via Docker Compose..."
cd /opt/ultra-download-hub
if [ -f docker-compose.yml ]; then
  docker compose pull || true
  docker compose up -d --build
fi

echo "=========================================================="
echo "    ULTRA DOWNLOAD HUB INSTALLED SUCCESSFULLY!            "
echo "    Access your platform at: http://<your-vps-ip>         "
echo "=========================================================="
