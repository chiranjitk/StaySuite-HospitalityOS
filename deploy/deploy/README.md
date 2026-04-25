# StaySuite HospitalityOS - Deployment Guide

## Quick Start

### 1. Prepare the Server

```bash
# Copy setup script and run on a fresh Debian 13 server
scp deploy/debian13/setup.sh root@your-server:/tmp/
ssh root@your-server 'bash /tmp/setup.sh'
```

The setup script handles everything: Node.js, Bun, PostgreSQL, Nginx, SSL, firewall.

### 2. Deploy Application Code

```bash
# From your local machine
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='db/*.db' \
    ./ staysuite@your-server:/opt/staysuite/
```

### 3. Install & Build

```bash
ssh staysuite@your-server

# Install dependencies
cd /opt/staysuite && bun install

# Build Next.js
bun run build

# Run database migrations
bunx prisma migrate deploy

# Install mini-service dependencies
for svc in realtime-service availability-service freeradius-service; do
    cd /opt/staysuite/mini-services/$svc && bun install
done
```

### 4. Start Services

```bash
sudo systemctl enable --now staysuite
sudo systemctl enable --now staysuite-realtime
sudo systemctl enable --now staysuite-availability
sudo systemctl enable --now staysuite-freeradius
```

### 5. Verify

```bash
systemctl status staysuite
curl -k https://your-domain.com/api/health
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `.env.production.example` | Environment variable template |
| `deploy/debian13/setup.sh` | Full server setup automation |
| `deploy/debian13/systemd/*.service` | Systemd service definitions |
| `deploy/debian13/nginx/staysuite.conf` | Nginx reverse proxy config |
| `deploy/migrate-to-postgres.sh` | SQLite to PostgreSQL migration |
| `mini-services/start-services.sh` | Local dev service starter |

---

## Useful Commands

```bash
# View logs
journalctl -u staysuite -f

# Restart a service
sudo systemctl restart staysuite-realtime

# SSL certificate renewal
sudo certbot renew

# Database backup
pg_dump staysuite > backup_$(date +%Y%m%d).sql
```
