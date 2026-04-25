#!/bin/bash
# =============================================================================
# StaySuite HospitalityOS - Debian 13 (Trixie) Production Setup
# =============================================================================
# This script automates the full production deployment of StaySuite on a fresh
# Debian 13 server. Run as root or with sudo.
#
# Usage:
#   sudo bash setup.sh
#
# Prerequisites:
#   - Fresh Debian 13 (Trixie) install (minimal server)
#   - Root or sudo access
#   - Domain name pointing to this server's IP
#   - At least 2GB RAM (4GB+ recommended for production)
#   - At least 20GB disk space
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Configuration variables
# ---------------------------------------------------------------------------
APP_NAME="staysuite"
APP_USER="staysuite"
APP_GROUP="staysuite"
APP_DIR="/opt/${APP_NAME}"
DB_NAME="${APP_NAME}"
DB_USER="${APP_NAME}"
DB_PASSWORD=""  # Will be generated or prompted
APP_DOMAIN=""   # Will be prompted

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log_info "Starting StaySuite HospitalityOS production setup..."
log_info "Target: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"

if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)."
    exit 1
fi

# Check Debian version
if ! grep -qi "debian" /etc/os-release 2>/dev/null; then
    log_warn "This script is designed for Debian. Your system may differ."
    read -rp "Continue anyway? [y/N] " confirm
    [[ "$confirm" != [yY]* ]] && exit 1
fi

echo ""
log_info "================================================================"
log_info " StaySuite HospitalityOS - Production Setup"
log_info "================================================================"
echo ""

# Prompt for domain
while [[ -z "$APP_DOMAIN" ]]; do
    read -rp "Enter your domain name (e.g., app.yourdomain.com): " APP_DOMAIN
    if [[ -z "$APP_DOMAIN" ]]; then
        log_error "Domain name is required."
    fi
done

