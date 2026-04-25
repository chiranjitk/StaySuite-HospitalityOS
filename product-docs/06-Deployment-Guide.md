# StaySuite Deployment Guide
## Installation and Configuration Manual

**Version**: 1.0  
**Last Updated**: March 2026

---

## Table of Contents

1. [Deployment Options](#1-deployment-options)
2. [Cloud SaaS Deployment](#2-cloud-saas-deployment)
3. [On-Premise Deployment](#3-on-premise-deployment)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Setup](#5-database-setup)
6. [SSL/TLS Configuration](#6-ssltls-configuration)
7. [Monitoring Setup](#7-monitoring-setup)
8. [Backup Configuration](#8-backup-configuration)
9. [Scaling Guidelines](#9-scaling-guidelines)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Deployment Options

### 1.1 Cloud SaaS

| Feature | Description |
|---------|-------------|
| **Hosting** | Managed by Cryptsk |
| **Updates** | Automatic |
| **Scaling** | Automatic |
| **Backup** | Automatic |
| **SLA** | 99.9% uptime |

### 1.2 On-Premise

| Feature | Description |
|---------|-------------|
| **Hosting** | Customer infrastructure |
| **Updates** | Manual |
| **Scaling** | Manual |
| **Backup** | Customer responsibility |
| **Data Location** | Customer controlled |

---

## 2. Cloud SaaS Deployment

### 2.1 Getting Started

1. Contact sales@cryptsk.com
2. Sign subscription agreement
3. Receive tenant credentials
4. Access at `https://[tenant].staysuite.io`

### 2.2 Tenant Setup

1. Login with admin credentials
2. Configure property settings
3. Add users and roles
4. Set up integrations
5. Configure branding

---

## 3. On-Premise Deployment

### 3.1 System Requirements

**Minimum:**

| Component | Specification |
|-----------|---------------|
| CPU | 4 cores |
| RAM | 16 GB |
| Storage | 100 GB SSD |
| Network | 100 Mbps |

**Recommended:**

| Component | Specification |
|-----------|---------------|
| CPU | 8+ cores |
| RAM | 32+ GB |
| Storage | 500+ GB SSD |
| Network | 1 Gbps |

### 3.2 Software Requirements

| Software | Version |
|----------|---------|
| Node.js | 20.x LTS |
| PostgreSQL | 15+ |
| Redis | 7+ |
| Nginx | 1.24+ |
| Docker | 24+ (optional) |

### 3.3 Docker Deployment

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  app:
    image: cryptsk/staysuite:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/staysuite
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=staysuite
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

**Deployment:**

```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Check logs
docker-compose logs -f app
```

### 3.4 Manual Deployment

**Step 1: Install Node.js**

```bash
# Using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Step 2: Install PostgreSQL**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE staysuite;
CREATE USER staysuite WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE staysuite TO staysuite;
```

**Step 3: Install Redis**

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl enable redis-server
```

**Step 4: Clone and Configure**

```bash
# Clone repository
git clone https://github.com/your-org/staysuite.git
cd staysuite

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

**Step 5: Configure Environment**

Edit `.env`:

```env
# Database
DATABASE_URL="postgresql://staysuite:password@localhost:5432/staysuite"

# Redis
REDIS_URL="redis://localhost:6379"

# App
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Auth
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=https://your-domain.com

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key
```

**Step 6: Run Migrations**

```bash
npx prisma generate
npx prisma migrate deploy
```

**Step 7: Build and Start**

```bash
npm run build
npm start
```

### 3.5 Nginx Configuration

**/etc/nginx/sites-available/staysuite:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 4. Environment Configuration

### 4.1 Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | Random secret for sessions |
| `NEXTAUTH_URL` | Public URL of application |
| `ENCRYPTION_KEY` | 32-byte key for data encryption |

### 4.2 Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Application port |
| `LOG_LEVEL` | info | Logging level |
| `RATE_LIMIT_MAX` | 300 | Max requests per minute |
| `SESSION_TIMEOUT` | 43200 | Session timeout (seconds) |

### 4.3 Feature Flags

```env
FEATURE_WIFI_ENABLED=true
FEATURE_POS_ENABLED=true
FEATURE_CHANNEL_MANAGER_ENABLED=true
FEATURE_AI_ENABLED=true
```

---

## 5. Database Setup

### 5.1 PostgreSQL Configuration

**postgresql.conf optimizations:**

```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB

# Connections
max_connections = 200

# Logging
log_min_duration_statement = 500
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### 5.2 Database Migrations

```bash
# Apply migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Create new migration (development)
npx prisma migrate dev --name description
```

### 5.3 Database Backups

**Automated backup script:**

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="staysuite"

pg_dump $DB_NAME > $BACKUP_DIR/staysuite_$DATE.sql

# Compress
gzip $BACKUP_DIR/staysuite_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

**Cron job:**

```bash
0 2 * * * /path/to/backup.sh
```

---

## 6. SSL/TLS Configuration

### 6.1 Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 6.2 Custom Certificate

```nginx
ssl_certificate /path/to/certificate.crt;
ssl_certificate_key /path/to/private.key;
ssl_certificate_chain /path/to/chain.crt;
```

---

## 7. Monitoring Setup

### 7.1 Health Check Endpoint

```http
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-15T10:00:00Z",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "storage": "available"
  }
}
```

### 7.2 Logging

Logs are written to stdout in JSON format:

```json
{
  "level": "info",
  "timestamp": "2026-03-15T10:00:00Z",
  "message": "Booking created",
  "tenant_id": "tn_001",
  "booking_id": "bk_123",
  "user_id": "usr_001"
}
```

### 7.3 Metrics

Available metrics:
- API response times
- Database query times
- Queue depth
- Memory usage
- CPU usage
- Active connections

---

## 8. Backup Configuration

### 8.1 Backup Strategy

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Transaction logs | Continuous | 24 hours |

### 8.2 Point-in-Time Recovery

Enable WAL archiving in PostgreSQL:

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

---

## 9. Scaling Guidelines

### 9.1 Horizontal Scaling

```
                    ┌──────────┐
                    │Load      │
                    │Balancer  │
                    └──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │ App     │     │ App     │     │ App     │
   │ Instance│     │ Instance│     │ Instance│
   │ 1       │     │ 2       │     │ 3       │
   └────┬────┘     └────┬────┘     └────┬────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │PostgreSQL│          │  Redis  │
         │ Primary  │          │ Cluster │
         └──────────┘          └─────────┘
```

### 9.2 Database Scaling

- Read replicas for read-heavy workloads
- Connection pooling with PgBouncer
- Partitioning for large tables

### 9.3 Caching Strategy

- Redis for session storage
- Redis for API response caching
- CDN for static assets

---

## 10. Troubleshooting

### 10.1 Common Issues

**Application won't start:**

```bash
# Check logs
docker-compose logs app

# Check database connection
npx prisma db pull

# Verify environment
node -e "console.log(process.env.DATABASE_URL)"
```

**Database connection errors:**

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U staysuite -d staysuite -h localhost
```

**Redis connection errors:**

```bash
# Check Redis status
redis-cli ping

# Check Redis logs
sudo journalctl -u redis-server
```

### 10.2 Performance Issues

**Slow API responses:**

1. Check database query times
2. Review slow query log
3. Add missing indexes
4. Increase connection pool

**High memory usage:**

1. Check for memory leaks
2. Reduce cache TTL
3. Scale horizontally

---

## Support

For deployment support:

- **Email**: support@cryptsk.com
- **Emergency**: +91 XXX XXX XXXX

---

*© 2026 Cryptsk Pvt Ltd*
