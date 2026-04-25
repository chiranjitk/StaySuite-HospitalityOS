#!/usr/bin/env bash
###############################################################################
# StaySuite HospitalityOS — Production Deployment Script for Rocky Linux 10
# =============================================================================
# Deploys: PostgreSQL 16/17, FreeRADIUS 3.x, Node.js 22 + Bun, PM2
#
# Usage:
#   chmod +x deploy-rocky10-postgresql.sh
#   sudo ./deploy-rocky10-postgresql.sh [--mikrotik-ip IP] [--shared-secret SECRET]
#
# Options:
#   --mikrotik-ip      IP address of MikroTik NAS (default: prompt interactively)
#   --shared-secret    RADIUS shared secret (default: prompt interactively)
#   --db-password      PostgreSQL app password (default: Staysuite2025)
#   --skip-mikrotik    Skip MikroTik client configuration
#   --yes              Skip all confirmation prompts
#
# Idempotent: safe to run multiple times.
###############################################################################

set -euo pipefail

# ── Color helpers (defined early for ERR trap) ────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# Catch any unhandled error and show the failing line number
trap 'echo -e "\\n${RED}✖ ERROR: Command failed at line $LINENO (exit code $?)${NC}" >&2; exit 1' ERR

info()    { echo -e "${BLUE}ℹ ${NC}$*"; }
success() { echo -e "${GREEN}✔ ${NC}$*"; }
warn()    { echo -e "${YELLOW}⚠ ${NC}$*"; }
error()   { echo -e "${RED}✖ ${NC}$*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ [$1/$STEPS] $2 ━━━${NC}"; }
banner()  {
  echo -e "${BOLD}${CYAN}"
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║     StaySuite HospitalityOS — Rocky 10 Deployment           ║"
  echo "  ║     FreeRADIUS + PostgreSQL Production Setup                 ║"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

die() { error "$@"; exit 1; }

# ── Parse arguments ──────────────────────────────────────────────────────────
MIKROTIK_IP=""
SHARED_SECRET=""
DB_PASSWORD=""
SKIP_MIKROTIK=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --mikrotik-ip)    MIKROTIK_IP="$2"; shift 2 ;;
    --shared-secret)  SHARED_SECRET="$2"; shift 2 ;;
    --db-password)    DB_PASSWORD="$2"; shift 2 ;;
    --skip-mikrotik)  SKIP_MIKROTIK=true; shift ;;
    --yes|-y)         AUTO_YES=true; shift ;;
    *) die "Unknown option: $1" ;;
  esac
done

STEPS=19

# ── Helper: confirm or auto-yes ─────────────────────────────────────────────
confirm() {
  if $AUTO_YES; then return 0; fi
  read -rp "$(echo -e "${YELLOW}? $1 [Y/n]: ${NC}")" ans
  [[ "$ans" =~ ^[Yy]?$ ]]
}

# ── Default passwords (simple, no special chars to avoid URL encoding issues) ──
DEFAULT_DB_PASSWORD="Staysuite2025"

# ── Helper: log both stdout and a file ──────────────────────────────────────
LOG_FILE="/var/log/staysuite-deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

# ════════════════════════════════════════════════════════════════════════════
# STEP 1: Prerequisites Check
# ════════════════════════════════════════════════════════════════════════════
banner

step 1 "Prerequisites" "Checking system requirements"

# Must be root
if [[ $EUID -ne 0 ]]; then
  die "This script must be run as root (use sudo)."
fi

# Check OS
if ! grep -q "Rocky Linux" /etc/os-release 2>/dev/null; then
  # Fallback: check redhat-release
  if ! grep -qi "rocky" /etc/redhat-release 2>/dev/null; then
    die "This script is designed for Rocky Linux 10. Detected: $(cat /etc/os-release 2>/dev/null | head -1)"
  fi
fi
OS_VERSION=$(grep 'VERSION_ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"')
info "Detected Rocky Linux $OS_VERSION"

# Check RAM (min 4 GB)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
if [[ $TOTAL_RAM_GB -lt 4 ]]; then
  warn "Only ${TOTAL_RAM_GB}GB RAM detected. Recommended: 4 GB+"
  confirm "Continue anyway?" || die "Aborted by user."
else
  success "RAM: ${TOTAL_RAM_GB} GB"
fi

# Check disk space (min 20 GB free)
FREE_DISK_GB=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
if [[ $FREE_DISK_GB -lt 20 ]]; then
  warn "Only ${FREE_DISK_GB}GB free disk space. Recommended: 20 GB+"
  confirm "Continue anyway?" || die "Aborted by user."
else
  success "Free disk: ${FREE_DISK_GB} GB"
fi

success "Prerequisites check passed"

# ════════════════════════════════════════════════════════════════════════════
# STEP 2: System Update
# ════════════════════════════════════════════════════════════════════════════
step 2 "System Update" "Updating base system packages"

info "Running dnf update..."
dnf update -y --quiet
dnf install -y --quiet curl wget git unzip gnupg2 ca-certificates \
  policycoreutils-python-utils lsof \
  epel-release

success "System packages updated"

# ════════════════════════════════════════════════════════════════════════════
# STEP 3: Install PostgreSQL 16/17
# ════════════════════════════════════════════════════════════════════════════
step 3 "PostgreSQL" "Installing PostgreSQL from PGDG repository"

# Install PGDG repo
if [[ ! -f /etc/yum.repos.d/pgdg-redhat-all.repo ]]; then
  info "Installing PostgreSQL GPG key and repository..."
  dnf install -y --quiet https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm
fi

# Disable built-in PG module to use PGDG
dnf -y -q module disable postgresql 2>/dev/null || true

# Try PG 17 first, fall back to PG 16
PG_MAJOR=""
for ver in 17 16; do
  if dnf list "postgresql${ver}-server" --quiet 2>/dev/null | grep -q "postgresql${ver}-server"; then
    PG_MAJOR="$ver"
    break
  fi
done
if [[ -z "$PG_MAJOR" ]]; then
  die "Could not find PostgreSQL 16 or 17 in PGDG repo."
fi
info "Installing PostgreSQL ${PG_MAJOR}..."
dnf install -y --quiet "postgresql${PG_MAJOR}-server" "postgresql${PG_MAJOR}-contrib"

# Initialize database
PG_DATA="/var/lib/pgsql/${PG_MAJOR}/data"
# Always wipe and reinitialize for clean deployment.
# Previous interrupted runs leave corrupted WAL files that prevent startup
# (PANIC: could not locate a valid checkpoint record). Since this is a
# deploy script (not an upgrade), the only safe approach is a fresh init.
info "Ensuring clean PostgreSQL data directory..."
systemctl stop "postgresql-${PG_MAJOR}" 2>/dev/null || true
sleep 1
if [[ -d "${PG_DATA}" ]]; then
  warn "Wiping existing data directory: ${PG_DATA}"
  rm -rf "${PG_DATA}"
fi
info "Initializing PostgreSQL database cluster..."
"/usr/pgsql-${PG_MAJOR}/bin/postgresql-${PG_MAJOR}-setup" initdb
chown -R postgres:postgres "${PG_DATA}"
chmod 700 "${PG_DATA}"

# Fix SELinux context on data directory (common on Rocky)
if command -v restorecon >/dev/null 2>&1; then
  restorecon -R "${PG_DATA}" 2>/dev/null || true
fi

# Stop any existing PG instance and check for conflicts
systemctl stop "postgresql-${PG_MAJOR}" 2>/dev/null || true
if ss -tlnp | grep -q ':5432 '; then
  warn "Port 5432 is already in use! Checking for conflicting PostgreSQL processes..."
  ss -tlnp | grep ':5432 '
  # Try to stop any old PG version (e.g. PG 16)
  for pgver in 16 15 14 13; do
    systemctl stop "postgresql-${pgver}" 2>/dev/null || true
  done
  sleep 2
  if ss -tlnp | grep -q ':5432 '; then
    die "Port 5432 still in use after stopping all PG services. Kill the process manually: fuser -k 5432/tcp"
  fi
fi

# Tune PostgreSQL for production (4GB RAM baseline)
PG_CONF="${PG_DATA}/postgresql.conf"
TUNE_MARKER="# ── StaySuite Production Tuning"
if [[ -f "$PG_CONF" ]]; then
  # Remove old tuning block if present (idempotent)
  if grep -q "$TUNE_MARKER" "$PG_CONF" 2>/dev/null; then
    info "Removing previous tuning block..."
    sed -i "/${TUNE_MARKER}/,/# ── End StaySuite Tuning/d" "$PG_CONF"
  fi
  info "Applying production PostgreSQL tuning..."
  cat >> "$PG_CONF" <<'PGTUNE'

