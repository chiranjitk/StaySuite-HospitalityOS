#!/usr/bin/env bash
# =============================================================================
# StaySuite - Rocky 10 Testing Setup Script
# =============================================================================
# Installs Node.js, Bun, PM2, clones repo, builds, and starts all services
# Usage: chmod +x setup.sh && sudo ./setup.sh
# =============================================================================

set -e

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Config ──────────────────────────────────────────────────────────────────
APP_DIR="/opt/staysuite"
REPO_URL="https://github.com/chiranjitk/StaySuite-HospitalityOS.git"
BRANCH="main"
NODE_VERSION="20"
APP_PORT=3000

# Mini-services: name|port
SERVICES=(
  "availability-service|3002"
  "realtime-service|3003"
  "freeradius-service|3010"
  "kea-service|3011"
  "dns-service|3012"
  "nftables-service|3013"
)

# ─── Check root ──────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (use sudo)"
  exit 1
fi

# Fix git safe.directory globally
git config --global --add safe.directory '*'

echo ""
echo "============================================="
echo "  StaySuite - Rocky 10 Testing Setup"
echo "============================================="
echo ""

# ─── Step 1: System Update ───────────────────────────────────────────────────
info "Step 1/9: Updating system packages..."
dnf update -y -q
success "System packages updated"

# ─── Step 2: Install dependencies ────────────────────────────────────────────
info "Step 2/9: Installing development tools..."
dnf groupinstall -y "Development Tools" -q 2>/dev/null || warn "Dev tools group may not be available"
dnf install -y -q git curl wget sqlite which procps-ng
dnf install -y -q python3 libuv-devel 2>/dev/null || true
success "Development tools installed"

# ─── Step 3: Install Node.js 20 LTS ─────────────────────────────────────────
info "Step 3/9: Installing Node.js ${NODE_VERSION}.x..."
if command -v node &>/dev/null && node -v | grep -q "v${NODE_VERSION}"; then
  success "Node.js $(node -v) already installed"
else
  curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  dnf install -y -q nodejs
  success "Node.js $(node -v) installed"
fi

# ─── Step 4: Install Bun ────────────────────────────────────────────────────
info "Step 4/9: Installing Bun..."
if command -v bun &>/dev/null; then
  success "Bun $(bun --version) already installed"
else
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun 2>/dev/null || true
  success "Bun $(bun --version) installed"
fi

# ─── Step 5: Install PM2 ────────────────────────────────────────────────────
info "Step 5/9: Installing PM2..."
if command -v pm2 &>/dev/null; then
  success "PM2 $(pm2 -v) already installed"
else
  npm install -g pm2
  success "PM2 $(pm2 -v) installed"
fi

# ─── Step 6: Clone Repository ───────────────────────────────────────────────
info "Step 6/9: Cloning StaySuite repository..."

if [ -d "$APP_DIR/.git" ]; then
  info "Repository exists, pulling latest changes..."
  cd "$APP_DIR"
  git pull origin "$BRANCH"
  success "Repository updated"
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  git checkout "$BRANCH"
  success "Repository cloned to $APP_DIR"
fi

# ─── Step 7: Install Dependencies ───────────────────────────────────────────
info "Step 7/9: Installing project dependencies..."
cd "$APP_DIR"

bun install --frozen-lockfile 2>/dev/null || bun install
success "Main app dependencies installed"

for svc_entry in "${SERVICES[@]}"; do
  IFS='|' read -r svc_name svc_port <<< "$svc_entry"
  svc_path="$APP_DIR/mini-services/$svc_name"
  if [ -d "$svc_path" ] && [ -f "$svc_path/package.json" ]; then
    info "  Installing: $svc_name"
    cd "$svc_path"
    bun install --frozen-lockfile 2>/dev/null || bun install
  else
    warn "  Skipped: $svc_name (not found)"
  fi
done
cd "$APP_DIR"
success "All dependencies installed"

# ─── Step 8: Setup Environment ───────────────────────────────────────────────
info "Step 8/9: Setting up environment..."

cd "$APP_DIR"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    success "Created .env from .env.example"
  else
    cat > .env << 'ENVEOF'
# StaySuite Environment
NEXT_PUBLIC_DEMO_MODE=true
DATABASE_URL="file:/opt/staysuite/db/custom.db"
ENVEOF
    success "Created .env with defaults"
  fi
else
  # Ensure NEXT_PUBLIC_DEMO_MODE exists in existing .env
  if ! grep -q "NEXT_PUBLIC_DEMO_MODE" .env 2>/dev/null; then
    echo 'NEXT_PUBLIC_DEMO_MODE=true' >> .env
    info "  Added NEXT_PUBLIC_DEMO_MODE=true to existing .env"
  fi
  # Ensure DATABASE_URL exists
  if ! grep -q "DATABASE_URL" .env 2>/dev/null; then
    echo 'DATABASE_URL="file:/opt/staysuite/db/custom.db"' >> .env
    info "  Added DATABASE_URL to existing .env"
  fi
  success ".env configured"