# Prompt for database password or generate one
read -rp "Generate a random database password? [Y/n] " gen_pass
if [[ "$gen_pass" =~ ^[nN] ]]; then
    while [[ -z "$DB_PASSWORD" ]]; do
        read -rsp "Enter database password (min 16 chars): " DB_PASSWORD
        echo
        if [[ ${#DB_PASSWORD} -lt 16 ]]; then
            log_error "Password must be at least 16 characters."
            DB_PASSWORD=""
        fi
    done
else
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    log_info "Generated database password: ${DB_PASSWORD}"
fi

# Generate NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)
log_info "Generated NEXTAUTH_SECRET."

echo ""
log_warn "Write down these values - you will need them for .env.production:"
echo "  Domain:             ${APP_DOMAIN}"
echo "  Database Name:      ${DB_NAME}"
echo "  Database User:      ${DB_USER}"
echo "  Database Password:  ${DB_PASSWORD}"
echo "  NextAuth Secret:    ${NEXTAUTH_SECRET}"
echo ""

read -rp "Continue with installation? [Y/n] " confirm
[[ "$confirm" =~ ^[nN] ]] && exit 0

# =============================================================================
# STEP 1: System Updates
# =============================================================================
log_info "=== Step 1: System Updates ==="

log_info "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

log_info "Upgrading installed packages..."
apt-get upgrade -y -qq

# Install basic utilities
log_info "Installing basic utilities..."
apt-get install -y -qq \
    curl \
    wget \
    gnupg2 \
    ca-certificates \
    lsb-release \
    apt-transport-https \
    software-properties-common \
    ufw \
    fail2ban \
    unattended-upgrades \
    logrotate \
    htop \
    vim \
    git \
    jq \
    rsync \
    unzip \
    build-essential

log_success "System packages updated and utilities installed."

# =============================================================================
# STEP 2: Install Node.js 22 LTS
# =============================================================================
log_info "=== Step 2: Install Node.js 22 LTS ==="

if command -v node &>/dev/null && [[ $(node -v | cut -d. -f1 | tr -d v) -ge 22 ]]; then
    log_success "Node.js $(node -v) already installed."
else
    log_info "Adding NodeSource repository for Node.js 22..."
    # Remove old NodeSource setup if exists
    rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
    rm -f /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list

    apt-get update -qq
    log_info "Installing Node.js 22..."
    apt-get install -y -qq nodejs

    log_success "Node.js $(node -v) installed."
fi

# =============================================================================
# STEP 3: Install Bun Runtime
# =============================================================================
log_info "=== Step 3: Install Bun Runtime ==="

if command -v bun &>/dev/null; then
    log_success "Bun $(bun --version) already installed."
else
    log_info "Installing Bun via official install script..."
    curl -fsSL https://bun.sh/install | bash

    # Make bun available system-wide
    BUN_BIN="/root/.bun/bin/bun"
    if [[ -f "$BUN_BIN" ]]; then
        ln -sf "$BUN_BIN" /usr/local/bin/bun
        log_success "Bun $(bun --version) installed."
    else
        log_error "Bun installation failed. Please install manually."
        exit 1
    fi
fi

# =============================================================================
# STEP 4: Install PostgreSQL 17
# =============================================================================
log_info "=== Step 4: Install PostgreSQL 17 ==="

if command -v psql &>/dev/null; then
    log_warn "PostgreSQL already installed: $(psql --version)"
else
    log_info "Adding PostgreSQL APT repository..."

    # Import the PostgreSQL signing key
    install -d /usr/share/postgresql-common/pgdg
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor \
        | tee /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg >/dev/null

    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
        http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list

    apt-get update -qq

    log_info "Installing PostgreSQL 17..."
    apt-get install -y -qq postgresql-17 postgresql-client-17

    # Start and enable PostgreSQL
    systemctl enable --now postgresql

    log_success "PostgreSQL 17 installed and started."
fi

# =============================================================================
# STEP 5: Configure PostgreSQL Database
# =============================================================================
log_info "=== Step 5: Configure PostgreSQL Database ==="

# Check if database/user already exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" == "1" ]]; then
    log_warn "Database user '${DB_USER}' already exists. Skipping creation."
else
    log_info "Creating database user '${DB_USER}'..."
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
fi

# Check if database already exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" == "1" ]]; then
    log_warn "Database '${DB_NAME}' already exists. Skipping creation."
else
    log_info "Creating database '${DB_NAME}'..."
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# Configure PostgreSQL for production performance
PG_CONF="/etc/postgresql/17/main/postgresql.conf"
PG_HBA="/etc/postgresql/17/main/pg_hba.conf"

log_info "Tuning PostgreSQL configuration for production..."

# Basic production tuning based on available memory
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))

if [[ $TOTAL_MEM_MB -ge 4096 ]]; then
    SHARED_BUFFERS="1GB"
    EFFECTIVE_CACHE="3GB"
    WORK_MEM="64MB"
    MAINTENANCE_WORK_MEM="256MB"
elif [[ $TOTAL_MEM_MB -ge 2048 ]]; then
    SHARED_BUFFERS="512MB"
    EFFECTIVE_CACHE="1500MB"
    WORK_MEM="32MB"
    MAINTENANCE_WORK_MEM="128MB"
else
    SHARED_BUFFERS="256MB"
    EFFECTIVE_CACHE="768MB"
    WORK_MEM="16MB"
    MAINTENANCE_WORK_MEM="64MB"
fi

# Backup original config
cp "$PG_CONF" "${PG_CONF}.bak"

# Apply tuned settings (using sed to preserve existing comments)
for setting in \
    "shared_buffers = '${SHARED_BUFFERS}'" \
    "effective_cache_size = '${EFFECTIVE_CACHE}'" \
    "work_mem = '${WORK_MEM}'" \
    "maintenance_work_mem = '${MAINTENANCE_WORK_MEM}'" \
    "checkpoint_completion_target = 0.9" \
    "wal_buffers = '16MB'" \
    "default_statistics_target = 100" \
    "random_page_cost = 1.1" \
    "effective_io_concurrency = 200" \
    "min_wal_size = '1GB'" \
    "max_wal_size = '4GB'" \
    "max_connections = 100" \
    "log_min_duration_statement = 500" \
    "log_checkpoints = on" \
    "log_connections = on" \
    "log_disconnections = on" \
    "log_line_prefix = '%t [%p]: db=%d,user=%u,app=%a,client=%h '"; do
    KEY=$(echo "$setting" | cut -d= -f1 | xargs)
    # Comment out existing setting if present
    sed -i "s/^\s*${KEY}\s*=.*/# &/" "$PG_CONF"
    # Add new setting at end
    echo "$setting" >> "$PG_CONF"
done

# Configure pg_hba.conf for local connections with password auth
cp "$PG_HBA" "${PG_HBA}.bak"
cat > "$PG_HBA" << 'HBA_EOF'
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             all                                     peer
# IPv4 local connections (password auth for app)
host    all             all             127.0.0.1/32            scram-sha-256
# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256
HBA_EOF

# Restart PostgreSQL to apply changes
systemctl restart postgresql

# Verify connection
if sudo -u postgres psql -d "${DB_NAME}" -c "SELECT 1;" &>/dev/null; then
    log_success "PostgreSQL configured. Database '${DB_NAME}' is ready."
else
    log_error "Failed to connect to PostgreSQL database."
    exit 1
fi

# =============================================================================
# STEP 6: Install and Configure Nginx
# =============================================================================
log_info "=== Step 6: Install and Configure Nginx ==="

if command -v nginx &>/dev/null; then
    log_warn "Nginx already installed. Skipping installation."
else
    log_info "Installing Nginx..."
    apt-get install -y -qq nginx
    systemctl enable nginx
    log_success "Nginx installed."
fi

# Copy the StaySuite Nginx configuration
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
NGINX_CONF="${NGINX_CONF_DIR}/${APP_NAME}"

log_info "Configuring Nginx reverse proxy..."

# Use the provided Nginx config template, substituting domain
if [[ -f "${APP_DIR}/deploy/debian13/nginx/staysuite.conf" ]]; then
    cp "${APP_DIR}/deploy/debian13/nginx/staysuite.conf" "$NGINX_CONF"
else
    # Create a basic config if the template doesn't exist yet
    cat > "$NGINX_CONF" << NGINX_EOF
# StaySuite HospitalityOS - Nginx Configuration
# Generated by setup.sh

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server (placeholder - SSL certificates will be configured by certbot)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${APP_DOMAIN};

    # SSL certificates (configured by certbot)
    ssl_certificate /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;

    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'self';" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Logging
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log  /var/log/nginx/${APP_NAME}_error.log;

    # Next.js application - reverse proxy to port 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    # WebSocket proxy for realtime service (port 3003)
    location /socket.io/realtime {
        proxy_pass http://127.0.0.1:3003/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # WebSocket proxy for availability service (port 3002)
    location /socket.io/availability {
        proxy_pass http://127.0.0.1:3002/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # WebSocket proxy for FreeRADIUS management (port 3010)
    location /socket.io/freeradius {
        proxy_pass http://127.0.0.1:3010/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Next.js static assets with caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Block sensitive paths
    location ~ /\.(?!well-known) {
        deny all;
        return 404;
    }
}
NGINX_EOF
fi

# Enable site and disable default
ln -sf "$NGINX_CONF" "${NGINX_ENABLED_DIR}/${APP_NAME}"
rm -f "${NGINX_ENABLED_DIR}/default"

# Test Nginx configuration (may fail until SSL certs are installed)
if nginx -t 2>/dev/null; then
    log_success "Nginx configuration is valid."
else
    log_warn "Nginx config test failed (expected if SSL certs not yet installed)."
    log_info "SSL will be configured in Step 8."
fi

# =============================================================================
# STEP 7: Setup Application User and Directory
# =============================================================================
log_info "=== Step 7: Setup Application User and Directory ==="

# Create application user if it doesn't exist
if id "${APP_USER}" &>/dev/null; then
    log_warn "User '${APP_USER}' already exists. Skipping creation."
else
    log_info "Creating application user '${APP_USER}'..."
    useradd -r -m -d "${APP_DIR}" -s /bin/bash "${APP_USER}"
    log_success "User '${APP_USER}' created."
fi

# Create application directory structure
log_info "Creating application directories..."
mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/.next"
mkdir -p "${APP_DIR}/mini-services"
mkdir -p "${APP_DIR}/db"
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/uploads"

# Set ownership
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
chmod 755 "${APP_DIR}"

# Create .env.production file
log_info "Creating .env.production configuration..."
cat > "${APP_DIR}/.env" << ENV_EOF
# =============================================================================
# StaySuite HospitalityOS - Production Environment
# Auto-generated by setup.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# =============================================================================

# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# NextAuth
NEXTAUTH_URL="https://${APP_DOMAIN}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# Application
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://${APP_DOMAIN}"

# Mini-Services
REALTIME_SERVICE_URL="http://localhost:3003"
AVAILABILITY_SERVICE_URL="http://localhost:3002"
FREERADIUS_SERVICE_URL="http://localhost:3010"
ENV_EOF

# Set restrictive permissions on .env (contains secrets)
chmod 600 "${APP_DIR}/.env"
chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
log_success ".env.production created at ${APP_DIR}/.env"

# =============================================================================
# STEP 8: Setup Systemd Services
# =============================================================================
log_info "=== Step 8: Setup Systemd Services ==="

# Copy systemd service files from the deploy directory or create them
SYSTEMD_DIR="/etc/systemd/system"

log_info "Installing systemd service files..."

# --- Main App Service ---
cat > "${SYSTEMD_DIR}/${APP_NAME}.service" << SERVICE_EOF
[Unit]
Description=StaySuite HospitalityOS - Main Application
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/local/bin/bun run start
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
TimeoutStartSec=60
TimeoutStopSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/.next ${APP_DIR}/db ${APP_DIR}/logs ${APP_DIR}/uploads /tmp
PrivateTmp=true

# Resource limits
LimitNOFILE=65535
MemoryHigh=1G
MemoryMax=2G

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# --- Realtime WebSocket Service ---
cat > "${SYSTEMD_DIR}/${APP_NAME}-realtime.service" << SERVICE_EOF
[Unit]
Description=StaySuite HospitalityOS - Realtime WebSocket Service (port 3003)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}/mini-services/realtime-service
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/local/bin/bun --hot index.ts
Restart=on-failure
RestartSec=5
TimeoutStartSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/mini-services/realtime-service /tmp
PrivateTmp=true

# Resource limits
LimitNOFILE=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-realtime

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# --- Availability WebSocket Service ---
cat > "${SYSTEMD_DIR}/${APP_NAME}-availability.service" << SERVICE_EOF
[Unit]
Description=StaySuite HospitalityOS - Availability WebSocket Service (port 3002)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}/mini-services/availability-service
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/local/bin/bun --hot server.ts
Restart=on-failure
RestartSec=5
TimeoutStartSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/mini-services/availability-service /tmp
PrivateTmp=true

# Resource limits
LimitNOFILE=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-availability

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# --- FreeRADIUS Management Service ---
cat > "${SYSTEMD_DIR}/${APP_NAME}-freeradius.service" << SERVICE_EOF
[Unit]
Description=StaySuite HospitalityOS - FreeRADIUS Management Service (port 3010)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}/mini-services/freeradius-service
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/local/bin/bun --hot index.ts
Restart=on-failure
RestartSec=5
TimeoutStartSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/mini-services/freeradius-service /tmp
PrivateTmp=true

