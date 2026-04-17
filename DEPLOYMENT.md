# StaySuite Production Deployment Guide (Debian 13)

## Prerequisites

| Requirement | Minimum Version |
|---|---|
| Node.js | 20+ |
| Bun | Latest (1.x) |
| PostgreSQL | 15+ (for production) |
| Debian | 13 (Trixie) |

### Install prerequisites on Debian 13

```bash
# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Bun
curl -fsSL https://bun.sh/install | bash

# PostgreSQL 15+
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# Caddy (reverse proxy with auto TLS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git
cd StaySuite-HospitalityOS

# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit with production values

# Install dependencies
bun install

# Generate Prisma client
npx prisma generate

# Set up database (pick one)
npx prisma db push          # Fresh install — syncs schema to DB
# OR
npx prisma migrate deploy  # Run pending migrations (production recommended)

# Optional: seed the database
npx prisma db seed

# Build for production
bun run build
```

---

## Running in Production

### Main Next.js App

```bash
PORT=3000 NODE_ENV=production bun run start
```

### Mini-Services

Each service can be started independently:

```bash
# Realtime WebSocket service (port 3003)
cd mini-services/realtime-service && bun index.ts &

# Availability service (port 3002)
cd mini-services/availability-service && bun server.ts &

# FreeRADIUS management service (port 3010)
cd mini-services/freeradius-service && bun index.ts &
```

Or use the provided script:

```bash
cd mini-services && bash start-services.sh
```

---

## Systemd Service Files

Create these files under `/etc/systemd/system/`.

### staysuite.service (Main Next.js App)

```ini
[Unit]
Description=StaySuite Next.js Application
After=network.target postgresql.service

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite
EnvironmentFile=/opt/staysuite/.env
ExecStart=/usr/bin/bun run start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=staysuite

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/staysuite/.next /opt/staysuite/prisma
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### staysuite-realtime.service (Realtime WebSocket)

```ini
[Unit]
Description=StaySuite Realtime WebSocket Service
After=network.target

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite/mini-services/realtime-service
EnvironmentFile=/opt/staysuite/.env
ExecStart=/usr/bin/bun index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=staysuite-realtime

[Install]
WantedBy=multi-user.target
```

### staysuite-availability.service (Availability Service)

```ini
[Unit]
Description=StaySuite Availability Service
After=network.target

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite/mini-services/availability-service
EnvironmentFile=/opt/staysuite/.env
ExecStart=/usr/bin/bun server.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=staysuite-availability

[Install]
WantedBy=multi-user.target
```

### staysuite-freeradius.service (FreeRADIUS Management)

```ini
[Unit]
Description=StaySuite FreeRADIUS Management Service
After=network.target

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite/mini-services/freeradius-service
EnvironmentFile=/opt/staysuite/.env
ExecStart=/usr/bin/bun index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=staysuite-freeradius

[Install]
WantedBy=multi-user.target
```

### Enable and start all services

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now staysuite
sudo systemctl enable --now staysuite-realtime
sudo systemctl enable --now staysuite-availability
sudo systemctl enable --now staysuite-freeradius

# Check status
sudo systemctl status staysuite staysuite-realtime staysuite-availability staysuite-freeradius
```

---

## Database Migration (SQLite to PostgreSQL)

### Step 1: Set up PostgreSQL

```bash
sudo -u postgres psql
CREATE DATABASE staysuite;
CREATE USER staysuite WITH PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE staysuite TO staysuite;
\q
```

### Step 2: Update .env

```bash
# Change DATABASE_URL in .env
DATABASE_URL="postgresql://staysuite:your-strong-password@localhost:5432/staysuite"
```

### Step 3: Enable required PostgreSQL extensions

```sql
-- Connect to your database
sudo -u postgres psql -d staysuite

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
\q
```

### Step 4: Migrate schema

```bash
# Option A: Fresh PostgreSQL install (no existing data)
npx prisma db push --force-reset

# Option B: Use migrations
npx prisma migrate dev --name init
npx prisma migrate deploy
```

### Step 5: (Optional) Migrate existing SQLite data

Use `pgloader` or export/import:

```bash
sudo apt install -y pgloader

# Create a pgloader script (migrate.load)
pgloader migrate.load
```

Example `migrate.load`:

```
LOAD DATABASE
    FROM sqlite:///opt/staysuite/prisma/dev.db
    INTO postgresql://staysuite:your-password@localhost:5432/staysuite
WITH include drop, create tables, create indexes, reset sequences
CAST type integer to integer drop typemod,
     type text to varchar drop typemod
SET maintenance_work_mem to '128MB',
    work_mem to '12MB'
BEFORE LOAD DO
    $$ ALTER SCHEMA public RENAME TO old; CREATE SCHEMA public; $$;
AFTER LOAD DO
    $$ DROP SCHEMA old CASCADE; $$;
```

---

## Seed Data

The application includes comprehensive seed data for demo/testing:

```bash
npx prisma db seed
```

**Note**: Seed data uses CUID string IDs (e.g., `tenant-1`, `user-1`). For PostgreSQL,
you must either:

1. Use the provided SQLite schema for development, or
2. Run the `seed.postgresql.ts` script (if provided) with UUID-compatible seed data

---

## Caddy Reverse Proxy

Edit `/etc/caddy/Caddyfile`:

```
staysuite.example.com {
    reverse_proxy localhost:3000

    # Security headers (Caddy adds most automatically)
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    # Logging
    log {
        output file /var/log/caddy/staysuite.log
    }
}

# Realtime WebSocket service (if exposed directly)
realtime.staysuite.example.com {
    reverse_proxy localhost:3003
}
```

```bash
sudo systemctl reload caddy
```

---

## Firewall Configuration

```bash
sudo apt install -y ufw
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (Caddy)
sudo ufw allow 443/tcp    # HTTPS (Caddy)
sudo ufw enable
```

---

## Useful Commands

```bash
# View logs
sudo journalctl -u staysuite -f
sudo journalctl -u staysuite-realtime -f

# Restart after code update
cd /opt/staysuite && git pull && bun install && bun run build
sudo systemctl restart staysuite

# Database migrations after schema change
npx prisma migrate deploy
sudo systemctl restart staysuite
```