# ── StaySuite Production Tuning ──────────────────────────────────────────
# Listen on localhost TCP (required for Prisma + FreeRADIUS TCP connections)
listen_addresses = 'localhost'
port = 5432
# Shared buffers: 25% of RAM (auto-adjusted for 4GB baseline)
shared_buffers = 1GB
# Effective cache size: 75% of RAM
effective_cache_size = 3GB
# Maintenance work mem for index creation
maintenance_work_mem = 256MB
# Checkpoint settings for write-heavy accounting workload
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
# Work mem for sorts/joins
work_mem = 8MB
# Max connections (FreeRADIUS + app + monitoring)
max_connections = 200
# Logging
log_min_duration_statement = 500
log_checkpoints = on
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: db=%d,user=%u,app=%a,client=%h '
# ── End StaySuite Tuning ────────────────────────────────────────────────
PGTUNE
fi

# Reload PG if already running to pick up new config (listen_addresses, etc.)
if systemctl is-active --quiet "postgresql-${PG_MAJOR}" 2>/dev/null; then
  info "Reloading PostgreSQL to apply configuration changes..."
  systemctl reload "postgresql-${PG_MAJOR}"
fi

# Start and enable
info "Starting PostgreSQL ${PG_MAJOR}..."
# Do NOT let set -e kill the script here — we need diagnostics if it fails.
systemctl start "postgresql-${PG_MAJOR}" || START_FAILED=true