# Resource limits
LimitNOFILE=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-freeradius

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Reload systemd daemon
systemctl daemon-reload
log_success "Systemd service files installed."

# =============================================================================
# STEP 9: Setup SSL with Let's Encrypt
# =============================================================================
log_info "=== Step 9: Setup SSL Certificates ==="

# Temporarily start nginx for the ACME challenge (HTTP only)
# First, create a minimal HTTP-only config for the cert request
TEMP_NGINX="${NGINX_CONF_DIR}/${APP_NAME}-temp"
cat > "$TEMP_NGINX" << 'TEMP_NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name _DOMAIN_;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'StaySuite SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
TEMP_NGINX
sed -i "s/_DOMAIN_/${APP_DOMAIN}/g" "$TEMP_NGINX"

# Disable main config temporarily, enable temp config
rm -f "${NGINX_ENABLED_DIR}/${APP_NAME}"
ln -sf "$TEMP_NGINX" "${NGINX_ENABLED_DIR}/${APP_NAME}-temp"

# Create certbot directory
mkdir -p /var/www/certbot

# Start/reload nginx
nginx -t && systemctl reload nginx || systemctl start nginx

# Install certbot
log_info "Installing certbot for Let's Encrypt SSL..."
if command -v certbot &>/dev/null; then
    log_success "Certbot already installed."
