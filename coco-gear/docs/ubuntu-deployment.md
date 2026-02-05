# Deploying COCO Gear to an Ubuntu Server — Complete Guide

This is a step-by-step guide to deploying the COCO Gear equipment management system on an Ubuntu server. It covers two methods — **Docker Compose** (recommended) and **manual bare-metal** — followed by reverse proxy setup, HTTPS, firewall, backups, monitoring, updates, security hardening, and troubleshooting.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server Requirements](#2-server-requirements)
3. [Initial Server Setup](#3-initial-server-setup)
4. [Method A: Docker Compose Deployment](#4-method-a-docker-compose-deployment-recommended)
5. [Method B: Manual Bare-Metal Deployment](#5-method-b-manual-bare-metal-deployment)
6. [Reverse Proxy with Nginx](#6-reverse-proxy-with-nginx)
7. [HTTPS with Let's Encrypt](#7-https-with-lets-encrypt)
8. [Firewall Configuration](#8-firewall-configuration)
9. [Database Backups and Restore](#9-database-backups-and-restore)
10. [Updating the Application](#10-updating-the-application)
11. [Monitoring and Logging](#11-monitoring-and-logging)
12. [Security Hardening](#12-security-hardening)
13. [Environment Variables Reference](#13-environment-variables-reference)
14. [Application Architecture Reference](#14-application-architecture-reference)
15. [Default Seed Data](#15-default-seed-data)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Architecture Overview

COCO Gear is a full-stack web application with the following components:

```
┌──────────────┐      ┌───────────────────────────────────────┐      ┌──────────────┐
│              │      │        Express.js (port 3000)         │      │              │
│   Browser    │─────▶│  ┌──────────┐  ┌──────────────────┐  │─────▶│ PostgreSQL   │
│              │      │  │ Static   │  │ REST API         │  │      │ (port 5432)  │
│              │◀─────│  │ React    │  │ /api/*           │  │◀─────│              │
│              │      │  │ frontend │  │ JWT auth         │  │      │ Database:    │
│              │      │  │ /client/ │  │ Prisma ORM       │  │      │ cocogear     │
│              │      │  │ dist/    │  │ File uploads     │  │      │              │
│              │      │  └──────────┘  └──────────────────┘  │      └──────────────┘
└──────────────┘      └───────────────────────────────────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │  /uploads/   │
                               │  (photos)    │
                               └──────────────┘
```

In production, a single Express server on port 3000 serves both:
- The compiled React frontend (static files from `client/dist/`)
- The REST API under `/api/*`
- Uploaded photos under `/uploads/*`

The server uses Prisma ORM to connect to PostgreSQL. All non-`/api` and non-`/uploads` requests are served the React `index.html` for client-side routing.

---

## 2. Server Requirements

### Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPUs |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB+ (depends on photo uploads) |
| Network | Public IP | Public IP + domain name |

### Software Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| Ubuntu | 22.04 LTS or 24.04 LTS | Operating system |
| Node.js | 20.x LTS | Application runtime |
| PostgreSQL | 16.x | Database |
| Nginx | any | Reverse proxy (optional but recommended) |
| Docker + Compose | 24.x+ | Container runtime (Method A only) |
| Git | any | Cloning the repository |
| Certbot | any | HTTPS certificates (optional) |

### Network Ports

| Port | Service | Exposure |
|------|---------|----------|
| 22 | SSH | Public (your IP only, ideally) |
| 80 | HTTP (Nginx) | Public (redirects to 443) |
| 443 | HTTPS (Nginx) | Public |
| 3000 | Node.js app | Localhost only (proxied by Nginx) |
| 5432 | PostgreSQL | Localhost only |

---

## 3. Initial Server Setup

These steps apply to both deployment methods. Run them on a fresh Ubuntu server.

### 3.1 Connect to your server

```bash
ssh root@your-server-ip
```

### 3.2 Create a non-root deploy user

```bash
# Create user
adduser deploy
# Give sudo access
usermod -aG sudo deploy
# Switch to the new user
su - deploy
```

### 3.3 Update system packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.4 Install essential tools

```bash
sudo apt install -y curl git wget gnupg2 lsb-release ca-certificates \
  software-properties-common build-essential
```

### 3.5 Set the server timezone

```bash
sudo timedatectl set-timezone UTC
```

(Use your preferred timezone. UTC is recommended for consistency in audit logs.)

### 3.6 Set up SSH key authentication (if not already done)

On your **local machine**:

```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "deploy@cocogear"

# Copy it to the server
ssh-copy-id deploy@your-server-ip
```

On the **server**, disable password authentication:

```bash
sudo sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 3.7 Set up swap space (for 1 GB RAM servers)

If your server has only 1 GB RAM, add swap to prevent out-of-memory errors during the Docker build or `npm install`:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verify:
```bash
free -h
# Should show ~2 GB swap
```

---

## 4. Method A: Docker Compose Deployment (Recommended)

This method runs the Node.js app and PostgreSQL in Docker containers managed by Docker Compose.

### 4.1 Install Docker Engine

```bash
# Remove any old Docker packages
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the Docker apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let the deploy user run Docker without sudo
sudo usermod -aG docker deploy
```

**Important:** Log out and log back in (or run `newgrp docker`) for the group change to take effect.

Verify Docker is working:
```bash
docker run --rm hello-world
docker compose version
# Should print "Docker Compose version v2.x.x"
```

### 4.2 Clone the repository

```bash
sudo mkdir -p /opt/slate
sudo chown deploy:deploy /opt/slate
git clone <your-repo-url> /opt/slate
cd /opt/slate/coco-gear
```

### 4.3 Configure production secrets

The `docker-compose.yml` file contains default development credentials that **must** be changed before deploying.

#### 4.3.1 Generate secrets

```bash
# Generate a strong database password
DB_PASS=$(openssl rand -base64 24)
echo "Database password: $DB_PASS"

# Generate a JWT signing secret
JWT_SEC=$(openssl rand -base64 48)
echo "JWT secret: $JWT_SEC"
```

Save these values somewhere safe (e.g., a password manager).

#### 4.3.2 Create a production docker-compose override

Rather than editing `docker-compose.yml` directly (which would be overwritten on `git pull`), create a `docker-compose.override.yml`:

```bash
cat > /opt/slate/coco-gear/docker-compose.override.yml <<YAML
version: '3.8'

services:
  db:
    environment:
      POSTGRES_PASSWORD: "${DB_PASS}"
    ports: !override
      - "127.0.0.1:5432:5432"

  app:
    environment:
      DATABASE_URL: "postgresql://coco:${DB_PASS}@db:5432/cocogear?schema=public"
      JWT_SECRET: "${JWT_SEC}"
      NODE_ENV: production
    ports: !override
      - "127.0.0.1:3000:3000"
YAML
```

Alternatively, create a `.env` file that `docker-compose.yml` can reference:

```bash
cat > /opt/slate/coco-gear/.env <<EOF
POSTGRES_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://coco:${DB_PASS}@db:5432/cocogear?schema=public
JWT_SECRET=${JWT_SEC}
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
EOF

# Protect the file
chmod 600 /opt/slate/coco-gear/.env
```

#### 4.3.3 Bind ports to localhost only

By default, `docker-compose.yml` exposes port 3000 and 5432 on all interfaces (`0.0.0.0`). For production, bind them to `127.0.0.1` so only Nginx can reach the app, and nothing external can reach PostgreSQL directly.

If you used the override file above, this is already handled. Otherwise, edit `docker-compose.yml` and change:

```yaml
# BEFORE (insecure — exposed to the internet)
ports:
  - "3000:3000"

# AFTER (only accessible from localhost)
ports:
  - "127.0.0.1:3000:3000"
```

Do the same for the `db` service's port `5432`.

### 4.4 Understand what the Docker build does

The `Dockerfile` uses a two-stage build:

**Stage 1 — Builder (temporary):**
1. Starts from `node:20-alpine`
2. Copies `package.json` and `package-lock.json`, runs `npm install` (all dependencies including dev)
3. Copies the Prisma schema and runs `npx prisma generate` (creates the Prisma client)
4. Copies the `client/` directory and runs `npm run build` (Vite compiles the React app into `client/dist/`)

**Stage 2 — Production (final image):**
1. Starts from a fresh `node:20-alpine`
2. Copies `package.json` and runs `npm install --omit=dev` (production dependencies only — no Vite, no React, just Express/Prisma/bcrypt etc.)
3. Copies the Prisma schema and re-generates the Prisma client
4. Copies the `server/` directory (Express application code)
5. Copies the compiled `client/dist/` from Stage 1
6. Creates the `/app/uploads` directory
7. Sets `NODE_ENV=production`, exposes port 3000

The final image is lean — it only contains production Node.js dependencies, the compiled frontend, and the server code.

### 4.5 Build and start the containers

```bash
cd /opt/slate/coco-gear
docker compose up -d --build
```

This command:
1. Builds the multi-stage Docker image (takes 2–5 minutes on first run)
2. Pulls `postgres:16-alpine` if not cached
3. Creates named Docker volumes `pgdata` (database) and `uploads` (photos)
4. Starts the PostgreSQL container and waits for its health check (`pg_isready`) to pass
5. Starts the app container, which runs the startup command:
   - `npx prisma db push --skip-generate` — creates all 20+ database tables if they don't exist
   - `node prisma/seed.js` — populates demo data (8 users, 12 kits, locations, departments, components, etc.)
   - `node server/index.js` — starts the Express server

**Note on the seed command:** The seed script runs a `deleteMany` on all tables before inserting, so running it again will reset data to defaults. In production, you may want to remove `node prisma/seed.js` from the startup command in `docker-compose.yml` after the first run to prevent data resets on container restart. Edit the `command` field:

```yaml
# After first successful start, change to:
command: >
  sh -c "npx prisma db push --skip-generate &&
         node server/index.js"
```

### 4.6 Verify the deployment

```bash
# 1. Check both containers are running
docker compose ps
# Expected: both "db" and "app" show "Up" status

# 2. Check the application health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Expected output:
# {
#     "status": "ok",
#     "timestamp": "2026-02-05T12:00:00.000Z"
# }

# 3. Check the app can list users (login endpoint is public)
curl -s http://localhost:3000/api/auth/users | python3 -m json.tool
# Expected: JSON array of 8 user objects

# 4. Test authentication by logging in
# First, get a user ID from the users list, then:
USER_ID="<paste-a-user-id-here>"
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"userId\": \"${USER_ID}\", \"pin\": \"1234\"}" | python3 -m json.tool
# Expected: JSON with "token" field

# 5. View application logs
docker compose logs -f app

# 6. View database logs
docker compose logs -f db
```

### 4.7 Docker Compose management commands

```bash
cd /opt/slate/coco-gear

# ── Lifecycle ──
docker compose up -d          # Start (detached)
docker compose down            # Stop and remove containers (data preserved in volumes)
docker compose restart         # Restart both containers
docker compose restart app     # Restart only the app container
docker compose stop            # Stop without removing
docker compose start           # Start stopped containers

# ── Logs ──
docker compose logs -f         # Follow all logs
docker compose logs -f app     # Follow app logs only
docker compose logs --tail=100 app  # Last 100 lines

# ── Rebuild after code changes ──
docker compose up -d --build   # Rebuild image and restart

# ── Shell access ──
docker compose exec app sh     # Shell into the app container
docker compose exec db psql -U coco cocogear  # PostgreSQL interactive shell

# ── Inspect volumes ──
docker volume ls               # List volumes
docker volume inspect coco-gear_pgdata   # Show volume details

# ── Nuclear option (destroys all data!) ──
docker compose down -v         # Stop and delete volumes (database + uploads)
```

---

## 5. Method B: Manual Bare-Metal Deployment

This method installs Node.js and PostgreSQL directly on Ubuntu, without Docker.

### 5.1 Install Node.js 20 LTS

```bash
# Install via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v    # Expected: v20.x.x
npm -v     # Expected: 10.x.x
```

### 5.2 Install PostgreSQL 16

```bash
# Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Verify it's running
sudo systemctl status postgresql
# Expected: "active (exited)" — this is normal, the actual process is managed by pg_ctlcluster
```

### 5.3 Configure PostgreSQL

#### 5.3.1 Create the database and user

```bash
# Generate a strong password
DB_PASS=$(openssl rand -base64 24)
echo "Save this database password: $DB_PASS"

# Create the role and database
sudo -u postgres psql <<EOF
-- Create application user
CREATE USER coco WITH PASSWORD '${DB_PASS}';

-- Create the database owned by this user
CREATE DATABASE cocogear OWNER coco;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cocogear TO coco;

-- Connect to the new database and grant schema permissions
\c cocogear
GRANT ALL ON SCHEMA public TO coco;
EOF
```

#### 5.3.2 Verify database connectivity

```bash
# Test the connection (will prompt for password)
psql -h localhost -U coco -d cocogear -c "SELECT 'Connection successful!' AS status;"
```

If this fails with "peer authentication failed", edit PostgreSQL's auth config:

```bash
# Find and edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Find the line:
```
local   all   all   peer
```

Change `peer` to `md5` (or `scram-sha-256`):
```
local   all   all   md5
```

Also ensure this line exists for TCP/IP connections from localhost:
```
host    all   all   127.0.0.1/32   md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

#### 5.3.3 Tune PostgreSQL for production (optional)

Edit `/etc/postgresql/16/main/postgresql.conf`:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Recommended settings for a 2 GB RAM server:

```ini
# Memory
shared_buffers = 512MB              # 25% of RAM
effective_cache_size = 1536MB       # 75% of RAM
work_mem = 4MB
maintenance_work_mem = 128MB

# Connections
max_connections = 100

# WAL / Checkpoints
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Logging
log_min_duration_statement = 1000   # Log slow queries (>1s)
log_line_prefix = '%t [%p] %u@%d '
```

Restart PostgreSQL after changes:
```bash
sudo systemctl restart postgresql
```

### 5.4 Clone and install the application

```bash
# Clone the repository
sudo mkdir -p /opt/slate
sudo chown deploy:deploy /opt/slate
git clone <your-repo-url> /opt/slate
cd /opt/slate/coco-gear

# Install all dependencies (including devDependencies for building)
npm install
```

`npm install` will install these key packages:
- **Production:** `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `multer`, `cors`, `dotenv`, `zod`
- **Development (needed for build):** `vite`, `react`, `react-dom`, `@vitejs/plugin-react`, `prisma`

**Note:** `bcrypt` is a native module — it compiles C++ code during install. The `build-essential` package installed earlier provides the compiler. If install fails on bcrypt, ensure `build-essential` is installed.

### 5.5 Configure environment variables

```bash
cp .env.example .env
nano .env
```

Set every variable to production values:

```env
# ── Database ──
# Must match the user/password/database created in step 5.3
DATABASE_URL="postgresql://coco:YOUR_DB_PASSWORD_HERE@localhost:5432/cocogear?schema=public"

# ── Authentication ──
# CRITICAL: Replace with a cryptographically random secret. Used to sign all JWT tokens.
# If this value changes, all existing user sessions are immediately invalidated.
JWT_SECRET="PASTE_OUTPUT_OF_openssl_rand_-base64_48_HERE"

# How long login sessions last. After this duration, users must log in again.
# Examples: "1h", "8h", "24h", "7d"
JWT_EXPIRES_IN="24h"

# ── Server ──
PORT=3000
NODE_ENV=production

# ── File Uploads ──
# Absolute path where uploaded photos are stored on disk.
# This directory must exist and be writable by the service user.
UPLOAD_DIR=/opt/slate/coco-gear/uploads

# Maximum upload size per file in bytes. Default is 10 MB (10485760 bytes).
# The app accepts up to 10 files per upload request.
# Allowed file types: JPEG, JPG, PNG, GIF, WebP only.
MAX_FILE_SIZE=10485760
```

Protect the file:
```bash
chmod 600 .env
```

### 5.6 Initialize the database

```bash
cd /opt/slate/coco-gear

# Step 1: Generate the Prisma client
# This reads prisma/schema.prisma and generates TypeScript/JS client code
# into node_modules/@prisma/client
npx prisma generate

# Step 2: Push the schema to the database
# This creates all 20+ tables, indexes, and constraints in PostgreSQL
# without creating migration files. Suitable for initial deployment.
npx prisma db push
```

Expected output from `db push`:
```
🚀  Your database is now in sync with your Prisma schema.
```

If you want to verify the tables were created:
```bash
sudo -u postgres psql -d cocogear -c "\dt"
```

You should see tables like: `User`, `Department`, `Location`, `Component`, `KitType`, `Kit`, `Inspection`, `IssueHistory`, `CheckoutRequest`, `Reservation`, `MaintenanceHistory`, `Consumable`, `StandaloneAsset`, `AuditLog`, `SystemSetting`, and the various junction/detail tables.

### 5.7 Seed demo data (optional)

The seed script populates the database with sample data for testing:

```bash
node prisma/seed.js
```

This creates:
- 8 locations (DAWG, GTX, Demo, ATX, ATS, MOPS, Alpha, Maintenance Bay)
- 3 departments (Comms, Optics, Logistics)
- 8 users (1 super admin, 1 admin, 6 regular users) — all with PIN `1234`
- 19 component definitions (radios, antennas, batteries, cables, cases)
- 3 kit types (COCO Kit, Starlink Kit, NVG Set)
- 12 kit instances with component statuses, serials, and calibration tracking
- 6 consumable items with stock levels
- 10 standalone assets
- 3 reservations, 10 audit log entries
- System settings with default values

**For a clean production start (no demo data):** Skip this step. The application will work with an empty database — you'll create locations, departments, users, and kit types through the admin UI.

### 5.8 Build the React frontend

```bash
npm run build
```

This runs `vite build --config client/vite.config.js`, which:
1. Compiles all React JSX/JS files
2. Bundles and tree-shakes the code
3. Minifies the output
4. Outputs static files to `client/dist/` (HTML, JS, CSS, assets)

Verify the build:
```bash
ls -la client/dist/
# Expected: index.html plus assets/ directory with .js and .css files
```

### 5.9 Create the uploads directory

```bash
mkdir -p /opt/slate/coco-gear/uploads
```

### 5.10 Create a dedicated system user for the service

```bash
# Create a system user with no login shell and no home directory
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cocogear

# Give ownership of the application directory
sudo chown -R cocogear:cocogear /opt/slate/coco-gear

# Ensure the uploads directory is writable
sudo chmod 755 /opt/slate/coco-gear/uploads
```

### 5.11 Create a systemd service

```bash
sudo tee /etc/systemd/system/cocogear.service > /dev/null <<'EOF'
[Unit]
Description=COCO Gear Equipment Management System
Documentation=https://github.com/your-org/slate
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=cocogear
Group=cocogear
WorkingDirectory=/opt/slate/coco-gear
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
StartLimitInterval=60
StartLimitBurst=5

# Load environment from file
EnvironmentFile=/opt/slate/coco-gear/.env

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cocogear

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/slate/coco-gear/uploads
ReadOnlyPaths=/opt/slate/coco-gear

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF
```

**What each systemd directive does:**

| Directive | Purpose |
|-----------|---------|
| `After=postgresql.service` | Starts after PostgreSQL is up |
| `Requires=postgresql.service` | Fails if PostgreSQL isn't running |
| `Restart=on-failure` | Auto-restarts if the process crashes (exit code != 0) |
| `RestartSec=5` | Waits 5 seconds between restart attempts |
| `StartLimitInterval=60` / `StartLimitBurst=5` | Max 5 restarts per 60 seconds before giving up |
| `EnvironmentFile` | Loads all variables from `.env` into the process |
| `NoNewPrivileges=true` | Prevents the process from gaining additional privileges |
| `ProtectSystem=strict` | Makes the entire filesystem read-only except explicitly allowed paths |
| `ProtectHome=true` | Hides `/home`, `/root`, `/run/user` |
| `PrivateTmp=true` | Gives the service its own `/tmp` |
| `ReadWritePaths` | Allows writing to the uploads directory only |
| `ReadOnlyPaths` | Allows reading the app code |
| `LimitNOFILE=65536` | Allows up to 65536 open file descriptors |
| `MemoryMax=512M` | Kills the process if it uses more than 512 MB RAM |

### 5.12 Enable and start the service

```bash
# Reload systemd to pick up the new service file
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable cocogear

# Start the service now
sudo systemctl start cocogear

# Check the status
sudo systemctl status cocogear
```

Expected output:
```
● cocogear.service - COCO Gear Equipment Management System
     Loaded: loaded (/etc/systemd/system/cocogear.service; enabled; vendor preset: enabled)
     Active: active (running) since ...
     Main PID: 12345 (node)
```

### 5.13 Verify the service

```bash
# Check the health endpoint
curl -s http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Check the application is serving the frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200

# View real-time logs
sudo journalctl -u cocogear -f

# View recent logs
sudo journalctl -u cocogear --since "10 minutes ago"
```

---

## 6. Reverse Proxy with Nginx

Nginx sits in front of the Node.js app to provide HTTPS termination, gzip compression, static asset caching, and request buffering. This section applies to both deployment methods.

### 6.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 6.2 Create the site configuration

```bash
sudo tee /etc/nginx/sites-available/cocogear > /dev/null <<'NGINX'
# Rate limiting zone: 10 requests/second per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Upstream definition
upstream cocogear_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    # ── Logging ──
    access_log /var/log/nginx/cocogear_access.log;
    error_log  /var/log/nginx/cocogear_error.log;

    # ── File upload size ──
    # Must match or exceed MAX_FILE_SIZE in the app (10 MB default).
    # The app accepts up to 10 files per request, so set to 100M to be safe.
    client_max_body_size 100M;

    # ── Security headers ──
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Gzip compression ──
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;

    # ── API requests ──
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://cocogear_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ── Uploaded files ──
    location /uploads/ {
        proxy_pass http://cocogear_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;

        # Cache uploaded images in the browser for 7 days
        proxy_hide_header Cache-Control;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # ── Frontend (everything else) ──
    location / {
        proxy_pass http://cocogear_backend;
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
```

**Replace `your-domain.com`** with your actual domain name. If you don't have a domain, use the server's IP address.

### 6.3 Enable the site

```bash
# Create symlink to enable the site
sudo ln -sf /etc/nginx/sites-available/cocogear /etc/nginx/sites-enabled/

# Remove the default Nginx placeholder site
sudo rm -f /etc/nginx/sites-enabled/default

# Test the configuration for syntax errors
sudo nginx -t
# Expected: "syntax is ok" and "test is successful"

# Reload Nginx to apply
sudo systemctl reload nginx
```

### 6.4 Test through Nginx

```bash
# If using a domain:
curl -s http://your-domain.com/api/health

# If using an IP address:
curl -s http://your-server-ip/api/health
```

---

## 7. HTTPS with Let's Encrypt

**Prerequisite:** Your domain's DNS A record must point to this server's public IP address.

### 7.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obtain and install the certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot will:
1. Prove you control the domain via an HTTP challenge
2. Obtain a certificate from Let's Encrypt
3. Automatically modify your Nginx config to add SSL directives
4. Set up a redirect from HTTP (port 80) to HTTPS (port 443)

### 7.3 Verify HTTPS

```bash
curl -s https://your-domain.com/api/health
```

### 7.4 Verify auto-renewal

Let's Encrypt certificates expire every 90 days. Certbot installs a systemd timer for auto-renewal.

```bash
# Check the renewal timer is active
sudo systemctl status certbot.timer

# Test renewal (dry run — doesn't actually renew)
sudo certbot renew --dry-run
```

### 7.5 (Optional) Harden the SSL configuration

After Certbot configures SSL, you can further harden it by editing the Nginx config to add HSTS:

```bash
sudo nano /etc/nginx/sites-available/cocogear
```

Add inside the `server` block listening on 443:
```nginx
# HTTP Strict Transport Security — tells browsers to always use HTTPS
# max-age=63072000 = 2 years
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Firewall Configuration

### 8.1 Enable UFW

```bash
# Allow SSH (important — do this first or you'll lock yourself out!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS (Nginx)
sudo ufw allow 'Nginx Full'

# Enable the firewall
sudo ufw enable

# Verify the rules
sudo ufw status verbose
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
OpenSSH (v6)               ALLOW       Anywhere (v6)
Nginx Full (v6)            ALLOW       Anywhere (v6)
```

**What is NOT exposed:**
- Port 3000 (Node.js) — only accessible from localhost via Nginx proxy
- Port 5432 (PostgreSQL) — only accessible from localhost (or within Docker network)

### 8.2 (Optional) Restrict SSH to your IP

```bash
# Replace with your public IP
sudo ufw delete allow OpenSSH
sudo ufw allow from YOUR_PUBLIC_IP to any port 22 proto tcp
```

---

## 9. Database Backups and Restore

### 9.1 Manual backup

#### Docker method:
```bash
docker compose -f /opt/slate/coco-gear/docker-compose.yml \
  exec -T db pg_dump -U coco --format=custom cocogear \
  > /opt/backups/cocogear_$(date +%Y%m%d_%H%M%S).dump
```

#### Bare-metal method:
```bash
sudo -u postgres pg_dump --format=custom cocogear \
  > /opt/backups/cocogear_$(date +%Y%m%d_%H%M%S).dump
```

The `--format=custom` flag creates a compressed binary dump that supports selective restore.

### 9.2 Set up automated daily backups

```bash
# Create the backup directory
sudo mkdir -p /opt/backups
sudo chown deploy:deploy /opt/backups

# Create the backup script
sudo tee /opt/backups/backup-cocogear.sh > /dev/null <<'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cocogear_${TIMESTAMP}.dump"

# ── Create the backup ──
# Uncomment the method you're using:

# Docker method:
docker compose -f /opt/slate/coco-gear/docker-compose.yml \
  exec -T db pg_dump -U coco --format=custom cocogear > "$BACKUP_FILE"

# Bare-metal method:
# sudo -u postgres pg_dump --format=custom cocogear > "$BACKUP_FILE"

# ── Verify the backup is not empty ──
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty!" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ── Delete backups older than retention period ──
find "$BACKUP_DIR" -name "cocogear_*.dump" -mtime +${RETENTION_DAYS} -delete

echo "Backup successful: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
SCRIPT

chmod +x /opt/backups/backup-cocogear.sh
```

Add to cron — runs daily at 2:00 AM:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backups/backup-cocogear.sh >> /opt/backups/backup.log 2>&1") | crontab -
```

Verify the cron entry:
```bash
crontab -l
```

### 9.3 Restore from backup

#### Docker method:
```bash
# Stop the app first
docker compose -f /opt/slate/coco-gear/docker-compose.yml stop app

# Restore (replace the filename with your backup)
docker compose -f /opt/slate/coco-gear/docker-compose.yml \
  exec -T db pg_restore -U coco -d cocogear --clean --if-exists \
  < /opt/backups/cocogear_20260205_020000.dump

# Restart the app
docker compose -f /opt/slate/coco-gear/docker-compose.yml start app
```

#### Bare-metal method:
```bash
# Stop the app
sudo systemctl stop cocogear

# Restore
sudo -u postgres pg_restore -d cocogear --clean --if-exists \
  /opt/backups/cocogear_20260205_020000.dump

# Restart the app
sudo systemctl start cocogear
```

### 9.4 Back up uploaded photos

The database backup does not include uploaded photos. Back up the uploads directory separately:

```bash
# Docker: find where the volume is mounted
docker volume inspect coco-gear_uploads
# Look for the "Mountpoint" — e.g., /var/lib/docker/volumes/coco-gear_uploads/_data

# Tar the uploads
sudo tar czf /opt/backups/uploads_$(date +%Y%m%d).tar.gz \
  -C /var/lib/docker/volumes/coco-gear_uploads/_data .

# Bare-metal:
tar czf /opt/backups/uploads_$(date +%Y%m%d).tar.gz \
  -C /opt/slate/coco-gear/uploads .
```

---

## 10. Updating the Application

### 10.1 Docker method

```bash
cd /opt/slate/coco-gear

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime is not built in — expect ~30s of downtime)
docker compose up -d --build

# The startup command will auto-run prisma db push to apply any schema changes.
# Watch the logs:
docker compose logs -f app
```

### 10.2 Bare-metal method

```bash
cd /opt/slate/coco-gear

# Pull latest code
git pull origin main

# Install any new dependencies
npm install

# Regenerate the Prisma client (in case schema changed)
npx prisma generate

# Apply any schema changes
npx prisma db push

# Rebuild the frontend
npm run build

# Fix ownership after build
sudo chown -R cocogear:cocogear /opt/slate/coco-gear

# Restart the service
sudo systemctl restart cocogear

# Check logs
sudo journalctl -u cocogear -f --since "1 minute ago"
```

### 10.3 Rolling back

If an update breaks the application:

```bash
# Check git log for the previous working commit
git log --oneline -10

# Roll back to a specific commit
git checkout <commit-hash> .

# Then rebuild and restart using the steps above
```

---

## 11. Monitoring and Logging

### 11.1 Application health check

The app exposes `GET /api/health` which queries the database (`SELECT 1`) and returns:
- `200 {"status": "ok", "timestamp": "..."}` — everything is working
- `503 {"status": "error", "message": "Database unavailable"}` — database connection lost

Use this for uptime monitoring (e.g., UptimeRobot, Pingdom, or a simple cron curl):

```bash
# Simple monitoring script
sudo tee /opt/slate/health-check.sh > /dev/null <<'SCRIPT'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$RESPONSE" != "200" ]; then
  echo "$(date): COCO Gear health check failed with HTTP $RESPONSE" >> /opt/slate/health.log
  # Optional: send notification here (email, Slack webhook, etc.)
fi
SCRIPT

chmod +x /opt/slate/health-check.sh

# Run every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/slate/health-check.sh") | crontab -
```

### 11.2 Log locations

| Method | Log type | Command |
|--------|----------|---------|
| Docker | App logs | `docker compose logs -f app` |
| Docker | DB logs | `docker compose logs -f db` |
| Bare-metal | App logs | `sudo journalctl -u cocogear -f` |
| Bare-metal | DB logs | `sudo journalctl -u postgresql -f` |
| Both | Nginx access | `sudo tail -f /var/log/nginx/cocogear_access.log` |
| Both | Nginx errors | `sudo tail -f /var/log/nginx/cocogear_error.log` |

### 11.3 Disk usage monitoring

Photos accumulate in the uploads directory. Monitor disk usage:

```bash
# Check overall disk usage
df -h

# Check uploads directory size
du -sh /opt/slate/coco-gear/uploads/        # Bare-metal
docker compose exec app du -sh /app/uploads  # Docker
```

---

## 12. Security Hardening

### 12.1 Pre-deployment security checklist

| Item | How to verify |
|------|---------------|
| `JWT_SECRET` changed from default | `grep JWT_SECRET .env` should not contain "change-this" |
| Database password changed from default | `grep POSTGRES_PASSWORD docker-compose.yml` should not contain "coco_secret" |
| `.env` file is not readable by others | `ls -la .env` should show `rw-------` (600) |
| Port 3000 not exposed to the internet | `sudo ufw status` should not show 3000; `curl http://your-server-ip:3000` should timeout |
| Port 5432 not exposed to the internet | `sudo ufw status` should not show 5432 |
| SSH password auth disabled | `grep PasswordAuthentication /etc/ssh/sshd_config` should show "no" |
| Default PINs changed | Log in as Super Admin and update all user PINs in Personnel management |
| HTTPS enabled | `curl -I https://your-domain.com` returns 200 |
| Seed script removed from startup | Docker: `command` in `docker-compose.yml` should not include `seed.js` after initial setup |

### 12.2 Application-level security features (already built-in)

The application already includes:
- **JWT authentication** — all API routes except `/api/auth/users`, `/api/auth/login`, and `/api/health` require a valid Bearer token
- **Role-based access control** — three role levels (super > admin > user) with configurable admin permissions stored in `SystemSetting`
- **bcrypt password hashing** — PINs are hashed with 10 salt rounds
- **File upload validation** — only `jpeg`, `jpg`, `png`, `gif`, `webp` file types are accepted; MIME type and extension are both checked
- **File size limits** — configurable via `MAX_FILE_SIZE` (default 10 MB), max 10 files per request
- **Parameterized queries** — Prisma ORM prevents SQL injection
- **Input validation** — Zod schemas validate request bodies
- **Audit logging** — all significant actions (checkout, return, inspect, maintenance) are logged with user ID and timestamp
- **JSON body limit** — Express limits JSON payloads to 10 MB (`express.json({ limit: '10mb' })`)

### 12.3 Automatic security updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Enable automatic security updates
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 13. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | (none) | PostgreSQL connection string. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public` |
| `JWT_SECRET` | Yes | `dev-secret-change-in-production` | Secret key for signing JWT tokens. Must be random and kept secret. If changed, all active sessions are invalidated. |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiration duration. Accepts `ms`-compatible strings: `1h`, `8h`, `24h`, `7d`. |
| `PORT` | No | `3000` | Port the Express server listens on. |
| `NODE_ENV` | No | `development` | Set to `production` to: disable CORS, serve static frontend, hide detailed errors. |
| `UPLOAD_DIR` | No | `./uploads` (relative to server/) | Absolute path for storing uploaded photos. Must be writable. |
| `MAX_FILE_SIZE` | No | `10485760` (10 MB) | Maximum file size in bytes per uploaded file. |

---

## 14. Application Architecture Reference

### Directory structure

```
coco-gear/
├── prisma/
│   ├── schema.prisma          # Database schema (20+ models)
│   └── seed.js                # Demo data seeder
├── server/
│   ├── index.js               # Express entry point — routes, middleware, static serving
│   ├── middleware/
│   │   ├── auth.js            # JWT generation, verification, optional auth
│   │   └── rbac.js            # Role checks: requireRole(), requireSuper(), requireAdminPerm()
│   ├── routes/
│   │   ├── auth.js            # Login, user listing, profile
│   │   ├── kits.js            # Kit CRUD, checkout, return, inspect
│   │   ├── types.js           # Kit type templates
│   │   ├── components.js      # Component definitions
│   │   ├── locations.js       # Location management
│   │   ├── departments.js     # Department management
│   │   ├── personnel.js       # User management (admin)
│   │   ├── consumables.js     # Consumable inventory
│   │   ├── assets.js          # Standalone asset tracking
│   │   ├── reservations.js    # Kit reservations
│   │   ├── maintenance.js     # Maintenance workflows
│   │   ├── audit.js           # Audit log viewer (super admin)
│   │   ├── settings.js        # System settings (super admin)
│   │   └── reports.js         # Fleet, checkout, inspection, personnel reports
│   └── utils/
│       ├── auditLogger.js     # Helper to create AuditLog entries
│       └── validation.js      # Zod schemas for request validation
├── client/
│   ├── index.html             # React SPA entry point
│   ├── vite.config.js         # Vite build config (proxy in dev, output to dist/)
│   └── src/
│       ├── index.jsx          # React DOM mount, AuthProvider wrapper
│       ├── App.jsx            # Main application (~222 KB — all UI views in one file)
│       ├── api.js             # API client with JWT token injection
│       └── auth.jsx           # AuthContext provider + useAuth hook
├── uploads/                   # Runtime: uploaded photos stored here
├── Dockerfile                 # Multi-stage build (builder → production)
├── docker-compose.yml         # PostgreSQL + app orchestration
├── package.json               # Dependencies and scripts
├── .env.example               # Environment variable template
└── .gitignore                 # Excludes node_modules, dist, uploads/*, .env
```

### API endpoints summary

All endpoints are prefixed with `/api`. All except auth and health require a `Bearer` token.

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/auth/users` | No | Any | List users for login screen |
| POST | `/auth/login` | No | Any | Authenticate with userId + PIN → JWT |
| GET | `/auth/me` | Yes | Any | Current user profile |
| PUT | `/auth/me` | Yes | Any | Update own profile |
| GET | `/kits` | Yes | Any | List all kits |
| POST | `/kits` | Yes | Admin+ | Create a kit |
| GET | `/kits/:id` | Yes | Any | Get kit details |
| PUT | `/kits/:id` | Yes | Admin+ | Update a kit |
| DELETE | `/kits/:id` | Yes | Admin+ | Delete a kit |
| POST | `/kits/:id/checkout` | Yes | Varies | Check out a kit |
| POST | `/kits/:id/return` | Yes | Varies | Return a kit |
| POST | `/kits/:id/inspect` | Yes | Varies | Record an inspection |
| GET | `/types` | Yes | Any | List kit types |
| POST | `/types` | Yes | Admin+ | Create kit type |
| GET | `/components` | Yes | Any | List components |
| POST | `/components` | Yes | Admin+ | Create component |
| GET | `/locations` | Yes | Any | List locations |
| GET | `/departments` | Yes | Any | List departments |
| GET | `/personnel` | Yes | Admin+ | List all users |
| POST | `/personnel` | Yes | Admin+ | Create user |
| GET | `/consumables` | Yes | Any | List consumables |
| GET | `/assets` | Yes | Any | List standalone assets |
| GET | `/reservations` | Yes | Any | List reservations |
| GET | `/maintenance` | Yes | Any | List maintenance records |
| GET | `/audit` | Yes | Super | View audit logs |
| GET | `/settings` | Yes | Admin+ | Read system settings |
| PUT | `/settings` | Yes | Super | Update system settings |
| GET | `/reports/*` | Yes | Admin+ | Various reports |
| POST | `/upload` | Yes | Any | Upload photos (max 10 files) |
| GET | `/health` | No | Any | Health check (DB connectivity) |

---

## 15. Default Seed Data

After running `node prisma/seed.js`, the following data exists:

### Users (all PINs: `1234`)

| Name | Role | Department | Title |
|------|------|------------|-------|
| Jordan Martinez | Super Admin | (none) | Operations Director |
| Taylor Nguyen | Admin | (none) | Team Lead |
| Riley Chen | User | Comms | Field Technician |
| Drew Williams | User | Comms | Project Manager |
| Kim Thompson | User | Optics | Engineer |
| Morgan Davis | User | Logistics | Analyst |
| Lee Garcia | User | Optics | Technician |
| Ash Patel | User | Logistics | Support Specialist |

### Locations

DAWG (VB), FTX - GTX, GTX - Demo, ATX BL7, ATS, MOPS Trailer, Field Site Alpha, Maintenance Bay

### Departments

Comms (blue), Optics (purple), Logistics (teal)

### Kits

12 COCO Kits in various colors (PINK, RED, ORANGE, YELLOW, PURPLE, GREEN, WHITE, BLUE, BROWN, CHECKER, RWB, GOLD) with different statuses — some checked out, some available, one in maintenance.

---

## 16. Troubleshooting

### Application won't start

**Symptom:** `systemctl status cocogear` shows "failed" or the container exits immediately.

**Diagnosis:**
```bash
# Bare-metal — check logs
sudo journalctl -u cocogear --since "5 minutes ago" --no-pager

# Docker — check logs
docker compose logs --tail=50 app
```

**Common causes:**

| Error message | Cause | Fix |
|---------------|-------|-----|
| `Can't reach database server` | PostgreSQL not running or wrong `DATABASE_URL` | Check `sudo systemctl status postgresql` or `docker compose ps db`. Verify `DATABASE_URL` credentials. |
| `P1001: Can't reach database` | Same as above | Same as above |
| `EADDRINUSE: address already in use :::3000` | Another process on port 3000 | Run `sudo lsof -i :3000` to find it. Stop it or change `PORT` in `.env`. |
| `Error: Cannot find module '@prisma/client'` | Prisma client not generated | Run `npx prisma generate` |
| `EACCES: permission denied` on uploads | Upload dir not writable | Run `sudo chown -R cocogear:cocogear /opt/slate/coco-gear/uploads` |
| `FATAL: password authentication failed for user "coco"` | Wrong DB password | Verify `DATABASE_URL` password matches what was set in PostgreSQL |

### Database connection issues

```bash
# Test PostgreSQL is listening
sudo ss -tlnp | grep 5432

# Test connection directly
psql -h localhost -U coco -d cocogear -c "SELECT 1;"

# Docker: check DB container health
docker compose ps db
docker compose logs db

# Check pg_hba.conf allows local connections (bare-metal)
sudo cat /etc/postgresql/16/main/pg_hba.conf | grep -v "^#" | grep -v "^$"
```

### Nginx returns 502 Bad Gateway

This means Nginx is running but cannot reach the Node.js app on port 3000.

```bash
# Is the app running?
sudo systemctl status cocogear     # Bare-metal
docker compose ps                   # Docker

# Is port 3000 open?
curl -s http://localhost:3000/api/health

# Check Nginx error log
sudo tail -20 /var/log/nginx/cocogear_error.log
```

### Prisma migration issues

```bash
# View current database state
npx prisma db pull    # Reads actual DB schema
npx prisma studio     # Opens a web UI to browse data (dev only)

# Force reset (WARNING: destroys all data)
npx prisma db push --force-reset

# If tables exist but are out of sync
npx prisma db push --accept-data-loss
```

### Uploaded photos not displaying

```bash
# Check the uploads directory exists and has files
ls -la /opt/slate/coco-gear/uploads/        # Bare-metal
docker compose exec app ls -la /app/uploads  # Docker

# Check permissions
stat /opt/slate/coco-gear/uploads/

# Test serving a file directly
curl -I http://localhost:3000/uploads/<filename>

# Check Nginx is proxying /uploads/
curl -I http://your-domain.com/uploads/<filename>
```

### Out of memory during Docker build

On servers with 1 GB RAM, the Vite build may run out of memory:

```bash
# Add swap (see section 3.7)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Then retry
docker compose up -d --build
```

### Resetting everything to start fresh

#### Docker:
```bash
cd /opt/slate/coco-gear
docker compose down -v           # Stops containers, deletes volumes (all data!)
docker compose up -d --build     # Rebuild and start fresh
```

#### Bare-metal:
```bash
sudo systemctl stop cocogear
sudo -u postgres psql -c "DROP DATABASE cocogear;"
sudo -u postgres psql -c "CREATE DATABASE cocogear OWNER coco;"
cd /opt/slate/coco-gear
npx prisma db push
node prisma/seed.js              # Optional: re-seed demo data
sudo systemctl start cocogear
```