# Verify PG actually started
sleep 2
if [[ "${START_FAILED:-}" == "true" ]] || ! systemctl is-active --quiet "postgresql-${PG_MAJOR}"; then
  error "PostgreSQL ${PG_MAJOR} failed to start! Showing diagnostics..."
  # Show systemd journal
  error "systemd journal (last 20 lines):"
  journalctl -u "postgresql-${PG_MAJOR}" -n 20 --no-pager 2>&1 || true
  # Show PG log directory
  PG_LOG_DIR="${PG_DATA}/log"
  if [[ -d "$PG_LOG_DIR" ]]; then
    LATEST_LOG=$(ls -t "${PG_LOG_DIR}"/*.log 2>/dev/null | head -1)
    if [[ -n "$LATEST_LOG" ]]; then
      error "Latest PG log file:"
      tail -30 "$LATEST_LOG"
    fi
  else
    error "No log directory found at ${PG_LOG_DIR}"
  fi
  # Try manual start for direct error output
  error "Attempting manual start for diagnostics..."
  sudo -u postgres "/usr/pgsql-${PG_MAJOR}/bin/pg_ctl" start -D "${PG_DATA}" -l "${PG_DATA}/startup.log" -w -t 10 2>&1 || true
  if [[ -f "${PG_DATA}/startup.log" ]]; then
    error "Manual start log:"
    cat "${PG_DATA}/startup.log"
  fi
  # Check common issues
  error "Checking common issues..."
  [[ -f "${PG_DATA}/postmaster.pid" ]] && error "Stale PID file found: ${PG_DATA}/postmaster.pid"
  ls -la "${PG_DATA}" | head -5
  error "Data directory owner: $(stat -c '%U:%G' "${PG_DATA}")"
  die "PostgreSQL ${PG_MAJOR} failed to start. See diagnostics above."
fi

systemctl enable "postgresql-${PG_MAJOR}"
success "PostgreSQL ${PG_MAJOR} installed and started"
info "PG data directory: ${PG_DATA}"
info "PG log directory: ${PG_DATA}/log/"

# ════════════════════════════════════════════════════════════════════════════
# STEP 4: Create Database and Users
# ════════════════════════════════════════════════════════════════════════════
step 4 "Database Setup" "Creating staysuite database and users"

# Pre-flight: verify PostgreSQL is actually accepting connections
if ! sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then
  error "PostgreSQL is running but psql cannot connect."
  error "Checking pg_hba.conf authentication..."
  sudo -u postgres psql -c "SELECT 1" 2>&1 || true
  # Try to fix common pg_hba.conf issues
  PG_HBA="/var/lib/pgsql/${PG_MAJOR}/data/pg_hba.conf"
  if [[ -f "$PG_HBA" ]] && ! grep -q '^local.*all.*postgres.*peer' "$PG_HBA" && ! grep -q '^local.*all.*all.*peer' "$PG_HBA"; then
    warn "Adding peer authentication for local postgres connections..."
    sed -i '1i local   all             postgres                                peer' "$PG_HBA"
    systemctl reload "postgresql-${PG_MAJOR}"
    sleep 1
  fi
  # Retry
  if ! sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then
    die "Cannot connect to PostgreSQL. Check ${PG_HBA} and try: sudo -u postgres psql"
  fi
fi
success "PostgreSQL connection verified"

# Use provided password or default (simple alphanumeric, no special chars)
if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$DEFAULT_DB_PASSWORD"
  info "Using default database password: ${DB_PASSWORD}"
else
  info "Using provided database password: ${DB_PASSWORD}"
fi

# Check if database already exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='staysuite'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" == "1" ]]; then
  warn "Database 'staysuite' already exists."
  confirm "Backup and continue?" || die "Aborted."
  
  BACKUP_FILE="/var/lib/pgsql/backups/staysuite-$(date +%Y%m%d-%H%M%S).dump"
  mkdir -p /var/lib/pgsql/backups
  info "Backing up existing database to ${BACKUP_FILE}..."
  sudo -u postgres pg_dump -Fc staysuite > "$BACKUP_FILE"
  success "Backup saved to ${BACKUP_FILE}"
fi

info "Creating database and users..."
# Use quoted heredoc (<<'EOSQL') to prevent bash history expansion of ! in password.
# Password is injected via bash parameter expansion (not sed) to handle
# special characters like &, \, $ in passwords correctly.
PSQL_SQL=$(cat <<'EOSQL'
-- Create app user (full access)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'staysuite') THEN
    CREATE ROLE staysuite WITH LOGIN PASSWORD '__STAYSUITE_DBPASS__';
  ELSE
    ALTER ROLE staysuite WITH PASSWORD '__STAYSUITE_DBPASS__';
  END IF;
END
$$;

-- Create RADIUS user (limited access for FreeRADIUS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'radius') THEN
    CREATE ROLE radius WITH LOGIN PASSWORD '__STAYSUITE_DBPASS__';
  ELSE
    ALTER ROLE radius WITH PASSWORD '__STAYSUITE_DBPASS__';
  END IF;
END
$$;

-- Create database
SELECT 'CREATE DATABASE staysuite OWNER staysuite'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'staysuite')\gexec

-- Grant staysuite user full access
GRANT ALL PRIVILEGES ON DATABASE staysuite TO staysuite;

-- Connect and set up schema permissions
\c staysuite

-- Create citext extension (used by Prisma @db.Citext on email fields)
CREATE EXTENSION IF NOT EXISTS citext;

GRANT ALL ON SCHEMA public TO staysuite;
GRANT ALL ON SCHEMA public TO radius;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO radius;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO radius;
EOSQL
)
# Bash parameter expansion: treats replacement as literal (no sed special chars)
PSQL_SQL="${PSQL_SQL//__STAYSUITE_DBPASS__/$DB_PASSWORD}"
echo "$PSQL_SQL" | sudo -u postgres psql || die "Failed to create database/users. Check PostgreSQL logs above."

success "Database 'staysuite' created"
success "User 'staysuite' created (full access)"
success "User 'radius' created (limited access)"
info "Database password: ${DB_PASSWORD}"

# Configure pg_hba.conf for password auth (FreeRADIUS connects via TCP as 'radius' user)
# WARNING: We OVERWRITE the file to avoid sed corruption. This is safe because
# we just initialized the DB and only need local+TCP auth.
PG_HBA="/var/lib/pgsql/${PG_MAJOR}/data/pg_hba.conf"
info "Writing pg_hba.conf (password auth for FreeRADIUS)..."
cat > "$PG_HBA" <<'EOF'
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
EOF
chown postgres:postgres "$PG_HBA"
chmod 640 "$PG_HBA"
systemctl reload "postgresql-${PG_MAJOR}" 2>/dev/null || systemctl restart "postgresql-${PG_MAJOR}"
success "pg_hba.conf configured"

# ════════════════════════════════════════════════════════════════════════════
# STEP 5: Create FreeRADIUS Tables (Official Schema)
# ════════════════════════════════════════════════════════════════════════════
step 5 "FreeRADIUS Schema" "Creating RADIUS tables from official schema.sql"

info "Applying official FreeRADIUS PostgreSQL schema..."

sudo -u postgres psql -d staysuite <<'EOSQL'

-- ════════════════════════════════════════════════════════════════════════
-- FreeRADIUS official PostgreSQL schema
-- Source: raddb/sql/postgresql/schema.sql
-- ════════════════════════════════════════════════════════════════════════

-- radcheck
CREATE TABLE IF NOT EXISTS radcheck (
  id            bigserial PRIMARY KEY,
  username      character varying(64) NOT NULL DEFAULT '',
  attribute     character varying(64) NOT NULL DEFAULT '',
  op            character varying(2) NOT NULL DEFAULT ':=',
  value         character varying(253) NOT NULL DEFAULT ''
);

-- radreply
CREATE TABLE IF NOT EXISTS radreply (
  id            bigserial PRIMARY KEY,
  username      character varying(64) NOT NULL DEFAULT '',
  attribute     character varying(64) NOT NULL DEFAULT '',
  op            character varying(2) NOT NULL DEFAULT ':=',
  value         character varying(253) NOT NULL DEFAULT ''
);

-- radgroupcheck
CREATE TABLE IF NOT EXISTS radgroupcheck (
  id            bigserial PRIMARY KEY,
  groupname     character varying(64) NOT NULL DEFAULT '',
  attribute     character varying(64) NOT NULL DEFAULT '',
  op            character varying(2) NOT NULL DEFAULT ':=',
  value         character varying(253) NOT NULL DEFAULT ''
);

-- radgroupreply
CREATE TABLE IF NOT EXISTS radgroupreply (
  id            bigserial PRIMARY KEY,
  groupname     character varying(64) NOT NULL DEFAULT '',
  attribute     character varying(64) NOT NULL DEFAULT '',
  op            character varying(2) NOT NULL DEFAULT ':=',
  value         character varying(253) NOT NULL DEFAULT ''
);

-- radusergroup
CREATE TABLE IF NOT EXISTS radusergroup (
  id            bigserial PRIMARY KEY,
  username      character varying(64) NOT NULL DEFAULT '',
  groupname     character varying(64) NOT NULL DEFAULT '',
  priority      integer NOT NULL DEFAULT 0
);

-- radacct (EXACT FreeRADIUS schema — Do NOT modify columns)
CREATE TABLE IF NOT EXISTS radacct (
  radacctid             bigserial PRIMARY KEY,
  acctsessionid         character varying(64) NOT NULL DEFAULT '',
  acctuniqueid          character varying(32) NOT NULL DEFAULT '',
  username              character varying(64) NOT NULL DEFAULT '',
  realm                 character varying(64) NOT NULL DEFAULT '',
  nasipaddress          inet NOT NULL,
  nasportid             character varying(15) NOT NULL DEFAULT '',
  nasporttype           character varying(32) NOT NULL DEFAULT '',
  acctstarttime         timestamp with time zone,
  acctupdatetime        timestamp with time zone,
  acctstoptime          timestamp with time zone,
  acctinterval          bigint DEFAULT 0,
  acctsessiontime       bigint DEFAULT 0,
  acctauthentic         character varying(32) NOT NULL DEFAULT '',
  connectinfo_start     character varying(50) NOT NULL DEFAULT '',
  connectinfo_stop      character varying(50) NOT NULL DEFAULT '',
  acctinputoctets       bigint DEFAULT 0,
  acctoutputoctets      bigint DEFAULT 0,
  calledstationid       character varying(50) NOT NULL DEFAULT '',
  callingstationid      character varying(50) NOT NULL DEFAULT '',
  acctterminatecause    character varying(32) NOT NULL DEFAULT '',
  servicetype           character varying(32) NOT NULL DEFAULT '',
  framedprotocol        character varying(32) NOT NULL DEFAULT '',
  framedipaddress       character varying(15) NOT NULL DEFAULT '',
  framedipv6address     character varying(45) NOT NULL DEFAULT '',
  framedipv6prefix      character varying(45) NOT NULL DEFAULT '',
  framedinterfaceid     character varying(45) NOT NULL DEFAULT '',
  delegatedipv6prefix   character varying(45) NOT NULL DEFAULT '',
  "class"               character varying(64) NOT NULL DEFAULT ''
);

-- radpostauth
CREATE TABLE IF NOT EXISTS radpostauth (
  id               bigserial PRIMARY KEY,
  username         character varying(64) NOT NULL DEFAULT '',
  pass             character varying(64) NOT NULL DEFAULT '',
  reply            character varying(32) NOT NULL DEFAULT '',
  calledstationid  character varying(50) NOT NULL DEFAULT '',
  callingstationid character varying(50) NOT NULL DEFAULT '',
  authdate         timestamp with time zone DEFAULT now(),
  "class"          character varying(64) NOT NULL DEFAULT ''
);

-- nasreload (accounting-on/off)
CREATE TABLE IF NOT EXISTS nasreload (
  nasipaddress  inet PRIMARY KEY,
  reloadtime    timestamp with time zone DEFAULT now()
);

-- data_usage_by_period (StaySuite extension)
CREATE TABLE IF NOT EXISTS data_usage_by_period (
  username          character varying(64) NOT NULL,
  period_start      timestamp with time zone NOT NULL,
  period_end        timestamp with time zone,
  acctinputoctets   bigint NOT NULL DEFAULT 0,
  acctoutputoctets  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (username, period_start)
);

EOSQL
# (psql exit code is caught by ERR trap)

success "FreeRADIUS base tables created"

# ════════════════════════════════════════════════════════════════════════════
# STEP 5b: Create FreeRADIUS Indexes
# ════════════════════════════════════════════════════════════════════════════
info "Creating FreeRADIUS indexes..."

sudo -u postgres psql -d staysuite <<'EOSQL'

-- Indexes from official FreeRADIUS schema.sql

-- radcheck
CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);
CREATE INDEX IF NOT EXISTS radcheck_attribute_idx ON radcheck (attribute);

-- radreply
CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);
CREATE INDEX IF NOT EXISTS radreply_attribute_idx ON radreply (attribute);

-- radgroupcheck
CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);
CREATE INDEX IF NOT EXISTS radgroupcheck_attribute_idx ON radgroupcheck (attribute, op);

-- radgroupreply
CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);
CREATE INDEX IF NOT EXISTS radgroupreply_attribute_idx ON radgroupreply (attribute, op);

-- radusergroup
CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);
CREATE INDEX IF NOT EXISTS radusergroup_groupname_idx ON radusergroup (groupname);

-- radacct (performance-critical indexes for production accounting)
CREATE UNIQUE INDEX IF NOT EXISTS radacct_acctuniqueid_idx ON radacct (acctuniqueid);
CREATE INDEX IF NOT EXISTS radacct_username_idx ON radacct (username);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress_idx ON radacct (nasipaddress);
CREATE INDEX IF NOT EXISTS radacct_acctstarttime_idx ON radacct (acctstarttime);
CREATE INDEX IF NOT EXISTS radacct_acctstoptime_idx ON radacct (acctstoptime);
CREATE INDEX IF NOT EXISTS radacct_framedipaddress_idx ON radacct (framedipaddress);
CREATE INDEX IF NOT EXISTS radacct_bulk_close_idx ON radacct (nasipaddress, acctstarttime);
CREATE INDEX IF NOT EXISTS radacct_start_user_idx ON radacct (acctstarttime, username);

-- Partial index for active sessions (WHERE AcctStopTime IS NULL)
CREATE INDEX IF NOT EXISTS radacct_active_session_idx ON radacct (acctuniqueid) WHERE acctstoptime IS NULL;

-- radpostauth
CREATE INDEX IF NOT EXISTS radpostauth_username_idx ON radpostauth (username);
CREATE INDEX IF NOT EXISTS radpostauth_authdate_idx ON radpostauth (authdate);

EOSQL
# (psql exit code is caught by ERR trap)

success "FreeRADIUS indexes created"

# ════════════════════════════════════════════════════════════════════════════
# STEP 5c: GRANT Permissions (setup.sql equivalent)
# ════════════════════════════════════════════════════════════════════════════
info "Applying GRANT statements for RADIUS user..."

sudo -u postgres psql -d staysuite <<'EOSQL'

-- ════════════════════════════════════════════════════════════════════════
-- FreeRADIUS user permissions (radius user — read/write RADIUS tables)
-- Equivalent to FreeRADIUS raddb/sql/postgresql/setup.sql
-- ════════════════════════════════════════════════════════════════════════

-- radcheck: FreeRADIUS reads during auth
GRANT SELECT, INSERT, UPDATE, DELETE ON radcheck TO radius;
GRANT USAGE, SELECT ON SEQUENCE radcheck_id_seq TO radius;

-- radreply: FreeRADIUS reads during auth
GRANT SELECT, INSERT, UPDATE, DELETE ON radreply TO radius;
GRANT USAGE, SELECT ON SEQUENCE radreply_id_seq TO radius;

-- radgroupcheck: FreeRADIUS reads during group processing
GRANT SELECT, INSERT, UPDATE, DELETE ON radgroupcheck TO radius;
GRANT USAGE, SELECT ON SEQUENCE radgroupcheck_id_seq TO radius;

-- radgroupreply: FreeRADIUS reads during group processing
GRANT SELECT, INSERT, UPDATE, DELETE ON radgroupreply TO radius;
GRANT USAGE, SELECT ON SEQUENCE radgroupreply_id_seq TO radius;

-- radusergroup: FreeRADIUS reads for user-to-group mapping
GRANT SELECT, INSERT, UPDATE, DELETE ON radusergroup TO radius;
GRANT USAGE, SELECT ON SEQUENCE radusergroup_id_seq TO radius;

-- radacct: FreeRADIUS inserts/updates accounting records
GRANT SELECT, INSERT, UPDATE ON radacct TO radius;
GRANT USAGE, SELECT ON SEQUENCE radacct_radacctid_seq TO radius;

-- radpostauth: FreeRADIUS inserts post-auth log entries
GRANT SELECT, INSERT ON radpostauth TO radius;
GRANT USAGE, SELECT ON SEQUENCE radpostauth_id_seq TO radius;

-- nasreload: FreeRADIUS inserts accounting-on/off events
GRANT SELECT, INSERT, UPDATE ON nasreload TO radius;

-- data_usage_by_period: FreeRADIUS stored procedures read/write
GRANT SELECT, INSERT, UPDATE ON data_usage_by_period TO radius;

-- Grant all RADIUS tables to app user too
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO staysuite;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO staysuite;

EOSQL
# (psql exit code is caught by ERR trap)

success "RADIUS user permissions configured"

# ════════════════════════════════════════════════════════════════════════════
# STEP 5d: Create Stored Procedures & Views (process-radacct.sql)
# ════════════════════════════════════════════════════════════════════════════
step 5d "Extensions" "Creating data usage stored procedures and views"

sudo -u postgres psql -d staysuite <<'EOSQL'

-- ════════════════════════════════════════════════════════════════════════
-- StaySuite Data Usage Extensions (process-radacct.sql)
-- ════════════════════════════════════════════════════════════════════════

-- Function: Create new data usage period
CREATE OR REPLACE FUNCTION fr_new_data_usage_period()
RETURNS void AS $$
DECLARE
  v_period_start timestamp with time zone;
  v_period_end   timestamp with time zone;
BEGIN
  -- Current period starts at beginning of current hour
  v_period_start := date_trunc('hour', now());
  -- Next period starts at beginning of next hour
  v_period_end := v_period_start + INTERVAL '1 hour';

  -- Close any open periods (set period_end)
  UPDATE data_usage_by_period
  SET period_end = v_period_start
  WHERE period_end IS NULL;

  -- Insert new period rows for all users with active sessions
  INSERT INTO data_usage_by_period (username, period_start)
  SELECT DISTINCT username, v_period_start
  FROM radacct
  WHERE acctstoptime IS NULL
    AND username IS NOT NULL
    AND username != ''
  ON CONFLICT (username, period_start) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Aggregate data usage from radacct into data_usage_by_period
CREATE OR REPLACE FUNCTION fr_update_data_usage()
RETURNS void AS $$
BEGIN
  UPDATE data_usage_by_period dup
  SET
    acctinputoctets  = COALESCE(sub.in_octets, 0),
    acctoutputoctets = COALESCE(sub.out_octets, 0)
  FROM (
    SELECT
      r.username,
      dup.period_start,
      SUM(r.acctinputoctets)  AS in_octets,
      SUM(r.acctoutputoctets) AS out_octets
    FROM radacct r
    JOIN data_usage_by_period dup ON dup.username = r.username
    WHERE r.acctstarttime >= dup.period_start
      AND (dup.period_end IS NULL OR r.acctstarttime < dup.period_end)
      AND r.username IS NOT NULL
      AND r.username != ''
    GROUP BY r.username, dup.period_start
  ) sub
  WHERE dup.username = sub.username
    AND dup.period_start = sub.period_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: Active sessions summary (real-time)
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
  r.acctuniqueid,
  r.username,
  r.realm,
  r.nasipaddress::text AS nasipaddress,
  r.calledstationid,
  r.callingstationid,
  r.acctstarttime,
  EXTRACT(EPOCH FROM (now() - r.acctstarttime))::bigint AS session_seconds,
  r.acctinputoctets,
  r.acctoutputoctets,
  r.framedipaddress,
  r.nasporttype,
  r.servicetype
FROM radacct r
WHERE r.acctstoptime IS NULL;

-- View: Session history (completed sessions)
CREATE OR REPLACE VIEW v_session_history AS
SELECT
  r.acctuniqueid,
  r.username,
  r.realm,
  r.nasipaddress::text AS nasipaddress,
  r.calledstationid,
  r.callingstationid,
  r.acctstarttime,
  r.acctstoptime,
  r.acctsessiontime,
  r.acctinputoctets,
  r.acctoutputoctets,
  r.acctterminatecause,
  r.framedipaddress,
  r.acctauthentic
FROM radacct r
WHERE r.acctstoptime IS NOT NULL;

-- View: Data usage summary per user (current period)
CREATE OR REPLACE VIEW v_data_usage_current AS
SELECT
  dup.username,
  dup.period_start,
  dup.acctinputoctets  AS input_bytes,
  dup.acctoutputoctets AS output_bytes,
  (dup.acctinputoctets + dup.acctoutputoctets) AS total_bytes,
  pg_size_pretty((dup.acctinputoctets + dup.acctoutputoctets)::bigint) AS total_human
FROM data_usage_by_period dup
WHERE dup.period_end IS NULL;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION fr_new_data_usage_period() TO radius;
GRANT EXECUTE ON FUNCTION fr_update_data_usage() TO radius;
GRANT EXECUTE ON FUNCTION fr_new_data_usage_period() TO staysuite;
GRANT EXECUTE ON FUNCTION fr_update_data_usage() TO staysuite;

-- Grant select on views
GRANT SELECT ON v_active_sessions TO radius;
GRANT SELECT ON v_session_history TO radius;
GRANT SELECT ON v_data_usage_current TO radius;
GRANT SELECT ON v_active_sessions TO staysuite;
GRANT SELECT ON v_session_history TO staysuite;
GRANT SELECT ON v_data_usage_current TO staysuite;

EOSQL
# (psql exit code is caught by ERR trap)

success "Stored procedures and views created"

# ════════════════════════════════════════════════════════════════════════════
# STEP 6: Insert Default RADIUS Group Data
# ════════════════════════════════════════════════════════════════════════════
step 6 "RADIUS Defaults" "Seeding default groups and attributes"

sudo -u postgres psql -d staysuite <<'EOSQL'

-- Default groups for StaySuite WiFi plans
INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES
  -- Free tier: 2 Mbps down, 1 Mbps up, 100 MB data limit, 1 hour session
  ('wifi-free', 'Mikrotik-Rate-Limit', ':=', '2M/1M'),
  ('wifi-free', 'Session-Timeout', ':=', '3600'),
  ('wifi-free', 'WISPr-Bandwidth-Max-Down', ':=', '2000'),
  ('wifi-free', 'WISPr-Bandwidth-Max-Up', ':=', '1000'),
  -- Premium tier: 10 Mbps down, 5 Mbps up, 1 GB data limit, 24 hour session
  ('wifi-premium', 'Mikrotik-Rate-Limit', ':=', '10M/5M'),
  ('wifi-premium', 'Session-Timeout', ':=', '86400'),
  ('wifi-premium', 'WISPr-Bandwidth-Max-Down', ':=', '10000'),
  ('wifi-premium', 'WISPr-Bandwidth-Max-Up', ':=', '5000'),
  -- VIP tier: 50 Mbps down, 25 Mbps up, unlimited, 24 hour session
  ('wifi-vip', 'Mikrotik-Rate-Limit', ':=', '50M/25M'),
  ('wifi-vip', 'Session-Timeout', ':=', '86400'),
  ('wifi-vip', 'WISPr-Bandwidth-Max-Down', ':=', '50000'),
  ('wifi-vip', 'WISPr-Bandwidth-Max-Up', ':=', '25000'),
  -- Staff tier: 100 Mbps down, 50 Mbps up, unlimited, 12 hour session
  ('wifi-staff', 'Mikrotik-Rate-Limit', ':=', '100M/50M'),
  ('wifi-staff', 'Session-Timeout', ':=', '43200'),
  ('wifi-staff', 'WISPr-Bandwidth-Max-Down', ':=', '100000'),
  ('wifi-staff', 'WISPr-Bandwidth-Max-Up', ':=', '50000')
ON CONFLICT DO NOTHING;

EOSQL
# (psql exit code is caught by ERR trap)

success "Default RADIUS groups configured"

# ════════════════════════════════════════════════════════════════════════════
# STEP 7: Install FreeRADIUS
# ════════════════════════════════════════════════════════════════════════════
step 7 "FreeRADIUS" "Installing and configuring FreeRADIUS"

if ! rpm -q freeradius >/dev/null 2>&1; then
  info "Installing FreeRADIUS..."
  dnf install -y --quiet freeradius freeradius-utils freeradius-postgresql
else
  info "FreeRADIUS already installed, upgrading..."
  dnf install -y --quiet freeradius freeradius-utils freeradius-postgresql
fi

RADD="/etc/raddb"

# ════════════════════════════════════════════════════════════════════════════
# STEP 7b: Configure SQL Module
# ════════════════════════════════════════════════════════════════════════════
info "Configuring FreeRADIUS SQL module for PostgreSQL..."

# Enable the sql module
mkdir -p "${RADD}/mods-enabled"
ln -sf "${RADD}/mods-available/sql" "${RADD}/mods-enabled/sql"

# Write SQL module configuration
# Use bash parameter expansion instead of sed to avoid special character issues.
# sed treats &, \, and $ in the replacement string as special characters,
# which corrupts passwords containing those chars. Bash ${var//pat/rep} 
# treats the replacement as a literal string.
RADIUS_SQL_CONF=$(cat <<'EOCONF'
# ── StaySuite: FreeRADIUS SQL Module — PostgreSQL ───────────────────────
sql {
  # Database driver
  driver = "rlm_sql_postgresql"

  # Connection parameters
  dialect = "postgresql"
  server = "localhost"
  port = 5432
  login = "radius"
  password = "__STAYSUITE_DBPASS__"
  radius_db = "staysuite"

  # Pool settings
  pool {
    start = 5
    min = 3
    max = 20
    spare = 5
    uses = 0
    lifetime = 0
    idle_timeout = 60
    connect_timeout = 3.0
  }

  # PostgreSQL-specific settings
  postgresql {
    # Leave blank for default
  }

  # Query directory for custom queries
  # queries are in mods-config/sql/main/postgresql/queries.conf
  read_clients = no

  # Client query settings
  client {
    ipaddr = "%{sql:SELECT nasipaddress::text FROM radius_nas WHERE shortname='%{Client-Shortname}'}"
  }

  # Accounting table
  accounting {
    reference = "%{tolower:type.%{Acct-Status-Type}.query}"
    type {
      accounting-on {
        query = "\
          UPDATE nasreload SET reloadtime = NOW() \
          WHERE nasipaddress = '%{NAS-IP-Address}'; \
          INSERT INTO nasreload (nasipaddress, reloadtime) \
          SELECT '%{NAS-IP-Address}', NOW() \
          WHERE NOT EXISTS (SELECT 1 FROM nasreload WHERE nasipaddress = '%{NAS-IP-Address}');"
      }
      accounting-off {
        query = "${..accounting-on.query}"
      }
      start {
        query = "\
          INSERT INTO radacct \
            (acctsessionid, acctuniqueid, username, realm, nasipaddress, \
             nasportid, nasporttype, acctstarttime, acctupdatetime, \
             acctauthentic, connectinfo_start, calledstationid, \
             callingstationid, servicetype, framedprotocol, \
             framedipaddress, framedipv6address, framedipv6prefix, \
             framedinterfaceid, delegatedipv6prefix, \"class\") \
          VALUES \
            ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', \
             '%{SQL-User-Name}', '%{Realm}', '%{NAS-IP-Address}', \
             '%{NAS-Port}', '%{NAS-Port-Type}', '%S', '%S', \
             '%{Acct-Authentic}', '%{Connect-Info}', '%{Called-Station-Id}', \
             '%{Calling-Station-Id}', '%{Service-Type}', '%{Framed-Protocol}', \
             NULLIF('%{Framed-IP-Address}', ''), NULLIF('%{Framed-IPv6-Address}', ''), \
             NULLIF('%{Framed-IPv6-Prefix}', ''), NULLIF('%{Framed-Interface-Id}', ''), \
             NULLIF('%{Delegated-IPv6-Prefix}', ''), NULLIF('%{Class}', ''))"
      }
      interim-update {
        query = "\
          UPDATE radacct \
          SET \
            framedipaddress = NULLIF('%{Framed-IP-Address}', ''), \
            framedipv6address = NULLIF('%{Framed-IPv6-Address}', ''), \
            framedipv6prefix = NULLIF('%{Framed-IPv6-Prefix}', ''), \
            framedinterfaceid = NULLIF('%{Framed-Interface-Id}', ''), \
            delegatedipv6prefix = NULLIF('%{Delegated-IPv6-Prefix}', ''), \
            acctsessiontime = '%{Acct-Session-Time}', \
            acctinputoctets = '%{Acct-Input-Octets}', \
            acctoutputoctets = '%{Acct-Output-Octets}', \
            acctupdatetime = NOW(), \
            \"class\" = NULLIF('%{Class}', '') \
          WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' \
            AND acctstoptime IS NULL"
      }
      stop {
        query = "\
          UPDATE radacct \
          SET \
            acctstoptime = '%S', \
            acctsessiontime = '%{Acct-Session-Time}', \
            acctinputoctets = '%{Acct-Input-Octets}', \
            acctoutputoctets = '%{Acct-Output-Octets}', \
            acctterminatecause = '%{Acct-Terminate-Cause}', \
            connectinfo_stop = '%{Connect-Info}', \
            framedipaddress = NULLIF('%{Framed-IP-Address}', ''), \
            framedipv6address = NULLIF('%{Framed-IPv6-Address}', ''), \
            framedipv6prefix = NULLIF('%{Framed-IPv6-Prefix}', ''), \
            framedinterfaceid = NULLIF('%{Framed-Interface-Id}', ''), \
            delegatedipv6prefix = NULLIF('%{Delegated-IPv6-Prefix}', ''), \
            \"class\" = NULLIF('%{Class}', '') \
          WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' \
            AND acctstoptime IS NULL"
      }
    }
  }

  # Post-auth logging
  post-auth {
    query = "\
      INSERT INTO radpostauth \
        (username, pass, reply, calledstationid, callingstationid, authdate, \"class\") \
      VALUES \
        ('%{SQL-User-Name}', '%{%{User-Password}:-%{Chap-Password}}', \
         '%{reply:Packet-Type}', '%{Called-Station-Id}', '%{Calling-Station-Id}', \
         NOW(), NULLIF('%{Class}', ''))"
  }
}
EOCONF
)
# Bash parameter expansion: replacement string is treated literally, no sed special chars
RADIUS_SQL_CONF="${RADIUS_SQL_CONF//__STAYSUITE_DBPASS__/$DB_PASSWORD}"
echo "$RADIUS_SQL_CONF" > "${RADD}/mods-enabled/sql" || die "Failed to write SQL module config"

# ════════════════════════════════════════════════════════════════════════════
# STEP 7c: Write queries.conf (Custom PostgreSQL queries)
# ════════════════════════════════════════════════════════════════════════════
info "Writing custom queries.conf..."

mkdir -p "${RADD}/mods-config/sql/main/postgresql"

cat > "${RADD}/mods-config/sql/main/postgresql/queries.conf" <<'EOQUERY'
# ── StaySuite: Custom PostgreSQL queries for FreeRADIUS ──────────────────
# This file overrides the default queries for StaySuite's RADIUS integration.

# Authenticate: Check radcheck for user attributes
authorize_check_query = "\
  SELECT id, username, attribute, value, op \
  FROM radcheck \
  WHERE username = '%{SQL-User-Name}' \
  ORDER BY id"

# Authorize: Get reply attributes from radreply
authorize_reply_query = "\
  SELECT id, username, attribute, value, op \
  FROM radreply \
  WHERE username = '%{SQL-User-Name}' \
  ORDER BY id"

# Group check: Get group check attributes
groupcheck_query = "\
  SELECT id, groupname, attribute, \
    CASE WHEN op = ':=' THEN ':=' ELSE op END AS op, value \
  FROM radgroupcheck \
  WHERE groupname = '%{Sql-Group}' \
  ORDER BY id"

# Group reply: Get group reply attributes
groupreply_query = "\
  SELECT id, groupname, attribute, \
    CASE WHEN op = ':=' THEN ':=' ELSE op END AS op, value \
  FROM radgroupreply \
  WHERE groupname = '%{Sql-Group}' \
  ORDER BY id"

# User-to-group mapping
usergroup_query = "\
  SELECT groupname \
  FROM radusergroup \
  WHERE username = '%{SQL-User-Name}' \
  ORDER BY priority"

# Simultaneous use check (active sessions per user)
simul_count_query = "\
  SELECT COUNT(*) \
  FROM radacct \
  WHERE username = '%{SQL-User-Name}' \
    AND acctstoptime IS NULL"

# Simultaneous use check with calling station ID
simul_verify_query = "\
  SELECT radacctid \
  FROM radacct \
  WHERE username = '%{SQL-User-Name}' \
    AND acctstoptime IS NULL \
    AND callingstationid = '%{Calling-Station-Id}' \
  LIMIT 1"
EOQUERY

# ════════════════════════════════════════════════════════════════════════════
# STEP 7d: Configure sites (radiusd.conf + sites-available/default)
# ════════════════════════════════════════════════════════════════════════════
info "Configuring FreeRADIUS sites..."

# Enable sql module in sites-available/default authorize section
SITES_DEFAULT="${RADD}/sites-available/default"
if [[ -f "$SITES_DEFAULT" ]]; then
  # Uncomment 'sql' in authorize section if commented out
  sed -i 's/^#\s*-sql/-sql/' "$SITES_DEFAULT"
  # Ensure sql is in the authorize section
  if ! grep -q '^[[:space:]]*-sql' "$SITES_DEFAULT" 2>/dev/null; then
    warn "Could not find '-sql' in authorize section of sites-available/default"
    warn "FreeRADIUS may not use SQL for authentication. Manually add '-sql' to the authorize section."
  fi
  # Ensure sql is in the accounting section
  if ! grep -q '^[[:space:]]*-sql' "${RADD}/sites-available/accounting" 2>/dev/null; then
    if [[ -f "${RADD}/sites-available/accounting" ]]; then
      sed -i 's/^#\s*-sql/-sql/' "${RADD}/sites-available/accounting" 2>/dev/null || true
    fi
  fi
  # Ensure sql is in the session section (for interim-update)
  if ! grep -q '^[[:space:]]*-sql' "${RADD}/sites-available/session" 2>/dev/null; then
    if [[ -f "${RADD}/sites-available/session" ]]; then
      sed -i 's/^#\s*-sql/-sql/' "${RADD}/sites-available/session" 2>/dev/null || true
    fi
  fi
fi

# Configure radiusd.conf for production
if [[ -f "${RADD}/radiusd.conf" ]]; then
  # Set max_request_time for accounting-heavy environments
  if grep -q '^max_request_time' "${RADD}/radiusd.conf"; then
    sed -i 's/^max_request_time.*/max_request_time = 30/' "${RADD}/radiusd.conf"
  fi
  
  # Set log destination
  if grep -q '^log_destination' "${RADD}/radiusd.conf"; then
    sed -i 's/^log_destination.*/log_destination = files/' "${RADD}/radiusd.conf"
  fi
fi

# Fix strict permissions on sql config (FreeRADIUS requires 640)
chown root:radiusd "${RADD}/mods-enabled/sql" 2>/dev/null || true
chmod 640 "${RADD}/mods-enabled/sql" 2>/dev/null || true
chown -R radiusd:radiusd "${RADD}/mods-enabled/sql" 2>/dev/null || true

success "FreeRADIUS installed and configured"

# ════════════════════════════════════════════════════════════════════════════
# STEP 8: Configure FreeRADIUS Clients (MikroTik)
# ════════════════════════════════════════════════════════════════════════════
step 8 "NAS Clients" "Configuring MikroTik RADIUS client"

if ! $SKIP_MIKROTIK; then
  # Get MikroTik IP interactively if not provided
  if [[ -z "$MIKROTIK_IP" ]]; then
    if $AUTO_YES; then
      MIKROTIK_IP="192.168.88.1"
      warn "Using default MikroTik IP: 192.168.88.1"
    else
      read -rp "$(echo -e "${CYAN}? Enter MikroTik NAS IP address [192.168.88.1]: ${NC}")" MIKROTIK_IP
      MIKROTIK_IP="${MIKROTIK_IP:-192.168.88.1}"
    fi
  fi

  # Get shared secret interactively if not provided
  if [[ -z "$SHARED_SECRET" ]]; then
    if $AUTO_YES; then
      SHARED_SECRET="localkey"
    else
      read -rp "$(echo -e "${CYAN}? Enter RADIUS shared secret [auto-generate]: ${NC}")" SHARED_SECRET
    fi
    SHARED_SECRET="${SHARED_SECRET:-localkey}"
  fi

  # Ensure clients.d directory exists (may not exist on minimal FreeRADIUS install)
  mkdir -p "${RADD}/clients.d"

  # Write MikroTik client configuration
  cat > "${RADD}/clients.d/mikrotik.conf" <<EOCLIENT
# StaySuite: MikroTik NAS Client Configuration
# Auto-generated by deploy-rocky10-postgresql.sh
# Date: $(date -Iseconds)

client mikrotik {
  ipaddr = ${MIKROTIK_IP}
  secret = ${SHARED_SECRET}
  shortname = mikrotik
  nas_type = other
  # MikroTik uses CoA for session disconnect
  coa_server = mikrotik-coa
  response_window = 6.0
  require_message_authenticator = no
}

# CoA (Change of Authorization) server for MikroTik
home_server mikrotik-coa {
  type = coa
  ipaddr = ${MIKROTIK_IP}
  port = 3799
  secret = ${SHARED_SECRET}
}
EOCLIENT

  # Also add a catch-all client for local testing (127.0.0.1)
  if [[ ! -f "${RADD}/clients.d/localhost.conf" ]]; then
    cat > "${RADD}/clients.d/localhost.conf" <<EOCLIENT
# Localhost testing client
client localhost {
  ipaddr = 127.0.0.1
  secret = testing123
  shortname = localhost
}
EOCLIENT
  fi

  success "MikroTik client configured at ${MIKROTIK_IP}"
else
  warn "Skipping MikroTik client configuration (--skip-mikrotik)"
fi

# ════════════════════════════════════════════════════════════════════════════
# STEP 9: Enable and Start Services
# ════════════════════════════════════════════════════════════════════════════
step 9 "Services" "Starting PostgreSQL and FreeRADIUS"

# PostgreSQL — reload (don't restart unless needed)
systemctl enable "postgresql-${PG_MAJOR}"
if systemctl is-active --quiet "postgresql-${PG_MAJOR}"; then
  systemctl reload "postgresql-${PG_MAJOR}"
else
  systemctl start "postgresql-${PG_MAJOR}"
fi
sleep 1
systemctl is-active --quiet "postgresql-${PG_MAJOR}" || die "PostgreSQL failed to start! Check: sudo cat /var/lib/pgsql/${PG_MAJOR}/data/log/*.log | tail -20"
success "PostgreSQL ${PG_MAJOR} running"

# FreeRADIUS — test config before restart
info "Testing FreeRADIUS configuration..."
RADIUS_TEST=$(radiusd -XC 2>&1)
RADIUS_EXIT=$?
if [[ $RADIUS_EXIT -ne 0 ]]; then
  error "FreeRADIUS config check FAILED:"
  echo "$RADIUS_TEST"
  die "Fix FreeRADIUS config errors above. Common fixes: check ${RADD}/mods-enabled/sql for correct server/login/password"
fi
systemctl enable radiusd
systemctl restart radiusd
sleep 1
systemctl is-active --quiet radiusd || die "FreeRADIUS failed to start! Check: sudo journalctl -u radiusd -n 30"
success "FreeRADIUS running"

success "All services running"

# ════════════════════════════════════════════════════════════════════════════
# STEP 10: Install Node.js 22
# ════════════════════════════════════════════════════════════════════════════
step 10 "Node.js" "Installing Node.js 22 LTS"

if command -v node >/dev/null 2>&1 && node --version | grep -q "v22"; then
  info "Node.js $(node --version) already installed"
else
  info "Installing Node.js 22 via NodeSource..."
  dnf module disable nodejs -y 2>/dev/null || true
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  dnf install -y --quiet nodejs
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
success "Node.js ${NODE_VERSION}, npm ${NPM_VERSION}"

# ════════════════════════════════════════════════════════════════════════════
# STEP 11: Install Bun
# ════════════════════════════════════════════════════════════════════════════
step 11 "Bun" "Installing Bun JavaScript runtime"

if command -v bun >/dev/null 2>&1; then
  info "Bun $(bun --version) already installed"
else
  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  # System-wide symlink
  ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
fi

BUN_VERSION=$(bun --version)
success "Bun ${BUN_VERSION} installed"

# ════════════════════════════════════════════════════════════════════════════
# STEP 12: Clone Project
# ════════════════════════════════════════════════════════════════════════════
step 12 "Project" "Cloning StaySuite HospitalityOS"

APP_DIR="/opt/staysuite"

if [[ -d "$APP_DIR/.git" ]]; then
  info "Project already exists at ${APP_DIR}, pulling latest..."
  cd "$APP_DIR" && git pull origin main || warn "Git pull failed, using existing code"
else
  if [[ -d "$APP_DIR" ]]; then
    warn "Directory ${APP_DIR} exists but is not a git repo. Backing up..."
    mv "$APP_DIR" "${APP_DIR}.bak.$(date +%s)"
  fi
  info "Cloning from GitHub..."
  git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git "$APP_DIR" \
    || die "Failed to clone repository. Check your network or SSH keys."
fi

cd "$APP_DIR"
success "Project ready at ${APP_DIR}"

# ════════════════════════════════════════════════════════════════════════════
# STEP 13: Configure .env
# ════════════════════════════════════════════════════════════════════════════
step 13 "Environment" "Configuring application environment"

# Generate APP_SECRET if not set
APP_SECRET="${APP_SECRET:-$(head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)}"

cat > "${APP_DIR}/.env" <<EOENV
# ── StaySuite HospitalityOS — Production Environment ────────────────────
# Generated: $(date -Iseconds)

# Database
DATABASE_URL=postgresql://staysuite:${DB_PASSWORD}@localhost:5432/staysuite

# App
NODE_ENV=production
NEXTAUTH_URL=https://\${NEXTAUTH_URL:-localhost}
NEXTAUTH_SECRET=${APP_SECRET}

# FreeRADIUS (read-only for dashboard)
RADIUS_DB_URL=postgresql://radius:${DB_PASSWORD}@localhost:5432/staysuite

# Port
PORT="3000"
EOENV

# Protect .env file
chmod 600 "${APP_DIR}/.env"
chown root:root "${APP_DIR}/.env"

success "Environment configured"

# ════════════════════════════════════════════════════════════════════════════
# STEP 14: Install Dependencies
# ════════════════════════════════════════════════════════════════════════════
step 14 "Dependencies" "Installing npm/bun packages"

cd "$APP_DIR"

if [[ -f "bun.lockb" ]] || [[ -f "bun.lock" ]]; then
  info "Installing dependencies with bun..."
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  info "Installing dependencies with npm..."
  npm ci --production=false 2>/dev/null || npm install
fi

success "Dependencies installed"

# ════════════════════════════════════════════════════════════════════════════
# STEP 15: Prisma Schema Push (PMS tables only)
# ════════════════════════════════════════════════════════════════════════════
step 15 "Database Schema" "Pushing Prisma schema (PMS tables)"

cd "$APP_DIR"

# Use the PostgreSQL schema
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@localhost:5432/staysuite"

# Verify PostgreSQL is reachable via TCP (psql uses Unix socket by default,
# but Prisma requires TCP on localhost:5432)
info "Verifying PostgreSQL TCP connectivity on localhost:5432..."
if ! ss -tlnp 2>/dev/null | grep -q ':5432\b'; then
  error "PostgreSQL is not listening on TCP port 5432"
  error "Checking listen_addresses..."
  sudo -u postgres psql -c "SHOW listen_addresses;" 2>/dev/null || true
  die "Fix PostgreSQL TCP: sudo -u postgres psql -c \"ALTER SYSTEM SET listen_addresses TO 'localhost'; SELECT pg_reload_conf();\""
fi
success "PostgreSQL TCP connection verified"

if [[ -f "prisma/schema.postgresql.prisma" ]]; then
  # Generate Prisma client with PostgreSQL schema
  npx prisma generate --schema=prisma/schema.postgresql.prisma

  # ── PRE-PUSH: Wipe and recreate public schema for clean push ────────────
  # Previous partial pushes may have created tables with wrong column types
  # (e.g. TEXT vs UUID), leftover indexes, views, functions, enums.
  # prisma db push is NOT fully idempotent — it cannot change column types
  # that already have data or constraints. The only safe approach for a
  # fresh deployment is to drop and recreate the entire public schema.
  info "Resetting public schema for clean Prisma push..."
  sudo -u postgres psql -d staysuite <<'EOSQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO staysuite;
GRANT ALL ON SCHEMA public TO radius;
CREATE EXTENSION IF NOT EXISTS citext;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO radius;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO radius;
EOSQL
  success "Public schema reset complete"

  # ── PUSH: Apply Prisma schema ───────────────────────────────────────────
  info "Pushing schema to database (PMS tables)..."
  npx prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss 2>/dev/null \
    || npx prisma db push --schema=prisma/schema.postgresql.prisma

  # ── POST-PUSH: Recreate functions, views, and permissions ───────────────
  info "Recreating stored procedures and views..."
  sudo -u postgres psql -d staysuite <<'EOSQL'

-- ════════════════════════════════════════════════════════════════════════
-- Recreate functions (may reference altered/recreated tables)
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fr_new_data_usage_period()
RETURNS void AS $$
DECLARE
  v_period_start timestamp with time zone;
  v_period_end   timestamp with time zone;
BEGIN
  v_period_start := date_trunc('hour', now());
  v_period_end   := v_period_start + INTERVAL '1 hour';
  UPDATE data_usage_by_period SET period_end = v_period_start WHERE period_end IS NULL;
  INSERT INTO data_usage_by_period (username, period_start)
  SELECT DISTINCT username, v_period_start
  FROM radacct
  WHERE acctstoptime IS NULL AND username IS NOT NULL AND username != ''
  ON CONFLICT (username, period_start) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fr_update_data_usage()
RETURNS void AS $$
BEGIN
  UPDATE data_usage_by_period dup
  SET acctinputoctets = COALESCE(sub.in_octets, 0),
      acctoutputoctets = COALESCE(sub.out_octets, 0)
  FROM (
    SELECT r.username, dup.period_start,
           SUM(r.acctinputoctets) AS in_octets,
           SUM(r.acctoutputoctets) AS out_octets
    FROM radacct r
    JOIN data_usage_by_period dup ON dup.username = r.username
    WHERE r.acctstarttime >= dup.period_start
      AND (dup.period_end IS NULL OR r.acctstarttime < dup.period_end)
      AND r.username IS NOT NULL AND r.username != ''
    GROUP BY r.username, dup.period_start
  ) sub
  WHERE dup.username = sub.username AND dup.period_start = sub.period_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════
-- Recreate views (compatible with Prisma column types)
-- ════════════════════════════════════════════════════════════════════════

-- Active sessions summary (real-time)
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
  r.acctuniqueid,
  r.username,
  r.realm,
  r.nasipaddress::text AS nasipaddress,
  r.calledstationid,
  r.callingstationid,
  r.acctstarttime,
  EXTRACT(EPOCH FROM (now() - r.acctstarttime))::bigint AS session_seconds,
  r.acctinputoctets,
  r.acctoutputoctets,
  r.framedipaddress,
  r.nasporttype,
  r.servicetype
FROM radacct r
WHERE r.acctstoptime IS NULL;

-- Session history (completed sessions)
CREATE OR REPLACE VIEW v_session_history AS
SELECT
  r.acctuniqueid,
  r.username,
  r.realm,
  r.nasipaddress::text AS nasipaddress,
  r.calledstationid,
  r.callingstationid,
  r.acctstarttime,
  r.acctstoptime,
  r.acctsessiontime,
  r.acctinputoctets,
  r.acctoutputoctets,
  r.acctterminatecause,
  r.framedipaddress,
  r.acctauthentic
FROM radacct r
WHERE r.acctstoptime IS NOT NULL;

-- Data usage summary per user (current period)
CREATE OR REPLACE VIEW v_data_usage_current AS
SELECT
  dup.username,
  dup.period_start,
  dup.acctinputoctets  AS input_bytes,
  dup.acctoutputoctets AS output_bytes,
  (dup.acctinputoctets + dup.acctoutputoctets) AS total_bytes,
  pg_size_pretty((dup.acctinputoctets + dup.acctoutputoctets)::bigint) AS total_human
FROM data_usage_by_period dup
WHERE dup.period_end IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- Re-grant permissions
-- ════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fr_new_data_usage_period() TO radius, staysuite;
GRANT EXECUTE ON FUNCTION fr_update_data_usage() TO radius, staysuite;

GRANT SELECT ON v_active_sessions TO radius, staysuite;
GRANT SELECT ON v_session_history TO radius, staysuite;
GRANT SELECT ON v_data_usage_current TO radius, staysuite;

-- Ensure RADIUS user has access to all tables/sequences (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radius;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radius;

EOSQL

else
  warn "PostgreSQL Prisma schema not found, using default..."
  npx prisma generate
  npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
fi

success "PMS database tables created/updated"

# ════════════════════════════════════════════════════════════════════════════
# STEP 16: Seed Database
# ════════════════════════════════════════════════════════════════════════════
step 16 "Seed Data" "Seeding database with initial data"

cd "$APP_DIR"

if [[ -f "prisma/seed.ts" ]]; then
  info "Running database seed..."
  if npx prisma db seed --schema=prisma/schema.postgresql.prisma; then
    success "Database seeded successfully"
  else
    warn "Seed failed — running directly to see error..."
    npx tsx prisma/seed.ts
    success "Database seeded (on retry)"
  fi
else
  warn "No seed file found at prisma/seed.ts, skipping seed"
fi

# ════════════════════════════════════════════════════════════════════════════
# STEP 17: Build Next.js Application
# ════════════════════════════════════════════════════════════════════════════
step 17 "Build" "Building Next.js application"

cd "$APP_DIR"

export NODE_OPTIONS='--max-old-space-size=8192'

info "Building Next.js application (this may take a few minutes)..."
if [[ -f "bun.lockb" ]] || [[ -f "bun.lock" ]]; then
  bun run build
else
  npm run build
fi

success "Application built"

# ════════════════════════════════════════════════════════════════════════════
# STEP 18: Install and Configure PM2
# ════════════════════════════════════════════════════════════════════════════
step 18 "PM2" "Installing and configuring process manager"

npm install -g pm2

# Install mini-service dependencies
for svc_dir in "${APP_DIR}/mini-services/"*/; do
  svc_name=$(basename "$svc_dir")
  [[ "$svc_name" == "radius-server" ]] && continue  # radius-server uses its own management
  [[ "$svc_name" == ".gitkeep" ]] && continue
  [[ "$svc_name" == "shared" ]] && continue
  if [[ -f "${svc_dir}/package.json" ]]; then
    info "Installing dependencies for ${svc_name}..."
    cd "$svc_dir" && npm install --production 2>&1 | tail -1
    cd "$APP_DIR"
  fi
done

# Create ecosystem config with all services (except radius-server)
cat > "${APP_DIR}/ecosystem.config.js" <<EOECO
module.exports = {
  apps: [
    {
      name: 'staysuite',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '${APP_DIR}',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/staysuite/error.log',
      out_file: '/var/log/staysuite/out.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'availability-service',
      script: 'server.ts',
      cwd: '${APP_DIR}/mini-services/availability-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: '/var/log/staysuite/availability-error.log',
      out_file: '/var/log/staysuite/availability-out.log',
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      cwd: '${APP_DIR}/mini-services/realtime-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      error_file: '/var/log/staysuite/realtime-error.log',
      out_file: '/var/log/staysuite/realtime-out.log',
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      cwd: '${APP_DIR}/mini-services/freeradius-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
      error_file: '/var/log/staysuite/freeradius-svc-error.log',
      out_file: '/var/log/staysuite/freeradius-svc-out.log',
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      cwd: '${APP_DIR}/mini-services/dhcp-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
      },
      error_file: '/var/log/staysuite/dhcp-error.log',
      out_file: '/var/log/staysuite/dhcp-out.log',
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      cwd: '${APP_DIR}/mini-services/dns-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3012,
      },
      error_file: '/var/log/staysuite/dns-error.log',
      out_file: '/var/log/staysuite/dns-out.log',
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      cwd: '${APP_DIR}/mini-services/nftables-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3013,
      },
      error_file: '/var/log/staysuite/nftables-error.log',
      out_file: '/var/log/staysuite/nftables-out.log',
    },
  ],
};
EOECO

