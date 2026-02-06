# How to Put COCO Gear on the Internet — A Complete Beginner's Guide

This guide will walk you through putting your COCO Gear application on a server so that anyone with the web address can use it from their browser — just like any other website. No prior experience is required. Every step is explained.

We will only use the **Docker** method, which is the simplest. It packages everything the app needs into a single container, so you don't have to install each piece of software individually.

---

## Table of Contents

- [Before You Start: What You Need to Know](#before-you-start-what-you-need-to-know)
- [Part 1: Renting a Server](#part-1-renting-a-server)
- [Part 2: Connecting to Your Server](#part-2-connecting-to-your-server)
- [Part 3: Preparing the Server](#part-3-preparing-the-server)
- [Part 4: Installing Docker](#part-4-installing-docker)
- [Part 5: Getting the App onto the Server](#part-5-getting-the-app-onto-the-server)
- [Part 6: Setting Your Passwords](#part-6-setting-your-passwords)
- [Part 7: Starting the App](#part-7-starting-the-app)
- [Part 8: Making It Accessible from the Internet](#part-8-making-it-accessible-from-the-internet)
- [Part 9: Adding a Domain Name (Optional)](#part-9-adding-a-domain-name-optional)
- [Part 10: Setting Up HTTPS — the Padlock Icon (Optional)](#part-10-setting-up-https--the-padlock-icon-optional)
- [Part 11: Locking Down the Server](#part-11-locking-down-the-server)
- [Part 12: Setting Up Automatic Backups](#part-12-setting-up-automatic-backups)
- [Part 13: Day-to-Day Management](#part-13-day-to-day-management)
- [Part 14: Updating the App When New Versions Come Out](#part-14-updating-the-app-when-new-versions-come-out)
- [Something Went Wrong — Troubleshooting](#something-went-wrong--troubleshooting)
- [Glossary: What Do All These Words Mean?](#glossary-what-do-all-these-words-mean)
- [Reference: Technical Details](#reference-technical-details)

---

## Before You Start: What You Need to Know

### What is a server?

A server is just a computer that's always turned on and connected to the internet. Instead of sitting under your desk, it lives in a data center somewhere. You rent one from a company (like renting storage space), and then you install your application on it.

### What is a "terminal" or "command line"?

Instead of clicking buttons and icons, you'll be typing text commands. It looks like a black window with white text. Don't worry — you'll be copying and pasting every command from this guide. You don't need to memorize anything.

### What is Docker?

Think of Docker like a shipping container for software. Instead of installing 5 different programs and hoping they all work together, Docker packages everything into one neat box. You tell Docker "run this box" and it just works.

### What will we be doing?

Here's the plan in plain English:

1. **Rent a server** — a computer on the internet (costs about $5-12/month)
2. **Connect to it** — type commands into it from your own computer
3. **Install Docker** — the tool that will run the app
4. **Put the app on the server** — download the code
5. **Set your passwords** — so no one else can get in
6. **Turn it on** — start the app
7. **Open it to the internet** — so people can visit it in their browser
8. **Lock it down** — basic security so you're protected
9. **Set up backups** — so you don't lose your data

### How long will this take?

About 1 to 2 hours if you're following along for the first time. Most of that is waiting for things to install.

### What do I need?

- A computer (Mac, Windows, or Linux — any will work)
- An internet connection
- A credit card (to rent the server — about $6/month)
- This guide open in your browser so you can copy/paste commands

---

## Part 1: Renting a Server

You need to rent a server from a hosting company. Here are the most beginner-friendly options:

### Option A: DigitalOcean (Recommended for Beginners)

1. Go to **digitalocean.com** and create an account
2. Once logged in, click the green **"Create"** button at the top, then **"Droplets"**
3. Choose these settings:
   - **Region:** Whichever city is closest to you
   - **Image:** Click **Ubuntu**, then pick **24.04 (LTS)**. LTS means "Long Term Support" — it will get security updates for years.
   - **Size:** Click **"Basic"**, then pick the **$6/month** option (1 GB RAM, 25 GB disk). This is plenty.
   - **Authentication:** Choose **"Password"** (it's simpler for a first-timer). Pick a strong password and **write it down somewhere safe**. You will need this password to connect.
4. Click **"Create Droplet"**
5. Wait about 60 seconds. You'll see your server appear with an **IP address** — a number like `164.90.150.23`. **Write this number down.** This is your server's address.

### Option B: Vultr or Linode

The process is very similar — create an account, pick Ubuntu 24.04, pick the cheapest plan ($5-6/month), and note down the IP address and password they give you.

### What did we just do?

You now have a computer running somewhere in a data center. It has Ubuntu Linux on it (an operating system, like Windows or macOS, but for servers). It's turned on, connected to the internet, and waiting for you to tell it what to do.

---

## Part 2: Connecting to Your Server

Now you need to "connect" to your server — this means opening a command line window on YOUR computer that controls the SERVER.

### If you're on a Mac

1. Open the **Terminal** app. You can find it by:
   - Pressing **Command + Space** to open Spotlight search
   - Typing **Terminal**
   - Pressing **Enter**
2. A window with a text prompt will appear. This is your terminal.

### If you're on Windows

1. Open **PowerShell**. You can find it by:
   - Clicking the Start menu
   - Typing **PowerShell**
   - Clicking on **"Windows PowerShell"**
2. A blue window with a text prompt will appear.

### Connect to the server

Now type this command, but **replace `YOUR_SERVER_IP`** with the IP address you wrote down in Part 1 (e.g., `164.90.150.23`):

```bash
ssh root@YOUR_SERVER_IP
```

**What does this command mean?**
- `ssh` = "Secure Shell" — a way to securely connect to another computer
- `root` = the administrator username (every Ubuntu server starts with this)
- `@YOUR_SERVER_IP` = the address of your server

**What happens next:**

The first time you connect, you'll see a message like:

```
The authenticity of host '164.90.150.23' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type **yes** and press **Enter**. This is normal — it's just confirming you want to connect to this server for the first time.

Then it will ask for your password. **Type the password you chose when you created the server** and press Enter.

**Important:** When you type your password, nothing will appear on screen — no dots, no stars, nothing. This is normal! It's a security feature. Just type it and press Enter.

**If it worked,** your prompt will change to something like:

```
root@ubuntu-server:~#
```

This means you are now controlling the server. Everything you type from now on is happening on that remote computer, not on yours.

### If it didn't work

- Double-check the IP address — did you type it exactly right?
- Double-check the password — remember, nothing appears while you type it
- If you forgot the password, go back to DigitalOcean (or your hosting provider), find your server, and use their "Reset Root Password" feature

---

## Part 3: Preparing the Server

Now we're going to update the server's software and install some basic tools. These commands might take a few minutes — that's normal.

### Step 3.1: Update everything

Copy and paste this entire command, then press Enter:

```bash
sudo apt update && sudo apt upgrade -y
```

**What does this do?** It's like clicking "Check for Updates" and "Install All Updates" on your phone. `sudo` means "do this as administrator." `-y` means "yes, go ahead, don't ask me to confirm each one."

**What you'll see:** Lots of text scrolling by. This is normal. Wait until it finishes and you see your prompt (`root@...:~#`) again.

If it asks you about "a newer version of a configuration file" — just press **Enter** to keep the default.

### Step 3.2: Install basic tools

```bash
sudo apt install -y curl git wget ca-certificates gnupg lsb-release build-essential
```

**What does this do?** Installs small helper programs that we'll need in later steps. Think of these like wrenches and screwdrivers — you need them to install the bigger stuff.

### Step 3.3: Set the clock

```bash
sudo timedatectl set-timezone UTC
```

**What does this do?** Sets the server's clock to UTC (Coordinated Universal Time). This makes timestamps in the app consistent regardless of where the server is located.

---

## Part 4: Installing Docker

Docker is the tool that will run our application. Let's install it.

### Step 4.1: Add Docker's download source

Copy and paste these commands **one at a time**. After pasting each one, press Enter and wait for it to finish before pasting the next:

**Command 1:**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

**Command 2:**
```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

**Command 3:**
```bash
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

**Command 4** (this is one long command — copy the whole thing):
```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**What did all that do?** We told the server where to download Docker from (Docker's official website). It's like adding a new app store so the server knows where to find Docker.

### Step 4.2: Install Docker

```bash
sudo apt update
```

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

This will take a minute or two. Wait for it to finish.

### Step 4.3: Check that Docker is working

```bash
docker --version
```

**What you should see:** Something like `Docker version 27.x.x` — the exact numbers don't matter as long as it shows a version and doesn't say "command not found."

```bash
docker compose version
```

**What you should see:** Something like `Docker Compose version v2.x.x`.

**If either command says "command not found":** Something went wrong with the installation. Go back to Step 4.1 and try again.

---

## Part 5: Getting the App onto the Server

Now we'll download the COCO Gear code onto the server.

### Step 5.1: Create a folder for the app

```bash
mkdir -p /opt/slate
```

**What does this do?** Creates a folder called `/opt/slate` on the server. `/opt` is a standard place to put applications on Linux.

### Step 5.2: Download the code

```bash
cd /opt/slate
git clone YOUR_REPO_URL_HERE .
```

**Replace `YOUR_REPO_URL_HERE`** with the actual URL of your code repository. It will look something like `https://github.com/yourname/slate.git`.

**What you should see:** Text about "Cloning into..." followed by progress indicators. When it's done, you'll get your prompt back.

### Step 5.3: Go to the app folder

```bash
cd /opt/slate/coco-gear
```

Let's verify the files are there:

```bash
ls
```

**What you should see:** A list of files and folders including `docker-compose.yml`, `Dockerfile`, `package.json`, `server`, `client`, `prisma`, and others. If you see these, the code downloaded successfully.

---

## Part 6: Setting Your Passwords

The app comes with fake default passwords for development. We **must** change them before putting this on the internet. This is the most important security step.

### Step 6.1: Generate a database password

Run this command to generate a strong random password:

```bash
openssl rand -base64 24
```

**What you'll see:** A random string of letters, numbers, and symbols — something like `k9X2mP8nQ4wR6tY1uI3oA5sD7fG0hJ`.

**Copy this password and save it somewhere safe** (like a note on your phone, a password manager, or write it on paper). Label it "Database Password."

### Step 6.2: Generate an app secret

Run this command to generate another random string:

```bash
openssl rand -base64 48
```

**Copy this one too and save it.** Label it "JWT Secret." This is used to secure user login sessions.

### Step 6.3: Create the configuration file

Now we'll create a file that stores these passwords. Run this command, but **replace the two placeholders** with the passwords you just generated:

```bash
cat > /opt/slate/coco-gear/.env << 'EOF'
POSTGRES_PASSWORD=PASTE_YOUR_DATABASE_PASSWORD_HERE
DATABASE_URL=postgresql://coco:PASTE_YOUR_DATABASE_PASSWORD_HERE@db:5432/cocogear?schema=public
JWT_SECRET=PASTE_YOUR_JWT_SECRET_HERE
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
EOF
```

**IMPORTANT:** You need to replace `PASTE_YOUR_DATABASE_PASSWORD_HERE` in **two places** (the first line AND inside the `DATABASE_URL` line), and `PASTE_YOUR_JWT_SECRET_HERE` in one place. The password in both places must be exactly the same.

**For example**, if your database password is `k9X2mP8nQ4` and your JWT secret is `aB3cD4eF5g`, the file should look like:

```
POSTGRES_PASSWORD=k9X2mP8nQ4
DATABASE_URL=postgresql://coco:k9X2mP8nQ4@db:5432/cocogear?schema=public
JWT_SECRET=aB3cD4eF5g
...
```

### Step 6.4: Protect the file

```bash
chmod 600 /opt/slate/coco-gear/.env
```

**What does this do?** Makes the file readable only by the administrator. No other user on the server can see your passwords.

### Step 6.5: Update docker-compose.yml with your database password

We also need to put the database password in the Docker configuration. Open the file for editing:

```bash
nano /opt/slate/coco-gear/docker-compose.yml
```

**What is `nano`?** It's a simple text editor that runs in the terminal. It will show you the contents of the file.

You'll see a file that looks like this:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: cocogear
      POSTGRES_USER: coco
      POSTGRES_PASSWORD: coco_secret     <-- CHANGE THIS
    ...
  app:
    ...
    environment:
      DATABASE_URL: postgresql://coco:coco_secret@db:5432/cocogear?schema=public    <-- CHANGE THIS
      JWT_SECRET: change-this-to-a-strong-random-secret     <-- CHANGE THIS
```

**Use the arrow keys** to move your cursor to `coco_secret` on the `POSTGRES_PASSWORD` line. Delete `coco_secret` and type your database password instead.

Do the same for the `coco_secret` inside the `DATABASE_URL` line.

And change `change-this-to-a-strong-random-secret` on the `JWT_SECRET` line to the JWT secret you generated.

**When you're done editing:**
1. Press **Ctrl + O** (the letter O, not zero) to save
2. Press **Enter** to confirm the filename
3. Press **Ctrl + X** to exit the editor

**How to check it worked:**

```bash
cat /opt/slate/coco-gear/docker-compose.yml
```

This prints the file contents. Look through it and make sure `coco_secret` no longer appears anywhere, and `change-this-to-a-strong-random-secret` is gone too.

---

## Part 7: Starting the App

This is the moment of truth!

### Step 7.1: Build and start everything

```bash
cd /opt/slate/coco-gear
docker compose up -d --build
```

**What does this command do?**
- `docker compose up` = "start everything defined in docker-compose.yml"
- `-d` = "in the background" (so it keeps running after you close the terminal)
- `--build` = "build the app from the source code first"

**What you'll see:** A LOT of text. Docker is:
1. Downloading a base system (Node.js and PostgreSQL)
2. Installing the app's dependencies
3. Building the website's user interface
4. Starting the database
5. Creating all the database tables
6. Loading sample data
7. Starting the web server

**This will take 3 to 10 minutes** the first time, depending on your server's speed. Be patient. When it's done, you'll get your prompt back.

### Step 7.2: Check that everything is running

```bash
docker compose ps
```

**What you should see:** Two entries — `db` and `app` (or similar names) — both showing a status of **"Up"** or **"running"**. If either says "Exit" or "Restarting", something went wrong — jump to the [Troubleshooting](#something-went-wrong--troubleshooting) section.

### Step 7.3: Test the app

```bash
curl http://localhost:3000/api/health
```

**What you should see:**

```json
{"status":"ok","timestamp":"2026-02-05T12:00:00.000Z"}
```

If you see `"status":"ok"` — congratulations! The app is running! The timestamp will be different (it shows the current date and time) — that's fine.

### Step 7.4: Test it in your browser

Open a web browser on YOUR computer (not the server) and go to:

```
http://YOUR_SERVER_IP:3000
```

Replace `YOUR_SERVER_IP` with the IP address from Part 1 (e.g., `http://164.90.150.23:3000`).

**What you should see:** The COCO Gear login page! You can log in with any of the sample users. They all use PIN **1234**.

**If the page doesn't load:** The server's firewall might be blocking port 3000. Run this command on the server:

```bash
sudo ufw allow 3000
```

Then try the browser again. (We'll set up proper security in Part 11.)

---

## Part 8: Making It Accessible from the Internet

Right now, people have to type `http://YOUR_IP:3000` to access the app. That works, but it's not ideal. We'll set up Nginx (pronounced "engine-X") as a front door — it sits in front of the app and handles incoming web traffic properly.

### Step 8.1: Install Nginx

```bash
sudo apt install -y nginx
```

### Step 8.2: Create the Nginx configuration

This tells Nginx to forward all web traffic to the app:

```bash
sudo tee /etc/nginx/sites-available/cocogear > /dev/null << 'EOF'
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
EOF
```

**What does this do?** When someone visits your server's IP address in their browser (on port 80 — the default web port), Nginx will forward the request to COCO Gear (running on port 3000 internally). Think of Nginx as a receptionist who directs visitors to the right office.

### Step 8.3: Enable the configuration

```bash
sudo ln -sf /etc/nginx/sites-available/cocogear /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

**What does this do?** Activates our configuration and removes the default "Welcome to Nginx" placeholder page.

### Step 8.4: Check for typos and restart Nginx

```bash
sudo nginx -t
```

**What you should see:** `syntax is ok` and `test is successful`. If it says there's an error, go back to Step 8.2 and make sure you copied the entire command.

```bash
sudo systemctl reload nginx
```

### Step 8.5: Test it

Open your browser and go to:

```
http://YOUR_SERVER_IP
```

Notice there's **no `:3000` this time** — just the plain IP address. Nginx is handling port 80 (the default) and forwarding to port 3000 behind the scenes.

**You should see the COCO Gear login page.** If you do, Nginx is working!

---

## Part 9: Adding a Domain Name (Optional)

Instead of telling people to visit `http://164.90.150.23`, you can buy a domain name like `gear.yourcompany.com`. This part is optional — the app works fine with just an IP address.

### Step 9.1: Buy a domain name

You can buy a domain from any registrar — Namecheap, Google Domains, Cloudflare, GoDaddy, etc. Costs about $10-15/year.

### Step 9.2: Point the domain to your server

In your domain registrar's DNS settings, create an **A record**:
- **Name/Host:** `@` (or your subdomain, like `gear`)
- **Type:** A
- **Value:** Your server's IP address (e.g., `164.90.150.23`)
- **TTL:** 300 (or "5 minutes" or "Automatic")

**What does this do?** It tells the internet "when someone types `gear.yourcompany.com`, send them to this IP address." It can take up to 30 minutes for this to start working (though it's usually faster).

### Step 9.3: Update Nginx with your domain name

```bash
sudo nano /etc/nginx/sites-available/cocogear
```

Find the line that says:
```
    server_name _;
```

Change `_` to your domain name:
```
    server_name gear.yourcompany.com;
```

Save and exit (Ctrl+O, Enter, Ctrl+X), then reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 9.4: Test it

Wait a few minutes for DNS to propagate, then open your browser and go to `http://gear.yourcompany.com`. You should see the COCO Gear login page.

---

## Part 10: Setting Up HTTPS — the Padlock Icon (Optional)

**Requires:** A domain name (Part 9). You cannot get HTTPS with just an IP address.

HTTPS encrypts the connection between the browser and the server. It's what gives you the padlock icon in the browser. Without it, login PINs are sent in plain text, which is a security risk.

### Step 10.1: Install Certbot

Certbot is a free tool that gets you an HTTPS certificate from Let's Encrypt (a free certificate authority).

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 10.2: Get the certificate

```bash
sudo certbot --nginx -d gear.yourcompany.com
```

**Replace `gear.yourcompany.com`** with your actual domain name.

**What happens:**
- Certbot will ask for your email address — enter it (this is for expiry reminders)
- It will ask if you agree to the terms of service — type **Y** and Enter
- It will ask about sharing your email — type **N** (or Y, up to you)
- It will automatically verify you own the domain, get a certificate, and configure Nginx

**When it's done,** you'll see a message like "Congratulations! Your certificate and chain have been saved."

### Step 10.3: Test it

Open your browser and go to `https://gear.yourcompany.com` (note: **https**, not http).

You should see:
- The padlock icon in the browser's address bar
- The COCO Gear login page

**The certificate renews automatically.** Certbot set up a background task that renews it before it expires (every 90 days). You don't need to do anything.

---

## Part 11: Locking Down the Server

Right now, all the server's ports are wide open. Let's close everything except what we need.

### Step 11.1: Enable the firewall

**Run these commands in this exact order.** The first one is critical — it makes sure you don't lock yourself out:

```bash
sudo ufw allow OpenSSH
```

```bash
sudo ufw allow 'Nginx Full'
```

```bash
sudo ufw deny 3000
```

```bash
sudo ufw enable
```

It will ask `Command may disrupt existing SSH connections. Proceed with operation (y|n)?` — type **y** and press Enter.

**What did we just do?**
- Allowed SSH (port 22) — so you can still connect to the server
- Allowed Nginx (ports 80 and 443) — so people can visit the website
- Blocked port 3000 — so people can't bypass Nginx and access the app directly
- Turned the firewall on

### Step 11.2: Verify the firewall

```bash
sudo ufw status
```

**What you should see:**

```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
3000                       DENY        Anywhere
...
```

### Step 11.3: Enable automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

When asked, select **Yes**. This means Ubuntu will automatically install security patches so you don't have to remember to do it.

---

## Part 12: Setting Up Automatic Backups

If the server crashes or you accidentally delete something, you'll want a backup of your data. Let's set up automatic daily backups.

### Step 12.1: Create a backups folder

```bash
sudo mkdir -p /opt/backups
```

### Step 12.2: Create the backup script

```bash
sudo tee /opt/backups/backup-cocogear.sh > /dev/null << 'SCRIPT'
#!/bin/bash

# Create a backup of the database
BACKUP_FILE="/opt/backups/cocogear_$(date +%Y%m%d_%H%M%S).dump"
docker compose -f /opt/slate/coco-gear/docker-compose.yml exec -T db pg_dump -U coco --format=custom cocogear > "$BACKUP_FILE"

# Check the backup isn't empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "$(date): BACKUP FAILED - file is empty" >> /opt/backups/backup.log
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Delete backups older than 30 days (so they don't fill up the disk)
find /opt/backups -name "cocogear_*.dump" -mtime +30 -delete

echo "$(date): Backup successful - $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" >> /opt/backups/backup.log
SCRIPT

sudo chmod +x /opt/backups/backup-cocogear.sh
```

### Step 12.3: Test the backup script

```bash
sudo /opt/backups/backup-cocogear.sh
```

Check that a backup file was created:

```bash
ls -la /opt/backups/
```

**What you should see:** A file like `cocogear_20260205_143022.dump` — the numbers are today's date and time. If you see it, backups are working.

### Step 12.4: Schedule automatic daily backups

```bash
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /opt/backups/backup-cocogear.sh") | sudo crontab -
```

**What does this do?** Tells the server to run the backup script every night at 2:00 AM. `crontab` is like a task scheduler — similar to setting an alarm clock.

Verify the schedule was saved:

```bash
sudo crontab -l
```

**What you should see:** A line containing `0 2 * * * /opt/backups/backup-cocogear.sh`.

### How to restore from a backup (if you ever need to)

If you need to restore your data from a backup:

```bash
# Step 1: Stop the app
cd /opt/slate/coco-gear
docker compose stop app

# Step 2: Restore the backup (replace the filename with your backup file)
docker compose exec -T db pg_restore -U coco -d cocogear --clean --if-exists < /opt/backups/cocogear_20260205_020000.dump

# Step 3: Start the app again
docker compose start app
```

---

## Part 13: Day-to-Day Management

Here are the commands you'll use to manage the app on an ongoing basis. Keep this page bookmarked.

### Checking if the app is running

```bash
cd /opt/slate/coco-gear
docker compose ps
```

Both `db` and `app` should say "Up" or "running."

### Viewing the app's logs (to see what it's doing or find errors)

```bash
cd /opt/slate/coco-gear
docker compose logs -f app
```

This shows a live stream of what the app is doing. **Press Ctrl + C to stop watching** — this does NOT stop the app, it just stops showing you the logs.

### Restarting the app (if something seems stuck)

```bash
cd /opt/slate/coco-gear
docker compose restart
```

### Stopping the app

```bash
cd /opt/slate/coco-gear
docker compose down
```

### Starting the app again after stopping

```bash
cd /opt/slate/coco-gear
docker compose up -d
```

### Checking how much disk space is being used

```bash
df -h
```

Look at the row for `/` — the "Use%" column shows how full the disk is. If it's over 80%, you might need to clean up old backups or upgrade your server's disk.

---

## Part 14: Updating the App When New Versions Come Out

When the development team releases a new version of COCO Gear, here's how to update your server:

### Step 14.1: Make a backup first (always!)

```bash
sudo /opt/backups/backup-cocogear.sh
```

### Step 14.2: Download the latest code

```bash
cd /opt/slate
git pull origin main
```

### Step 14.3: Rebuild and restart

```bash
cd /opt/slate/coco-gear
docker compose up -d --build
```

This will rebuild the app with the new code and restart it. It takes a few minutes. The app will be briefly unavailable during this time.

### Step 14.4: Verify it's working

```bash
docker compose ps
curl http://localhost:3000/api/health
```

Check that both containers are "Up" and the health check returns `"status":"ok"`.

---

## Something Went Wrong — Troubleshooting

### "I can't connect to the server with SSH"

- Double-check you're using the correct IP address
- Make sure you're typing `ssh root@YOUR_IP` exactly
- Your hosting provider may have a "Console" button on their website — try that as a backup way to connect
- If you enabled the firewall and can't connect, use the hosting provider's console to run `sudo ufw allow OpenSSH`

### "docker compose up" shows errors

First, check the logs:

```bash
cd /opt/slate/coco-gear
docker compose logs
```

Scroll up and look for red text or lines that say "error" or "ERROR."

**If it mentions "database" or "password":**
Your database password in `docker-compose.yml` doesn't match the `.env` file. Go back to Part 6 and make sure the passwords are identical in both places.

**If it mentions "port already in use":**
Something else is already using port 3000 or 5432. Run:
```bash
docker compose down
docker compose up -d
```

**If it seems to hang or the app container keeps restarting:**
The server might not have enough memory. Run:
```bash
free -h
```
If "available" memory is very low (under 200M), add swap space:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
Then try again:
```bash
cd /opt/slate/coco-gear
docker compose down
docker compose up -d --build
```

### "The app loads but I see a white screen"

This usually means the frontend build failed. Check:
```bash
cd /opt/slate/coco-gear
docker compose logs app
```
Look for errors related to "build" or "vite". Try rebuilding:
```bash
docker compose up -d --build
```

### "I can see the app at IP:3000 but not at the plain IP"

Nginx isn't working. Check:
```bash
sudo nginx -t
```
If it says there's an error, there's a typo in the config file. Re-do Part 8.

If the test passes, make sure Nginx is running:
```bash
sudo systemctl restart nginx
```

### "The page loads but login doesn't work"

Check the app logs:
```bash
cd /opt/slate/coco-gear
docker compose logs app
```

If you see "invalid token" or JWT errors, your `JWT_SECRET` might have special characters that got mangled. Generate a new one using only letters and numbers:
```bash
openssl rand -hex 32
```
Then update it in both `docker-compose.yml` and `.env`, and restart:
```bash
docker compose down
docker compose up -d
```

### "I forgot my passwords"

**Server password:** Use your hosting provider's "Reset Root Password" feature from their website.

**App passwords (JWT_SECRET, Database):** You can see them by looking at the config files:
```bash
cat /opt/slate/coco-gear/.env
cat /opt/slate/coco-gear/docker-compose.yml
```

### "I want to start over completely"

This will erase ALL data (kits, users, everything) and start fresh:

```bash
cd /opt/slate/coco-gear
docker compose down -v
docker compose up -d --build
```

The `-v` flag deletes all stored data. Only do this if you really want to start over.

---

## Glossary: What Do All These Words Mean?

| Term | What It Means |
|------|---------------|
| **Server** | A computer on the internet that's always running, hosting your app |
| **SSH** | A way to securely connect to another computer and type commands on it |
| **Terminal** | The program on your computer where you type commands (black window, white text) |
| **Ubuntu** | A version of Linux (an operating system, like Windows or macOS, but free and popular for servers) |
| **Docker** | A tool that packages an app and everything it needs into a container, making it easy to run anywhere |
| **Docker Compose** | A tool for running multiple Docker containers together (our app needs two: the app itself and the database) |
| **Container** | A packaged, isolated instance of an application — like a virtual computer inside your computer |
| **Nginx** | A web server that sits in front of your app, handling incoming internet traffic and forwarding it to the app |
| **Port** | Like a numbered doorway on a computer. Web traffic uses port 80 (HTTP) or 443 (HTTPS). Our app uses port 3000 internally. |
| **IP Address** | A numeric address for a computer on the internet (like `164.90.150.23`) |
| **Domain Name** | A human-readable address (like `gear.yourcompany.com`) that points to an IP address |
| **HTTPS / SSL / TLS** | Encryption that protects data sent between the browser and server (the padlock icon) |
| **Let's Encrypt** | A free service that provides HTTPS certificates |
| **Certbot** | A program that gets certificates from Let's Encrypt and installs them |
| **Firewall (UFW)** | Software that blocks unwanted network connections, like a bouncer at a door |
| **PostgreSQL** | The database where the app stores all its data (users, kits, inspections, etc.) |
| **Git** | A tool for downloading and managing code |
| **API** | The part of the app that handles data requests — the backend brain behind the web page |
| **Environment variables** | Settings stored in a file (`.env`) that the app reads when it starts — like passwords and configuration |
| **JWT** | "JSON Web Token" — a secure way the app remembers that you're logged in |
| **Backup / pg_dump** | A saved copy of all your database data that you can restore from if something goes wrong |
| **cron / crontab** | A scheduler that runs commands automatically at set times (like an alarm clock for commands) |
| **sudo** | "Super User Do" — run a command as the administrator |
| **nano** | A simple text editor that works in the terminal |
| **curl** | A command that fetches a web page — useful for testing if the app is responding |

---

## Reference: Technical Details

This section is for anyone who wants to understand what's happening under the hood. You don't need to read this to get the app running.

### What the app is made of

COCO Gear has three main parts:

1. **The frontend** (what users see in their browser) — built with React 19 and Vite. In production, it's compiled into static HTML/CSS/JavaScript files that live in `client/dist/`.

2. **The backend** (the server-side brain) — built with Express.js (Node.js). Handles the REST API (`/api/*`), file uploads (`/uploads/*`), authentication (JWT tokens), and serves the frontend files. Runs on port 3000.

3. **The database** (where data is stored) — PostgreSQL 16. Managed through Prisma ORM. Contains 20+ tables for users, departments, locations, kits, inspections, maintenance, audit logs, and more.

### Architecture diagram

```
Internet
   |
   v
[Nginx - port 80/443] -- forwards all requests to -->  [Express.js - port 3000]  <-->  [PostgreSQL - port 5432]
                                                               |
                                                        [/uploads/ directory]
                                                         (uploaded photos)
```

### Environment variables

| Variable | What It Does |
|----------|-------------|
| `DATABASE_URL` | The address and password for connecting to PostgreSQL |
| `JWT_SECRET` | A secret key used to create secure login tokens. If you change this, everyone gets logged out. |
| `JWT_EXPIRES_IN` | How long a login session lasts before the user has to log in again (default: 24 hours) |
| `PORT` | Which port the app listens on (default: 3000) |
| `NODE_ENV` | Set to `production` so the app serves the website and hides technical error messages |
| `UPLOAD_DIR` | Where uploaded photos are stored on disk |
| `MAX_FILE_SIZE` | Maximum photo upload size in bytes (default: 10 MB = 10485760) |

### Default sample data

After the first startup, the app is loaded with sample data for testing:

**8 sample users** (all use PIN **1234**):

| Name | Role | Department |
|------|------|------------|
| Jordan Martinez | Super Admin | — |
| Taylor Nguyen | Admin | — |
| Riley Chen | User | Comms |
| Drew Williams | User | Comms |
| Kim Thompson | User | Optics |
| Morgan Davis | User | Logistics |
| Lee Garcia | User | Optics |
| Ash Patel | User | Logistics |

Plus: 8 locations, 3 departments, 12 kits, 19 component types, 6 consumables, 10 standalone assets, and system settings.

**Important:** After you've set up real data, you'll want to prevent the sample data from being reloaded if the server restarts. Edit docker-compose.yml and change the `command` section:

```bash
nano /opt/slate/coco-gear/docker-compose.yml
```

Find this section:
```yaml
    command: >
      sh -c "npx prisma db push --skip-generate &&
             node prisma/seed.js &&
             node server/index.js"
```

Remove the `node prisma/seed.js &&` line so it looks like:
```yaml
    command: >
      sh -c "npx prisma db push --skip-generate &&
             node server/index.js"
```

Save (Ctrl+O, Enter, Ctrl+X), then restart:
```bash
cd /opt/slate/coco-gear
docker compose down
docker compose up -d
```

### Security features already built into the app

- **PIN-based login** with bcrypt hashing (PINs are never stored in plain text)
- **Role-based access control** — Super Admin > Admin > User — each level has different permissions
- **JWT authentication** — secure, stateless login sessions
- **File upload restrictions** — only image files (JPEG, PNG, GIF, WebP), max 10 MB each, max 10 per request
- **SQL injection protection** — all database queries go through Prisma ORM
- **Input validation** — Zod library validates all incoming data
- **Audit logging** — every checkout, return, inspection, and maintenance action is logged with who did it and when
