#!/bin/bash
# ============================================================================
# COCO Gear — One-Shot Ubuntu Server Setup Script
# ============================================================================
# Run this on a brand-new Ubuntu server (22.04 or 24.04) to install everything
# needed and start the app.
#
# Usage:
#   1. Get the code onto your server (git clone or scp)
#   2. cd /path/to/coco-gear
#   3. chmod +x setup-server.sh
#   4. sudo ./setup-server.sh
#
# What this script does:
#   - Updates the system
#   - Installs Docker Engine + Docker Compose
#   - Adds 2GB swap space (important for small servers)
#   - Generates secure passwords
#   - Configures the app
#   - Builds and starts the app with Docker
#   - Installs and configures Nginx reverse proxy
#   - Sets up UFW firewall
#   - Sets up automatic daily database backups
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/opt/backups"

# ─── Helper functions ───────────────────────────────────────────────────────

print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_warn() {
    echo -e "${YELLOW}  [!] $1${NC}"
}

print_info() {
    echo -e "  $1"
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: This script must be run as root (use sudo).${NC}"
        echo "  Usage: sudo ./setup-server.sh"
        exit 1
    fi
}

# ─── Pre-flight checks ─────────────────────────────────────────────────────

check_root

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found in $APP_DIR${NC}"
    echo "Make sure you run this script from the coco-gear directory."
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         COCO Gear — Server Setup Script             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  This will set up everything needed to run COCO Gear"
echo "  on this server. The script will:"
echo ""
echo "    1. Update the system"
echo "    2. Install Docker"
echo "    3. Add swap space (if needed)"
echo "    4. Generate secure passwords"
echo "    5. Build and start the app"
echo "    6. Set up Nginx (web server)"
echo "    7. Configure the firewall"
echo "    8. Set up automatic backups"
echo ""
read -p "  Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# ─── Step 1: Update the system ─────────────────────────────────────────────

print_step "Step 1/8: Updating the system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git wget ca-certificates gnupg lsb-release build-essential openssl

# Set timezone
timedatectl set-timezone UTC
print_info "System updated and timezone set to UTC."

# ─── Step 2: Install Docker ────────────────────────────────────────────────

print_step "Step 2/8: Installing Docker"

if command -v docker &> /dev/null; then
    print_info "Docker is already installed: $(docker --version)"
else
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add the Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    print_info "Docker installed: $(docker --version)"
fi

# Verify docker compose works
if docker compose version &> /dev/null; then
    print_info "Docker Compose: $(docker compose version)"
else
    echo -e "${RED}Error: Docker Compose is not working. Please check the Docker installation.${NC}"
    exit 1
fi

# ─── Step 3: Add swap space ────────────────────────────────────────────────

print_step "Step 3/8: Checking swap space"

TOTAL_SWAP=$(free -m | awk '/Swap:/ {print $2}')
if [ "$TOTAL_SWAP" -lt 1024 ]; then
    if [ -f /swapfile ]; then
        print_info "Swap file exists but is small. Skipping (you can resize manually)."
    else
        print_info "Adding 2GB swap space (helps prevent out-of-memory crashes)..."
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        print_info "Swap space added: 2GB"
    fi
else
    print_info "Sufficient swap space already exists (${TOTAL_SWAP}MB)."
fi

# ─── Step 4: Generate secure passwords and configure ───────────────────────

print_step "Step 4/8: Generating secure passwords and configuring the app"

DB_PASSWORD=$(openssl rand -hex 20)
JWT_SECRET=$(openssl rand -hex 32)

print_info "Generated secure database password."
print_info "Generated secure JWT secret."

# Create .env file
cat > "$APP_DIR/.env" << EOF
POSTGRES_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://coco:${DB_PASSWORD}@db:5432/cocogear?schema=public
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
EOF
chmod 600 "$APP_DIR/.env"
print_info "Created .env file with secure credentials."

# Update docker-compose.yml with the generated passwords
sed -i "s|POSTGRES_PASSWORD: coco_secret|POSTGRES_PASSWORD: ${DB_PASSWORD}|g" "$APP_DIR/docker-compose.yml"
sed -i "s|postgresql://coco:coco_secret@db:5432/cocogear|postgresql://coco:${DB_PASSWORD}@db:5432/cocogear|g" "$APP_DIR/docker-compose.yml"
sed -i "s|JWT_SECRET: change-this-to-a-strong-random-secret|JWT_SECRET: ${JWT_SECRET}|g" "$APP_DIR/docker-compose.yml"