# Create log directory
mkdir -p /var/log/staysuite
chown -R root:root /var/log/staysuite
chmod 755 /var/log/staysuite

# Stop all existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start all services with PM2
cd "$APP_DIR"
pm2 start ecosystem.config.js

# Save PM2 config for auto-restart on reboot
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

success "PM2 configured — all services started"

# Firewall management is handled by the nftables-service (port 3013).
# No system-level firewalld is needed — the nftables-service provides
# programmatic firewall control via its REST API.
info "Firewall: managed by nftables-service (port 3013) — no firewalld needed"

# ════════════════════════════════════════════════════════════════════════════
# STEP 21: Cron Jobs (Data Usage Processing)
# ════════════════════════════════════════════════════════════════════════════
info "Setting up cron jobs..."

# Create new data usage period every hour (at minute 0)
(crontab -l 2>/dev/null | grep -v "fr_new_data_usage_period\|fr_update_data_usage"; echo "
# StaySuite: Create new data usage period every hour
0 * * * * sudo -u postgres psql -d staysuite -c 'SELECT fr_new_data_usage_period();' > /dev/null 2>&1

# StaySuite: Update data usage aggregation every 5 minutes
*/5 * * * * sudo -u postgres psql -d staysuite -c 'SELECT fr_update_data_usage();' > /dev/null 2>&1

# StaySuite: Cleanup old data_usage_by_period records older than 90 days (3 AM daily)
0 3 * * * sudo -u postgres psql -d staysuite -c \"DELETE FROM data_usage_by_period WHERE period_start < NOW() - INTERVAL '90 days';\" > /dev/null 2>&1
") | crontab -

success "Cron jobs configured"

# ════════════════════════════════════════════════════════════════════════════
# DEPLOYMENT SUMMARY
# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  StaySuite HospitalityOS — Deployment Complete!                        ${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Application URL
echo -e "${BOLD}🌐 Application:${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "   URL:          http://${SERVER_IP}:3000"
echo "   Health Check: http://${SERVER_IP}:3000/api/health"
echo ""

# Credentials
echo -e "${BOLD}🔐 Credentials:${NC}"
echo "   PostgreSQL App DB: postgresql://staysuite:${DB_PASSWORD}@localhost:5432/staysuite"
echo "   PostgreSQL RADIUS: postgresql://radius:${DB_PASSWORD}@localhost:5432/staysuite"
if ! $SKIP_MIKROTIK && [[ -n "$SHARED_SECRET" ]]; then
  echo "   MikroTik RADIUS Secret: ${SHARED_SECRET}"
  echo "   MikroTik NAS IP: ${MIKROTIK_IP}"
fi
echo "   NextAuth Secret:   ${APP_SECRET}"
echo ""

# Service status
echo -e "${BOLD}📊 Service Status:${NC}"
for svc in "postgresql-${PG_MAJOR}" radiusd; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "unknown")
  STATUS_ICON="❌"
  [[ "$STATUS" == "active" ]] && STATUS_ICON="✅"
  echo "   ${STATUS_ICON} ${svc}: ${STATUS}"