else
    apt-get install -y -qq certbot python3-certbot-nginx
fi

# Request SSL certificate
log_info "Requesting SSL certificate for ${APP_DOMAIN}..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --domain "${APP_DOMAIN}" \
    --email "admin@${APP_DOMAIN}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

if [[ $? -eq 0 ]]; then
    log_success "SSL certificate obtained successfully."

    # Setup auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer
    log_success "Auto-renewal timer enabled."
else
    log_error "Failed to obtain SSL certificate."
    log_info "You may need to run: certbot certonly --nginx -d ${APP_DOMAIN}"
fi

# Restore full Nginx config with SSL
rm -f "${NGINX_ENABLED_DIR}/${APP_NAME}-temp"
rm -f "$TEMP_NGINX"
ln -sf "$NGINX_CONF" "${NGINX_ENABLED_DIR}/${APP_NAME}"

# Test and reload Nginx
nginx -t && systemctl reload nginx && log_success "Nginx reloaded with SSL." || \
    log_warn "Nginx reload failed. Check configuration."

# =============================================================================
# STEP 10: Configure Firewall (UFW)
# =============================================================================
log_info "=== Step 10: Configure Firewall ==="

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (important! Don't lock yourself out)
ufw allow ssh/tcp
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable

log_success "Firewall configured. Allowed: SSH(22), HTTP(80), HTTPS(443)"

# =============================================================================
# STEP 11: Configure Fail2Ban
# =============================================================================
log_info "=== Step 11: Configure Fail2Ban ==="

cat > /etc/fail2ban/jail.local << 'FAIL2BAN_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/${APP_NAME}_error.log
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/${APP_NAME}_error.log
maxretry = 10
bantime = 1800
FAIL2BAN_EOF

systemctl enable fail2ban
systemctl restart fail2ban
log_success "Fail2Ban configured and started."

# =============================================================================
# STEP 12: Setup Log Rotation
# =============================================================================
log_info "=== Step 12: Setup Log Rotation ==="

cat > /etc/logrotate.d/${APP_NAME} << 'LOGROTATE_EOF'
/var/log/nginx/staysuite_*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}

