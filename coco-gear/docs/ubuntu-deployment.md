# Deploying COCO Gear to an Ubuntu Server

This guide covers two deployment methods: **Docker Compose** (recommended) and **manual setup**. Both assume a fresh Ubuntu 22.04 or 24.04 LTS server.

---

## Prerequisites

- Ubuntu 22.04+ LTS server with root or sudo access
- At least 1 GB RAM, 10 GB disk
- A domain name (optional, but recommended for HTTPS)
- SSH access to the server

---

## Method 1: Docker Compose (Recommended)

### 1. Install Docker and Docker Compose

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y ca-certificates curl gnupg

# Add Docker GPG key and repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the repository

```bash
cd /opt
sudo git clone <your-repo-url> slate
sudo chown -R $USER:$USER /opt/slate
cd /opt/slate/coco-gear
```

### 3. Configure environment variables

Edit `docker-compose.yml` and replace the default secrets:

```bash
cp .env.example .env
```

At minimum, change these values in `docker-compose.yml` (under the `app.environment` and `db.environment` sections):

| Variable | Default | Action |
|---|---|---|
| `POSTGRES_PASSWORD` | `coco_secret` | Change to a strong random password |
| `DATABASE_URL` | contains `coco_secret` | Update password to match |
| `JWT_SECRET` | `change-this-to-a-strong-random-secret` | Set to a random 64+ character string |

Generate a strong secret:

```bash
openssl rand -base64 48
```

### 4. Build and start

```bash
docker compose up -d --build
```

This will:
1. Build the multi-stage Docker image (compile React frontend, install production Node.js dependencies)
2. Start PostgreSQL 16 and wait for it to be healthy
3. Run Prisma schema migration (`prisma db push`)
4. Seed the database with demo data
5. Start the Express server on port 3000

### 5. Verify

```bash
# Check containers are running
docker compose ps

# Check application health
curl http://localhost:3000/api/health

# View logs
docker compose logs -f app
```

### 6. Manage the deployment

```bash
# Stop
docker compose down

# Stop and remove data (database + uploads)
docker compose down -v

# Restart
docker compose restart

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f
```

---

## Method 2: Manual Setup (No Docker)

### 1. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should show v20.x
npm -v    # should show 10.x

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
```

### 2. Configure PostgreSQL

```bash
# Switch to postgres user and create the database + role
sudo -u postgres psql <<EOF
CREATE USER coco WITH PASSWORD 'your-strong-password-here';
CREATE DATABASE cocogear OWNER coco;
GRANT ALL PRIVILEGES ON DATABASE cocogear TO coco;
EOF
```

### 3. Clone and install

```bash
cd /opt
sudo git clone <your-repo-url> slate
sudo chown -R $USER:$USER /opt/slate
cd /opt/slate/coco-gear
npm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

```env
DATABASE_URL="postgresql://coco:your-strong-password-here@localhost:5432/cocogear?schema=public"
JWT_SECRET="<output of: openssl rand -base64 48>"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV=production
UPLOAD_DIR=/opt/slate/coco-gear/uploads
MAX_FILE_SIZE=10485760
```

### 5. Initialize the database and build

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# Seed demo data
node prisma/seed.js

# Build the React frontend
npm run build
```

### 6. Create a systemd service

Create `/etc/systemd/system/cocogear.service`:

```bash
sudo tee /etc/systemd/system/cocogear.service > /dev/null <<'EOF'
[Unit]
Description=COCO Gear Equipment Management
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/slate/coco-gear
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/slate/coco-gear/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/slate/coco-gear/uploads

[Install]
WantedBy=multi-user.target
EOF
```

Set permissions and start:

```bash
# Create uploads directory and set ownership
mkdir -p /opt/slate/coco-gear/uploads
sudo chown -R www-data:www-data /opt/slate/coco-gear

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable cocogear
sudo systemctl start cocogear

# Check status
sudo systemctl status cocogear

# View logs
sudo journalctl -u cocogear -f
```

---

## Setting Up a Reverse Proxy with Nginx (Both Methods)

A reverse proxy provides HTTPS, gzip compression, and serves as the public entry point.

### 1. Install Nginx

```bash
sudo apt install -y nginx
```

### 2. Create site configuration

```bash
sudo tee /etc/nginx/sites-available/cocogear > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 10M;

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
EOF
```

### 3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/cocogear /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Add HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically configure HTTPS and set up auto-renewal.

---

## Firewall Configuration

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

This opens ports 22 (SSH), 80 (HTTP), and 443 (HTTPS). Port 3000 stays internal only.

---

## Post-Deployment Checklist

1. **Verify health** — `curl https://your-domain.com/api/health` returns `{"status":"ok"}`
2. **Test login** — Open the app in a browser; all seeded users use PIN `1234`
3. **Change default PINs** — Update user PINs via the personnel management UI
4. **Test file uploads** — Upload a photo through an inspection to confirm the uploads directory is writable
5. **Set up database backups**:
   ```bash
   # Docker method
   docker compose exec db pg_dump -U coco cocogear > backup_$(date +%F).sql

   # Manual method
   sudo -u postgres pg_dump cocogear > backup_$(date +%F).sql
   ```
6. **Set up a cron job for automated backups**:
   ```bash
   # Add to crontab: daily backup at 2 AM
   echo "0 2 * * * docker compose -f /opt/slate/coco-gear/docker-compose.yml exec -T db pg_dump -U coco cocogear > /opt/backups/cocogear_\$(date +\%F).sql" | sudo tee -a /var/spool/cron/crontabs/root
   ```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `docker compose up` fails | Check `docker compose logs db` — PostgreSQL may need more time. Retry. |
| Port 3000 already in use | `sudo lsof -i :3000` to find the process, then stop it or change `PORT` in config. |
| Database connection refused | Verify PostgreSQL is running: `sudo systemctl status postgresql` or `docker compose ps`. |
| Prisma migration fails | Check `DATABASE_URL` is correct. Run `npx prisma db push --force-reset` to start fresh (destroys data). |
| Permission denied on uploads | Fix ownership: `sudo chown -R www-data:www-data /opt/slate/coco-gear/uploads` |
| Nginx 502 Bad Gateway | The app isn't running. Check `sudo systemctl status cocogear` or `docker compose ps`. |
| HTTPS certificate issues | Re-run `sudo certbot --nginx -d your-domain.com` and check DNS points to server. |