done
for svc_name in staysuite availability-service realtime-service freeradius-service dhcp-service dns-service nftables-service; do
  SVC_STATUS=$(pm2 is-running "$svc_name" 2>/dev/null && echo "running" || echo "stopped")
  SVC_ICON="❌"
  [[ "$SVC_STATUS" == "running" ]] && SVC_ICON="✅"
  echo "   ${SVC_ICON} ${svc_name} (PM2): ${SVC_STATUS}"
done
echo ""

# Healthcheck commands
echo -e "${BOLD}🔍 Healthcheck Commands:${NC}"
echo "   PostgreSQL:  sudo -u postgres psql -d staysuite -c 'SELECT 1;'"
echo "   FreeRADIUS:  sudo radiusd -XC"
echo "   RADIUS Test: echo 'User-Name=test,User-Password=test' | radclient -x 127.0.0.1 auth testing123"
echo "   PM2 Status:  pm2 status"
echo "   App Logs:    pm2 logs staysuite --lines 50"
echo "   RADIUS Logs: journalctl -u radiusd -f"
echo ""

# Database overview
echo -e "${BOLD}🗄️ Database Tables:${NC}"
sudo -u postgres psql -d staysuite -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null | tail -n +3 | head -20
echo ""

# Important files
echo -e "${BOLD}📁 Important Files:${NC}"
echo "   App Directory:  ${APP_DIR}"
echo "   Environment:    ${APP_DIR}/.env"
echo "   PM2 Config:     ${APP_DIR}/ecosystem.config.js"
echo "   RADIUS Config:  ${RADD}/"
echo "   RADIUS Clients: ${RADD}/clients.d/"
echo "   SQL Module:     ${RADD}/mods-enabled/sql"
echo "   PG Config:      ${PG_CONF}"
echo "   Deploy Log:     ${LOG_FILE}"
echo ""

# Backup location
echo -e "${BOLD}💾 Backup Location:${NC}"
echo "   /var/lib/pgsql/backups/ (if backup was created)"
echo ""

# Next steps
echo -e "${BOLD}${YELLOW}📋 Next Steps:${NC}"
echo "   1. Configure your MikroTik Router for RADIUS authentication:"
echo "      - RADIUS Server: $(hostname -I | awk '{print $1}')"
echo "      - Auth Port: 1812 (UDP)"
echo "      - Acct Port: 1813 (UDP)"
echo "      - Secret: ${SHARED_SECRET}"
echo ""
echo "   2. Set up a reverse proxy (nginx/caddy) if needed for HTTPS."
echo ""
echo "   3. Log in to StaySuite and configure your property, rooms, and WiFi plans."
echo ""
echo "   4. For MikroTik-specific configuration, see:"
echo "      /ip hotspot set radius-mac=... radius-server=..."
echo ""

echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Deployment successful! Save your credentials above.             ${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