print_info "Updated docker-compose.yml with secure credentials."

# Save credentials to a file the admin can reference
CREDS_FILE="$APP_DIR/.credentials"
cat > "$CREDS_FILE" << EOF
# ============================================================================
# COCO Gear — Server Credentials
# Generated on: $(date)
# KEEP THIS FILE SAFE. Delete it after saving credentials elsewhere.
# ============================================================================

Database Password: ${DB_PASSWORD}
JWT Secret:        ${JWT_SECRET}

Database URL:      postgresql://coco:${DB_PASSWORD}@db:5432/cocogear?schema=public
EOF
chmod 600 "$CREDS_FILE"
print_info "Saved credentials to $CREDS_FILE (keep this safe!)"

# ─── Step 5: Build and start the app ───────────────────────────────────────

print_step "Step 5/8: Building and starting the app (this takes a few minutes)"

cd "$APP_DIR"
docker compose up -d --build

# Wait for the app to be healthy
print_info "Waiting for the app to start..."
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        print_info "App is running and healthy!"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo -n "."
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    print_warn "App did not respond within ${MAX_WAIT}s. Check logs with: docker compose logs"
    print_warn "Continuing with remaining setup steps..."
fi

# ─── Step 6: Install and configure Nginx ───────────────────────────────────

print_step "Step 6/8: Setting up Nginx reverse proxy"

apt-get install -y nginx

# Create Nginx config
cat > /etc/nginx/sites-available/cocogear << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Enable the config
ln -sf /etc/nginx/sites-available/cocogear /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
systemctl enable nginx

print_info "Nginx configured. App is now accessible on port 80."

# ─── Step 7: Configure firewall ────────────────────────────────────────────

print_step "Step 7/8: Configuring firewall"

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw deny 3000
ufw --force enable

print_info "Firewall enabled. Allowed: SSH, HTTP, HTTPS. Blocked: direct port 3000."

# ─── Step 8: Set up automatic backups ──────────────────────────────────────

print_step "Step 8/8: Setting up automatic daily backups"

mkdir -p "$BACKUP_DIR"

cat > "$BACKUP_DIR/backup-cocogear.sh" << SCRIPT
#!/bin/bash
BACKUP_FILE="$BACKUP_DIR/cocogear_\$(date +%Y%m%d_%H%M%S).dump"
docker compose -f $APP_DIR/docker-compose.yml exec -T db pg_dump -U coco --format=custom cocogear > "\$BACKUP_FILE"

if [ ! -s "\$BACKUP_FILE" ]; then
    echo "\$(date): BACKUP FAILED - file is empty" >> $BACKUP_DIR/backup.log
    rm -f "\$BACKUP_FILE"
    exit 1
fi

find $BACKUP_DIR -name "cocogear_*.dump" -mtime +30 -delete
echo "\$(date): Backup successful - \$BACKUP_FILE (\$(du -h "\$BACKUP_FILE" | cut -f1))" >> $BACKUP_DIR/backup.log
SCRIPT

chmod +x "$BACKUP_DIR/backup-cocogear.sh"

# Add cron job for daily backups at 2 AM (if not already added)
if ! crontab -l 2>/dev/null | grep -q "backup-cocogear"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_DIR/backup-cocogear.sh") | crontab -
    print_info "Daily backup scheduled at 2:00 AM."
else
    print_info "Backup cron job already exists."
fi

# ─── Done! ──────────────────────────────────────────────────────────────────

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Your app is running at:${NC}  http://${SERVER_IP}"
echo ""
echo "  Default login PIN for all sample users: 1234"
echo ""
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │  IMPORTANT: Your credentials are saved at:      │"
echo "  │  $CREDS_FILE"
echo "  │                                                 │"
echo "  │  Save them somewhere safe, then delete the      │"
echo "  │  file:  rm $CREDS_FILE"
echo "  └─────────────────────────────────────────────────┘"
echo ""
echo "  Useful commands:"
echo "    Check status:    cd $APP_DIR && docker compose ps"
echo "    View logs:       cd $APP_DIR && docker compose logs -f app"
echo "    Restart:         cd $APP_DIR && docker compose restart"
echo "    Manual backup:   $BACKUP_DIR/backup-cocogear.sh"
echo ""
echo "  Optional next steps:"
echo "    - Add a domain name (see docs/ubuntu-deployment.md, Part 9)"
echo "    - Set up HTTPS with Let's Encrypt (Part 10)"
echo "    - Change default user PINs in the app"
echo ""