/opt/staysuite/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 staysuite staysuite
    copytruncate
}
LOGROTATE_EOF

log_success "Log rotation configured."

# =============================================================================
# STEP 13: Setup Automatic Security Updates
# =============================================================================
log_info "=== Step 13: Setup Automatic Security Updates ==="

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UNATTENDED_EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::SyslogEnable "true";
UNATTENDED_EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUPGRADE_EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
AUTOUPGRADE_EOF

log_success "Automatic security updates configured."

# =============================================================================
# FINAL: Summary and Next Steps
# =============================================================================
echo ""
echo "========================================================================"
log_success " StaySuite HospitalityOS - Setup Complete!"
echo "========================================================================"
echo ""
log_info "What was installed:"
echo "  - Node.js $(node -v)"
echo "  - Bun $(bun --version)"
echo "  - PostgreSQL 17"
echo "  - Nginx (reverse proxy + SSL)"
echo "  - Certbot (auto-renewing SSL)"
echo "  - UFW Firewall (SSH, HTTP, HTTPS)"
echo "  - Fail2Ban (intrusion prevention)"
echo "  - Automatic security updates"
echo ""
log_info "Services created (not yet started - deploy app first):"
echo "  - ${APP_NAME}.service          (main app on port 3000)"
echo "  - ${APP_NAME}-realtime.service (WebSocket on port 3003)"
echo "  - ${APP_NAME}-availability.service (WebSocket on port 3002)"
echo "  - ${APP_NAME}-freeradius.service (management on port 3010)"
echo ""
log_warn "NEXT STEPS:"
echo ""
echo "  1. Deploy your application code to ${APP_DIR}:"
echo "     rsync -avz ./ ${APP_USER}@$(hostname):${APP_DIR}/"
echo ""
echo "  2. Install dependencies:"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && bun install'"
echo ""
echo "  3. Build the Next.js application:"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && bun run build'"
echo ""
echo "  4. Run database migrations:"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && bunx prisma migrate deploy'"
echo ""
echo "  5. Install mini-service dependencies:"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR}/mini-services/realtime-service && bun install'"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR}/mini-services/availability-service && bun install'"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR}/mini-services/freeradius-service && bun install'"
echo ""
echo "  6. Start all services:"
echo "     systemctl start ${APP_NAME}"
echo "     systemctl start ${APP_NAME}-realtime"
echo "     systemctl start ${APP_NAME}-availability"
echo "     systemctl start ${APP_NAME}-freeradius"
echo ""
echo "  7. Enable services to start on boot:"
echo "     systemctl enable ${APP_NAME}"
echo "     systemctl enable ${APP_NAME}-realtime"
echo "     systemctl enable ${APP_NAME}-availability"
echo "     systemctl enable ${APP_NAME}-freeradius"
echo ""
echo "  8. Check service status:"
echo "     systemctl status ${APP_NAME}"
echo "     journalctl -u ${APP_NAME} -f"
echo ""
log_info "Your application should be live at: https://${APP_DOMAIN}"
echo "========================================================================"
