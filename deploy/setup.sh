#!/usr/bin/env bash
# ==============================================================================
# PrayogCode Google Compute Engine (GCE) Automated Setup Script
# Target OS: Ubuntu 22.04 / 24.04 LTS or Debian 12
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}   PrayogCode C Compiler — Google Cloud Setup         ${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. Check Root / Sudo
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}[!] Warning: Running as root. Standard user recommended.${NC}"
    CURRENT_USER="root"
else
    CURRENT_USER="$USER"
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo -e "${GREEN}[*] Project directory: ${PROJECT_DIR}${NC}"
echo -e "${GREEN}[*] Target user: ${CURRENT_USER}${NC}"

# 2. System update & essential build tools
echo -e "\n${CYAN}>>> Step 1/6: Installing system dependencies & build tools...${NC}"
sudo apt update
sudo apt install -y curl git ufw build-essential python3 make g++ nginx certbot python3-certbot-nginx ca-certificates

# 3. Install Docker Engine
echo -e "\n${CYAN}>>> Step 2/6: Checking and installing Docker Engine...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}[*] Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
else
    echo -e "${GREEN}[*] Docker already installed.${NC}"
fi

# Ensure user is in docker group
sudo usermod -aG docker "$CURRENT_USER"
sudo systemctl enable --now docker

# 4. Install Node.js 20 LTS
echo -e "\n${CYAN}>>> Step 3/6: Checking and installing Node.js 20 LTS...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}[*] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}[*] Node.js version $(node -v) is already installed.${NC}"
fi

# 5. Build Docker execution sandbox
echo -e "\n${CYAN}>>> Step 4/6: Building PrayogCode C execution Docker image...${NC}"
cd "$PROJECT_DIR"
sudo docker build -t prayogcode-c-runner execution

# 6. Install dependencies and build project
echo -e "\n${CYAN}>>> Step 5/6: Building Backend and Frontend...${NC}"
# Backend
cd "$PROJECT_DIR/backend"
echo -e "${GREEN}[*] Installing backend dependencies...${NC}"
npm install

# Frontend
cd "$PROJECT_DIR/frontend"
echo -e "${GREEN}[*] Installing frontend dependencies & building production assets...${NC}"
npm install
npm run build

# 7. Configure systemd service
echo -e "\n${CYAN}>>> Step 6/6: Configuring systemd service and Nginx...${NC}"
SERVICE_FILE="/etc/systemd/system/prayogcode-backend.service"

sudo bash -c "cat <<EOF > $SERVICE_FILE
[Unit]
Description=PrayogCode Online C Compiler Backend (Docker Execution Engine)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$(which node) server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable --now prayogcode-backend

# 8. Configure Nginx
NGINX_CONF="/etc/nginx/sites-available/prayogcode"
sudo bash -c "cat <<EOF > $NGINX_CONF
server {
    listen 80;
    listen [::]:80;
    server_name prayogcode.is-a.dev _;

    root $PROJECT_DIR/frontend/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection \"Upgrade\";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host \\\$host;
    }
}
EOF"

# Enable site and disable default
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/prayogcode
sudo rm -f /etc/nginx/sites-enabled/default

# Verify Nginx configuration and reload
sudo nginx -t
sudo systemctl reload nginx

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   PrayogCode deployment completed successfully!      ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "Backend service status: $(systemctl is-active prayogcode-backend)"
echo -e "Nginx status: $(systemctl is-active nginx)"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Point your domain (e.g. prayogcode.is-a.dev) A-record to this VM's external IP."
echo -e "2. Once DNS has propagated, obtain a free SSL certificate by running:"
echo -e "   ${CYAN}sudo certbot --nginx -d prayogcode.is-a.dev${NC}"
echo -e "3. To view backend logs at any time:"
echo -e "   ${CYAN}journalctl -u prayogcode-backend -f${NC}"
