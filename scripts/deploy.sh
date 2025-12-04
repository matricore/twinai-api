#!/bin/bash

# TwinAI API Deployment Script
# Run this on your GCP VM

set -e

echo "🚀 Starting TwinAI API deployment..."

# Variables
APP_DIR="/var/www/twinai-api"
REPO_URL="https://github.com/YOUR_USERNAME/twinai-api.git"
BRANCH="main"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

# Update system
echo -e "${GREEN}📦 Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo -e "${GREEN}📦 Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
echo -e "${GREEN}📦 Installing PM2...${NC}"
sudo npm install -g pm2

# Install Nginx
echo -e "${GREEN}📦 Installing Nginx...${NC}"
sudo apt install -y nginx

# Install Certbot for SSL
echo -e "${GREEN}📦 Installing Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# Create app directory
echo -e "${GREEN}📁 Setting up app directory...${NC}"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone or pull repo
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${GREEN}📥 Pulling latest changes...${NC}"
    cd $APP_DIR
    git pull origin $BRANCH
else
    echo -e "${GREEN}📥 Cloning repository...${NC}"
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm ci --only=production

# Generate Prisma client
echo -e "${GREEN}🔧 Generating Prisma client...${NC}"
npx prisma generate

# Create logs directory
mkdir -p logs

# Setup environment file
if [ ! -f ".env" ]; then
    echo -e "${GREEN}⚠️  Please create .env file with your configuration${NC}"
    echo "Copy from .env.example and fill in your values"
fi

# Start/Restart with PM2
echo -e "${GREEN}🚀 Starting application with PM2...${NC}"
pm2 delete twinai-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create .env file: nano /var/www/twinai-api/.env"
echo "2. Setup Nginx: sudo cp nginx.conf.example /etc/nginx/sites-available/twinai-api"
echo "3. Enable site: sudo ln -s /etc/nginx/sites-available/twinai-api /etc/nginx/sites-enabled/"
echo "4. Get SSL: sudo certbot --nginx -d api.yourdomain.com"
echo "5. Restart Nginx: sudo systemctl restart nginx"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs twinai-api"