fi

mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/db"

info "  Pushing database schema..."
cd "$APP_DIR"
bun run db:push 2>/dev/null || warn "Database push skipped"

info "  Seeding demo data (users, properties, rooms, bookings)..."
cd "$APP_DIR"
bun run db:seed 2>/dev/null || warn "Database seed skipped (may need manual run)"

# ─── Step 9: Build & Start Services ─────────────────────────────────────────
info "Step 9/9: Building and starting services with PM2..."

cd "$APP_DIR"

# Stop existing StaySuite processes
pm2 delete all 2>/dev/null || true

# Create PM2 ecosystem config
cat > "$APP_DIR/ecosystem.prod.config.js" << PM2CONFIG
module.exports = {
  apps: [
    {
      name: 'staysuite-app',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '$APP_DIR',
      instances: 1,
      autorestart: true,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_DEMO_MODE: 'true',
        DATABASE_URL: 'file:/opt/staysuite/db/custom.db',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '$APP_DIR/logs/app-error.log',
      out_file: '$APP_DIR/logs/app-out.log',
    },
  ],
};
PM2CONFIG

# Build the Next.js app
info "  Building Next.js application (this may take a few minutes)..."
cd "$APP_DIR"
NODE_OPTIONS="--max-old-space-size=4096" bun run build 2>&1 | tail -5
success "  Build complete"

# Start main app
pm2 start "$APP_DIR/ecosystem.prod.config.js"

# Start mini-services
for svc_entry in "${SERVICES[@]}"; do
  IFS='|' read -r svc_name svc_port <<< "$svc_entry"
  svc_path="$APP_DIR/mini-services/$svc_name"

  if [ -d "$svc_path" ]; then
    ENTRY_FILE=""
    [ -f "$svc_path/index.ts" ] && ENTRY_FILE="index.ts"
    [ -f "$svc_path/server.ts" ] && ENTRY_FILE="server.ts"

    if [ -n "$ENTRY_FILE" ]; then
      info "  Starting: $svc_name (port $svc_port)"
      pm2 start "$svc_path/$ENTRY_FILE" \
        --name "$svc_name" \
        --interpreter bun \
        --cwd "$svc_path" \
        --no-autorestart \
        --max-memory-restart 512M \
        --error "$APP_DIR/logs/$svc_name-error.log" \
        --output "$APP_DIR/logs/$svc_name-out.log"
    else
      warn "  Skipped: $svc_name (no entry file found)"
    fi
  fi
done

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

success "All services started"

# ─── Set Hostname ───────────────────────────────────────────────────────────
info "Setting hostname to 'staysuite'..."
hostnamectl set-hostname staysuite 2>/dev/null || true
if ! grep -q "staysuite" /etc/hosts 2>/dev/null; then
  echo "127.0.0.1   staysuite" >> /etc/hosts
fi
success "Hostname set to 'staysuite'"

# ─── Firewall ───────────────────────────────────────────────────────────────
if command -v firewall-cmd &>/dev/null; then
  if systemctl is-active --quiet firewalld; then
    info "Configuring firewall..."
    firewall-cmd --permanent --add-port="$APP_PORT/tcp" 2>/dev/null || true
    for svc_entry in "${SERVICES[@]}"; do
      IFS='|' read -r svc_name svc_port <<< "$svc_entry"
      firewall-cmd --permanent --add-port="$svc_port/tcp" 2>/dev/null || true
    done
    firewall-cmd --reload -q
    success "Firewall configured"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo -e "  ${GREEN}Setup Complete!${NC}"
echo "============================================="
echo ""
echo "  App URL:       http://$(hostname -I | awk '{print $1}'):3000"
echo "  App Directory: $APP_DIR"
echo "  Log Directory: $APP_DIR/logs"
echo ""
echo "  Services running:"
pm2 list --no-color 2>/dev/null | grep -E "staysuite|availability|realtime|freeradius|kea|dns|nftables" | while read -r line; do
  echo "    $line"
done
echo ""
echo "  Useful commands:"
echo "    pm2 list                    View all services"
echo "    pm2 logs                    View logs"
echo "    pm2 logs staysuite-app      View main app logs"
echo "    pm2 restart all             Restart all services"
echo "    pm2 stop all                Stop all services"
echo "    pm2 monit                   Live monitoring"
echo ""
echo "  To edit .env:"
echo "    nano $APP_DIR/.env"
echo "    pm2 restart staysuite-app"
echo ""
echo "  To update:"
echo "    cd $APP_DIR && git pull"
echo "    bun install && bun run build"
echo "    pm2 restart all"
echo ""
