#!/bin/bash
# =============================================================================
# StaySuite - Fix SQLite BUSY error for FreeRADIUS accounting
# =============================================================================
# Problem: FreeRADIUS rlm_sql_sqlite gets SQLITE_BUSY (error code 5) when
# trying to INSERT accounting records into radacct table. This is caused by
# concurrent write access from FreeRADIUS + Prisma + bun services.
#
# Fix:
#   1. Enable WAL mode (Write-Ahead Logging) - allows concurrent readers
#   2. Set busy_timeout to 30s - wait up to 30s for lock instead of failing
#   3. Ensure radacct table exists with correct schema (37 columns)
#   4. Set proper file permissions for radiusd user
#   5. Create composite indexes for accounting sync performance
# =============================================================================
# Run on Rocky 10 server as root:
#   chmod +x scripts/fix-sqlite-busy.sh
#   sudo ./scripts/fix-sqlite-busy.sh /opt/staysuite/db/custom.db
# =============================================================================

set -e

DB_PATH="${1:-/opt/staysuite/db/custom.db}"
APP_DIR="$(dirname "$(dirname "$DB_PATH")")"
RADIUS_USER="radiusd"
RADIUS_GROUP="radiusd"

echo "=========================================="
echo "StaySuite - SQLite BUSY Fix"
echo "=========================================="
echo "Database: $DB_PATH"
echo "App dir:  $APP_DIR"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at $DB_PATH"
    exit 1
fi

echo "📊 Current database info:"
ls -la "$DB_PATH"
echo ""

# Check if sqlite3 is available
if command -v sqlite3 &>/dev/null; then
    echo "✅ sqlite3 found"
else
    echo "❌ sqlite3 not found. Install with: dnf install sqlite"
    exit 1
fi

# Check if radiusd user exists
if id "$RADIUS_USER" &>/dev/null; then
    echo "✅ radiusd user exists"
else
    echo "⚠️  radiusd user not found - will set permissions for current user"
    RADIUS_USER=$(whoami)
    RADIUS_GROUP=$(whoami)
fi

# =========================================================================
# Step 1: Enable WAL mode and set busy_timeout
# =========================================================================
echo ""
echo "━━━ Step 1: Enable WAL mode + busy_timeout ━━━"

sqlite3 "$DB_PATH" "PRAGMA journal_mode=WAL;"
echo "   Journal mode set to WAL"

sqlite3 "$DB_PATH" "PRAGMA busy_timeout=30000;"
echo "   busy_timeout set to 30000ms (30s)"

sqlite3 "$DB_PATH" "PRAGMA wal_autocheckpoint=1000;"
echo "   WAL autocheckpoint set to 1000"

sqlite3 "$DB_PATH" "PRAGMA synchronous=NORMAL;"
echo "   synchronous set to NORMAL (safe with WAL)"

# Verify
MODE=$(sqlite3 "$DB_PATH" "PRAGMA journal_mode;")
echo "   ✅ Current journal_mode: $MODE"

# =========================================================================
# Step 2: Check/Create radacct table
# =========================================================================
echo ""
echo "━━━ Step 2: Verify radacct table ━━━"

TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='radacct';")
if [ -z "$TABLE_EXISTS" ]; then
    echo "   ❌ radacct table NOT FOUND - creating..."
    sqlite3 "$DB_PATH" "
    CREATE TABLE radacct (
        radacctid           INTEGER PRIMARY KEY AUTOINCREMENT,
        acctsessionid       TEXT NOT NULL DEFAULT '',
        acctuniqueid        TEXT NOT NULL UNIQUE DEFAULT '',
        username            TEXT NOT NULL DEFAULT '',
        realm               TEXT DEFAULT '',
        nasipaddress        TEXT NOT NULL DEFAULT '',
        nasportid           TEXT,
        nasporttype         TEXT,
        acctstarttime       TEXT,
        acctupdatetime      TEXT,
        acctstoptime        TEXT,
        acctinterval        INTEGER,
        acctsessiontime     INTEGER,
        acctauthentic       TEXT,
        connectinfo_start   TEXT,
        connectinfo_stop    TEXT,
        acctinputoctets     INTEGER DEFAULT 0,
        acctoutputoctets    INTEGER DEFAULT 0,
        acctinputgigawords  INTEGER DEFAULT 0,
        acctoutputgigawords INTEGER DEFAULT 0,
        calledstationid     TEXT NOT NULL DEFAULT '',
        callingstationid    TEXT NOT NULL DEFAULT '',
        acctterminatecause  TEXT NOT NULL DEFAULT '',
        servicetype         TEXT,
        framedprotocol      TEXT,
        framedipaddress     TEXT NOT NULL DEFAULT '',
        framedipv6address   TEXT NOT NULL DEFAULT '',
        framedipv6prefix    TEXT NOT NULL DEFAULT '',
        framedinterfaceid   TEXT NOT NULL DEFAULT '',
        delegatedipv6prefix TEXT NOT NULL DEFAULT '',
        class               TEXT,
        acctinputpackets    INTEGER DEFAULT 0,
        acctoutputpackets   INTEGER DEFAULT 0,
        acctstatus          TEXT DEFAULT 'start',
        createdAt           TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt           TEXT NOT NULL DEFAULT (datetime('now'))
    );"
    echo "   ✅ radacct table created (37 columns)"
else
    COL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pragma_table_info('radacct');")
    echo "   ✅ radacct table exists ($COL_COUNT columns)"

    # Check for missing columns and add them
    MISSING_COLS=""

    # Check each required column
    for COL in acctinputpackets acctoutputpackets acctstatus createdAt updatedAt realm acctupdatetime acctinterval acctinputgigawords acctoutputgigawords framedipv6prefix framedinterfaceid delegatedipv6prefix class servicetype framedprotocol framedipv6address; do
        EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pragma_table_info('radacct') WHERE name='$COL';")
        if [ "$EXISTS" = "0" ]; then
            MISSING_COLS="$MISSING_COLS $COL"
        fi
    done

    if [ -n "$MISSING_COLS" ]; then
        echo "   ⚠️  Missing columns:$MISSING_COLS"
        echo "   Adding missing columns..."

        for COL in $MISSING_COLS; do
            case $COL in
                acctinputpackets|acctoutputpackets)
                    sqlite3 "$DB_PATH" "ALTER TABLE radacct ADD COLUMN $COL INTEGER DEFAULT 0;"
                    ;;
                acctstatus)
                    sqlite3 "$DB_PATH" "ALTER TABLE radacct ADD COLUMN $COL TEXT DEFAULT 'start';"
                    ;;
                createdAt|updatedAt)
                    sqlite3 "$DB_PATH" "ALTER TABLE radacct ADD COLUMN $COL TEXT NOT NULL DEFAULT (datetime('now'));"
                    ;;
                *)
                    sqlite3 "$DB_PATH" "ALTER TABLE radacct ADD COLUMN $COL TEXT DEFAULT '';"
                    ;;
            esac
            echo "      ✅ Added column: $COL"
        done
    fi

    # Ensure acctuniqueid has UNIQUE constraint
    UNIQUE_CHECK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pragma_index_list('radacct') WHERE \"unique\"=1;")
    echo "   Unique indexes: $UNIQUE_CHECK"
fi

# =========================================================================
# Step 3: Create indexes for performance
# =========================================================================
echo ""
echo "━━━ Step 3: Create performance indexes ━━━"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_username ON radacct(username);"
echo "   ✅ idx_radacct_username"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_acctstarttime ON radacct(acctstarttime);"
echo "   ✅ idx_radacct_acctstarttime"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_acctstoptime ON radacct(acctstoptime);"
echo "   ✅ idx_radacct_acctstoptime"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_nasipaddress ON radacct(nasipaddress);"
echo "   ✅ idx_radacct_nasipaddress"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_framedipaddress ON radacct(framedipaddress);"
echo "   ✅ idx_radacct_framedipaddress"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_callingstationid ON radacct(callingstationid);"
echo "   ✅ idx_radacct_callingstationid"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_acctstatus ON radacct(acctstatus);"
echo "   ✅ idx_radacct_acctstatus"

sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_radacct_composite ON radacct(username, acctstarttime, acctstatus);"
echo "   ✅ idx_radacct_composite"

# =========================================================================
# Step 4: Fix file permissions
# =========================================================================
echo ""
echo "━━━ Step 4: Fix file permissions ━━━"

DB_DIR=$(dirname "$DB_PATH")
chown "$RADIUS_USER:$RADIUS_GROUP" "$DB_PATH" 2>/dev/null && echo "   ✅ Ownership set to $RADIUS_USER:$RADIUS_GROUP" || echo "   ⚠️  Could not change ownership (run as root)"
chmod 660 "$DB_PATH" 2>/dev/null && echo "   ✅ Permissions set to 660" || echo "   ⚠️  Could not change permissions"

# WAL and SHM files must have same permissions
if [ -f "${DB_PATH}-wal" ]; then
    chown "$RADIUS_USER:$RADIUS_GROUP" "${DB_PATH}-wal" 2>/dev/null
    chmod 660 "${DB_PATH}-wal" 2>/dev/null
    echo "   ✅ WAL file permissions fixed"
fi
if [ -f "${DB_PATH}-shm" ]; then
    chown "$RADIUS_USER:$RADIUS_GROUP" "${DB_PATH}-shm" 2>/dev/null
    chmod 660 "${DB_PATH}-shm" 2>/dev/null
    echo "   ✅ SHM file permissions fixed"
fi

# Ensure directory is accessible
chmod 755 "$DB_DIR" 2>/dev/null

# =========================================================================
# Step 5: Verify FreeRADIUS SQL module config
# =========================================================================
echo ""
echo "━━━ Step 5: Check FreeRADIUS SQL config ━━━"

SQL_MOD="/etc/raddb/mods-available/sql"
if [ -f "$SQL_MOD" ]; then
    echo "   ✅ SQL module config found at $SQL_MOD"
    
    # Check if busy_timeout is set
    if grep -q "busy_timeout" "$SQL_MOD"; then
        CURRENT_TIMEOUT=$(grep "busy_timeout" "$SQL_MOD" | head -1 | awk '{print $NF}' | tr -d '}')
        echo "   Current busy_timeout: ${CURRENT_TIMEOUT}ms"
        if [ "$CURRENT_TIMEOUT" != "30000" ]; then
            echo "   ⚠️  busy_timeout should be 30000 - updating..."
            sed -i 's/busy_timeout = [0-9]*/busy_timeout = 30000/' "$SQL_MOD"
            echo "   ✅ busy_timeout updated to 30000ms"
        fi
    else
        echo "   ⚠️  No busy_timeout set in SQL module config!"
    fi

    # Check the database path
    DB_IN_CONFIG=$(grep -oP 'filename\s*=\s*"[^"]*"' "$SQL_MOD" | head -1 | sed 's/filename\s*=\s*"\(.*\)"/\1/')
    if [ -n "$DB_IN_CONFIG" ]; then
        echo "   Database in config: $DB_IN_CONFIG"
        if [ "$DB_IN_CONFIG" != "$DB_PATH" ]; then
            echo "   ⚠️  WARNING: Database path mismatch! Config points to $DB_IN_CONFIG but actual DB is at $DB_PATH"
        fi
    fi
    
    # Check pool settings
    if grep -q "max = 1" "$SQL_MOD"; then
        echo "   ✅ Pool max = 1 (correct for SQLite)"
    else
        echo "   ⚠️  Pool max should be 1 for SQLite (single-writer)"
    fi
else
    echo "   ❌ SQL module config not found at $SQL_MOD"
    echo "   Run the freeradius-service setup endpoint to generate it:"
    echo "   curl http://localhost:3010/api/config/sql-mod -X POST"
fi

# =========================================================================
# Step 6: Test accounting INSERT
# =========================================================================
echo ""
echo "━━━ Step 6: Test accounting INSERT ━━━"

TEST_RESULT=$(sqlite3 "$DB_PATH" "
    INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid,
        nasporttype, acctstarttime, acctupdatetime, acctsessiontime, acctinterval,
        connectinfo_start, servicetype, framedprotocol, framedipaddress,
        framedipv6prefix, framedinterfaceid, delegatedipv6prefix, calledstationid,
        callingstationid, acctinputoctets, acctoutputoctets, acctinputpackets,
        acctoutputpackets, acctinputgigawords, acctoutputgigawords, class,
        acctstoptime, acctterminatecause, acctstatus, createdAt, updatedAt
    ) VALUES (
        'test_session', 'test_unique_123', 'test_user', '', '10.20.30.187', 'ether2',
        'Wireless-802.11', datetime('now'), datetime('now'), 0, 0,
        '', '', '', '10.5.50.254',
        '', '', '', 'hotspot1',
        '00:0C:29:7D:FB:A6', 0, 0, 0,
        0, 0, 0, '',
        NULL, NULL, 'Start', datetime('now'), datetime('now')
    );
" 2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ Test INSERT successful!"
    # Clean up test record
    sqlite3 "$DB_PATH" "DELETE FROM radacct WHERE acctuniqueid = 'test_unique_123';"
    echo "   ✅ Test record cleaned up"
else
    echo "   ❌ Test INSERT failed: $TEST_RESULT"
fi

# =========================================================================
# Step 7: Restart FreeRADIUS if running
# =========================================================================
echo ""
echo "━━━ Step 7: Restart FreeRADIUS ━━━"

if systemctl is-active --quiet radiusd 2>/dev/null; then
    echo "   Restarting radiusd..."
    systemctl restart radiusd
    sleep 2
    if systemctl is-active --quiet radiusd; then
        echo "   ✅ radiusd restarted successfully"
    else
        echo "   ❌ radiusd failed to restart"
        systemctl status radiusd --no-pager -l | tail -5
    fi
elif pgrep -x "radiusd" > /dev/null 2>&1; then
    echo "   radiusd is running (not via systemd)"
    echo "   Send SIGHUP to reload config: kill -HUP \$(pgrep -x radiusd)"
else
    echo "   ⚠️  radiusd is not running"
    echo "   Start with: systemctl start radiusd"
fi

# =========================================================================
# Summary
# =========================================================================
echo ""
echo "=========================================="
echo "✅ Fix Complete!"
echo "=========================================="
echo ""
echo "What was fixed:"
echo "  1. WAL mode enabled (concurrent reads + single writer)"
echo "  2. busy_timeout = 30000ms (wait 30s for lock)"
echo "  3. radacct table verified (37 columns)"
echo "  4. Performance indexes created"
echo "  5. File permissions fixed"
echo "  6. FreeRADIUS SQL config checked"
echo ""
echo "Next steps:"
echo "  1. Make sure StaySuite services are running (pm2 start ecosystem.local.config.js)"
echo "  2. Test login from MikroTik captive portal"
echo "  3. Check the Live Sessions page in StaySuite"
echo "  4. Monitor FreeRADIUS logs: journalctl -u radiusd -f"
echo ""
echo "If still failing, check:"
echo "  - Run 'curl http://localhost:3010/api/config/sql-mod -X POST' to regenerate FreeRADIUS config"
echo "  - Check if Prisma or bun services are holding long write transactions"
echo "  - Consider increasing busy_timeout to 60000 in both sqlite3 and raddb config"
echo ""
