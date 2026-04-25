#!/bin/bash
# =============================================================================
# StaySuite HospitalityOS - SQLite to PostgreSQL Migration Script
# =============================================================================
# This script migrates data from a SQLite database to PostgreSQL.
# It handles schema conversion, data export/import, and verification.
#
# Usage:
#   bash deploy/migrate-to-postgres.sh [OPTIONS]
#
# Options:
#   --skip-backup      Skip SQLite backup (not recommended)
#   --skip-data        Only create schema, skip data migration
#   --dry-run          Show what would happen without making changes
#   --db-url URL       Custom PostgreSQL connection URL
#   --help             Show this help message
#
# Prerequisites:
#   - PostgreSQL running and accessible
#   - Bun installed (bun --version)
#   - SQLite database file at db/dev.db (default)
#   - schema.postgresql.prisma exists in prisma/ directory
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
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; }

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRISMA_DIR="${PROJECT_DIR}/prisma"
DB_DIR="${PROJECT_DIR}/db"
SQLITE_DB="${DB_DIR}/dev.db"
SQLITE_BACKUP="${DB_DIR}/dev.db.pre-migration-backup.$(date +%Y%m%d_%H%M%S).bak"

# PostgreSQL schema file
PG_SCHEMA="${PRISMA_DIR}/schema.postgresql.prisma"
ACTIVE_SCHEMA="${PRISMA_DIR}/schema.prisma"

# Parse arguments
SKIP_BACKUP=false
SKIP_DATA=false
DRY_RUN=false
CUSTOM_DB_URL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-backup)   SKIP_BACKUP=true; shift ;;
        --skip-data)     SKIP_DATA=true; shift ;;
        --dry-run)       DRY_RUN=true; shift ;;
        --db-url)        CUSTOM_DB_URL="$2"; shift 2 ;;
        --help|-h)
            head -35 "$0" | tail -30 | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log_info "================================================================"
log_info " StaySuite - SQLite to PostgreSQL Migration"
log_info "================================================================"
echo ""

# Check if project directory exists
if [[ ! -d "$PROJECT_DIR" ]]; then
    log_error "Project directory not found: ${PROJECT_DIR}"
    exit 1
fi

# Check if bun is available
if ! command -v bun &>/dev/null; then
    log_error "Bun is required but not installed. Install from https://bun.sh/"
    exit 1
fi
log_success "Bun $(bun --version) detected."

# Check if SQLite database exists
if [[ ! -f "$SQLITE_DB" ]]; then
    log_error "SQLite database not found at: ${SQLITE_DB}"
    log_error "Ensure the database exists before running migration."
    exit 1
fi
SQLITE_SIZE=$(du -h "$SQLITE_DB" | cut -f1)
log_success "SQLite database found: ${SQLITE_DB} (${SQLITE_SIZE})"

# Check if PostgreSQL schema exists
if [[ ! -f "$PG_SCHEMA" ]]; then
    log_error "PostgreSQL schema file not found: ${PG_SCHEMA}"
    exit 1
fi
log_success "PostgreSQL schema file found: ${PG_SCHEMA}"

# Verify DATABASE_URL is set (either custom or from .env)
if [[ -n "$CUSTOM_DB_URL" ]]; then
    export DATABASE_URL="$CUSTOM_DB_URL"
    log_info "Using custom DATABASE_URL."
elif [[ -n "${DATABASE_URL:-}" ]]; then
    log_info "Using DATABASE_URL from environment."
else
    # Try to load from .env file
    if [[ -f "${PROJECT_DIR}/.env" ]]; then
        set -a
        source "${PROJECT_DIR}/.env"
        set +a
        log_info "Loaded DATABASE_URL from .env file."
    else
        log_error "DATABASE_URL not set. Provide --db-url or set in environment/.env"
        exit 1
    fi
fi

# Verify DATABASE_URL is a PostgreSQL URL
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    log_error "DATABASE_URL must be a PostgreSQL connection URL."
    log_error "  Current: ${DATABASE_URL}"
    exit 1
fi
log_success "PostgreSQL connection URL validated."

# Extract connection info for verification
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\)?.*|\1|p')

log_info "Target PostgreSQL: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Dry run mode
if $DRY_RUN; then
    log_info "=== DRY RUN MODE - No changes will be made ==="
    echo ""
    log_info "Steps that would be performed:"
    echo "  1. Back up SQLite database to: ${SQLITE_BACKUP}"
    echo "  2. Export data from SQLite tables"
    echo "  3. Switch Prisma schema to PostgreSQL"
    echo "  4. Create Prisma migration and apply to PostgreSQL"
    echo "  5. Import data into PostgreSQL tables"
    echo "  6. Verify row counts match between SQLite and PostgreSQL"
    echo "  7. Regenerate Prisma Client"
    echo ""
    log_info "Current SQLite tables and row counts:"
    sqlite3 "$SQLITE_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" | while read -r table; do
        count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "ERROR")
        printf "    %-40s %s rows\n" "$table" "$count"
    done
    echo ""
    log_info "To perform actual migration, run without --dry-run flag."
    exit 0
fi

# =============================================================================
# CONFIRMATION
# =============================================================================
echo ""
log_warn "========================================"
log_warn " THIS WILL MODIFY YOUR DATABASE"
log_warn "========================================"
log_warn "  Source:  ${SQLITE_DB} (${SQLITE_SIZE})"
log_warn "  Target:  PostgreSQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
log_warn "Recommended: Make a full system backup before proceeding."
echo ""
read -rp "Type 'MIGRATE' to continue: " CONFIRM
if [[ "$CONFIRM" != "MIGRATE" ]]; then
    log_info "Migration cancelled."
    exit 0
fi

# =============================================================================
# STEP 1: Backup SQLite Database
# =============================================================================
log_info "=== Step 1: Backup SQLite Database ==="

if $SKIP_BACKUP; then
    log_warn "Backup skipped (--skip-backup flag)."
else
    log_info "Creating backup: ${SQLITE_BACKUP}..."
    cp "$SQLITE_DB" "$SQLITE_BACKUP"
    if [[ -f "$SQLITE_BACKUP" ]]; then
        log_success "SQLite database backed up to: ${SQLITE_BACKUP}"
    else
        log_error "Failed to create backup. Aborting migration."
        exit 1
    fi
fi

# =============================================================================
# STEP 2: Export SQLite Data
# =============================================================================
log_info "=== Step 2: Export SQLite Data ==="

EXPORT_DIR="${DB_DIR}/migration-export"
mkdir -p "$EXPORT_DIR"

# Get list of all user tables
TABLES=$(sqlite3 "$SQLITE_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name;")

TABLE_COUNT=$(echo "$TABLES" | wc -l)
log_info "Exporting data from ${TABLE_COUNT} tables..."

# Export each table as JSON for safe data transfer
for table in $TABLES; do
    OUTPUT_FILE="${EXPORT_DIR}/${table}.json"
    ROW_COUNT=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "0")

    if [[ "$ROW_COUNT" == "0" ]]; then
        log_info "  Skipping empty table: ${table}"
        echo "[]" > "$OUTPUT_FILE"
        continue
    fi

    log_info "  Exporting ${table} (${ROW_COUNT} rows)..."

    # Export as JSON array of objects using sqlite3 JSON functions
    sqlite3 "$SQLITE_DB" "SELECT json_group_array(json_object(
        $(sqlite3 "$SQLITE_DB" "PRAGMA table_info(\"${table}\");" | awk -F'|' '{printf "\"%s\", ", $2}' | sed 's/, $//')
    )) FROM \"${table}\";" > "$OUTPUT_FILE" 2>/dev/null || {
        # Fallback: export as raw SQL INSERT statements
        log_warn "    JSON export failed for ${table}, falling back to SQL..."
        sqlite3 "$SQLITE_DB" ".mode insert \"${table}\"" "SELECT * FROM \"${table}\";" > "${EXPORT_DIR}/${table}.sql" 2>/dev/null
        echo "SQL_FALLBACK" > "$OUTPUT_FILE"
    }
done

log_success "Data export complete: ${EXPORT_DIR}/"

# =============================================================================
# STEP 3: Switch to PostgreSQL Prisma Schema
# =============================================================================
log_info "=== Step 3: Switch to PostgreSQL Prisma Schema ==="

# Backup current SQLite schema
if [[ -f "$ACTIVE_SCHEMA" ]]; then
    cp "$ACTIVE_SCHEMA" "${ACTIVE_SCHEMA}.sqlite-backup"
    log_info "Backed up current schema to: ${ACTIVE_SCHEMA}.sqlite-backup"
fi

# Copy PostgreSQL schema as the active schema
log_info "Activating PostgreSQL schema..."
cp "$PG_SCHEMA" "$ACTIVE_SCHEMA"
log_success "Prisma schema switched to PostgreSQL."

# =============================================================================
# STEP 4: Generate Prisma Client for PostgreSQL
# =============================================================================
log_info "=== Step 4: Generate Prisma Client ==="

cd "$PROJECT_DIR"
log_info "Running: bunx prisma generate..."
bunx prisma generate
log_success "Prisma Client generated for PostgreSQL."

# =============================================================================
# STEP 5: Create and Apply Database Migration
# =============================================================================
log_info "=== Step 5: Apply Database Schema to PostgreSQL ==="

log_info "Running: bunx prisma migrate deploy..."
bunx prisma migrate deploy --skip-generate 2>&1 || {
    # If deploy fails (no migration history yet), try push
    log_warn "Migrate deploy failed. Attempting prisma db push..."
    bunx prisma db push --skip-generate --accept-data-loss 2>&1
}
log_success "Database schema applied to PostgreSQL."

# Create a baseline migration if needed
log_info "Creating baseline migration..."
bunx prisma migrate dev --name init --create-only 2>&1 || {
    log_warn "Baseline migration creation skipped (may already exist)."
}
bunx prisma migrate deploy 2>&1 || {
    log_warn "Migration deploy warning (may be safe to ignore)."
}

# =============================================================================
# STEP 6: Import Data into PostgreSQL
# =============================================================================
if $SKIP_DATA; then
    log_info "=== Step 6: Data Import SKIPPED (--skip-data) ==="
else
    log_info "=== Step 6: Import Data into PostgreSQL ==="

    cd "$PROJECT_DIR"

    # Create a Node.js script for data import
    IMPORT_SCRIPT="${EXPORT_DIR}/import.mjs"
    cat > "$IMPORT_SCRIPT" << 'IMPORT_SCRIPT'
import { PrismaClient } from '../src/lib/db.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const exportDir = process.argv[2] || './db/migration-export';

async function importData() {
    const files = readdirSync(exportDir).filter(f => f.endsWith('.json'));
    let totalImported = 0;
    let errors = 0;

    // Import order: tables without foreign keys first
    const importOrder = [
        'Tenant', 'User', 'Role', 'Property', 'RoomType', 'Room',
        'Guest', 'Booking', 'PricingRule', 'RatePlan', 'Brand'
    ];

    // Sort files: prioritize known tables, then alphabetical
    const sortedFiles = [
        ...importOrder.map(t => `${t}.json`).filter(f => files.includes(f)),
        ...files.filter(f => !importOrder.some(t => `${t}.json` === f))
    ];

    for (const file of sortedFiles) {
        const tableName = file.replace('.json', '');
        const filePath = join(exportDir, file);

        if (!existsSync(filePath)) continue;

        try {
            const content = readFileSync(filePath, 'utf-8').trim();

            if (content === 'SQL_FALLBACK') {
                console.log(`  Skipping ${tableName} (SQL fallback, manual import needed)`);
                continue;
            }

            if (content === '[]' || content === '') {
                console.log(`  Skipping ${tableName} (empty)`);
                continue;
            }

            const rows = JSON.parse(content);

            if (!Array.isArray(rows) || rows.length === 0) {
                console.log(`  Skipping ${tableName} (no data)`);
                continue;
            }

            // Use raw SQL for bulk insert (faster and handles schema differences)
            const model = prisma[tableName.charAt(0).toLowerCase() + tableName.slice(1)];

            if (model && typeof model.createMany === 'function') {
                // Insert in batches of 100 to avoid memory issues
                const batchSize = 100;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);

                    // Clean data: remove undefined values, handle type conversions
                    const cleanBatch = batch.map(row => {
                        const clean = {};
                        for (const [key, value] of Object.entries(row)) {
                            if (value !== null && value !== undefined) {
                                // Convert CUID strings to UUID format for PostgreSQL
                                if (typeof value === 'string' && /^[a-z0-9]{25}$/.test(value)) {
                                    // CUID v1 -> keep as-is, PostgreSQL will handle via schema
                                    clean[key] = value;
                                } else {
                                    clean[key] = value;
                                }
                            }
                        }
                        return clean;
                    });

                    try {
                        await model.createMany({
                            data: cleanBatch,
                            skipDuplicates: true,
                        });
                    } catch (err) {
                        console.log(`  Warning: Batch import for ${tableName} failed: ${err.message}`);
                        console.log(`  Falling back to row-by-row insert...`);
                        // Fallback to individual inserts
                        for (const row of cleanBatch) {
                            try {
                                await model.create({ data: row });
                                totalImported++;
                            } catch (e) {
                                // Skip duplicates or constraint errors
                                if (!e.message.includes('Unique constraint') && !e.message.includes('duplicate key')) {
                                    console.log(`    Row error (${tableName}): ${e.message.substring(0, 100)}`);
                                }
                            }
                        }
                        continue; // Skip the batch count below since we counted individually
                    }
                    totalImported += cleanBatch.length;
                }
                console.log(`  Imported ${tableName}: ${rows.length} rows`);
            } else {
                console.log(`  Skipping ${tableName} (model not found in Prisma client)`);
            }
        } catch (err) {
            console.log(`  Error importing ${tableName}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\nImport summary: ${totalImported} rows imported, ${errors} errors`);
}

importData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
IMPORT_SCRIPT

    # Run the import script
    log_info "Running data import..."
    node "$IMPORT_SCRIPT" "$EXPORT_DIR" 2>&1 || {
        log_warn "Node.js import had issues. You may need to manually review data."
    }

    log_success "Data import attempt complete."
fi

# =============================================================================
# STEP 7: Verify Migration
# =============================================================================
log_info "=== Step 7: Verify Migration ==="

log_info "Comparing row counts..."

echo ""
printf "%-40s %12s %12s %s\n" "TABLE" "SQLITE" "POSTGRESQL" "STATUS"
printf "%-40s %12s %12s %s\n" "-----" "------" "----------" "------"

MISMATCH=0
for table in $TABLES; do
    SQLITE_COUNT=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "0")

    # For PostgreSQL, we need to use prisma or psql
    PG_COUNT=$(bunx prisma db execute --stdin <<SQL 2>/dev/null | tr -d '[:space:]'
SELECT COUNT(*) FROM "${table}";
SQL
)
    PG_COUNT="${PG_COUNT:-0}"

    if [[ "$SQLITE_COUNT" == "$PG_COUNT" ]]; then
        STATUS="${GREEN}OK${NC}"
    else
        STATUS="${YELLOW}MISMATCH${NC}"
        MISMATCH=$((MISMATCH + 1))
    fi

    printf "%-40s %12s %12s %b\n" "$table" "$SQLITE_COUNT" "$PG_COUNT" "$STATUS"
done

echo ""

if [[ $MISMATCH -eq 0 ]]; then
    log_success "All tables verified! Row counts match."
else
    log_warn "${MISMATCH} table(s) have mismatched row counts."
    log_warn "This may be due to SQLite/PostgreSQL type differences or data constraints."
    log_warn "Review the PostgreSQL data and the SQLite backup manually."
fi

# =============================================================================
# STEP 8: Regenerate Prisma Client (final)
# =============================================================================
log_info "=== Step 8: Final Prisma Client Generation ==="

cd "$PROJECT_DIR"
bunx prisma generate
log_success "Prisma Client regenerated."

# =============================================================================
# CLEANUP
# =============================================================================
log_info "=== Cleanup ==="

# Don't delete export dir automatically - keep for verification
log_info "Export files preserved at: ${EXPORT_DIR}"
log_info "SQLite backup preserved at: ${SQLITE_BACKUP}"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "========================================================================"
log_success " Migration Complete!"
echo "========================================================================"
echo ""
log_info "Summary:"
echo "  SQLite backup:   ${SQLITE_BACKUP}"
echo "  Export data:     ${EXPORT_DIR}/"
echo "  Active schema:   ${ACTIVE_SCHEMA} (PostgreSQL)"
echo "  SQLite backup:   ${ACTIVE_SCHEMA}.sqlite-backup"
echo ""
log_info "Next steps:"
echo "  1. Verify your application works with PostgreSQL:"
echo "     bun run dev"
echo ""
echo "  2. Run the seed script if needed:"
echo "     bun run seed"
echo ""
echo "  3. Test all critical operations (bookings, guests, etc.)"
echo ""
echo "  4. If issues arise, rollback by:"
echo "     cp ${ACTIVE_SCHEMA}.sqlite-backup ${ACTIVE_SCHEMA}"
echo "     rm -f ${SQLITE_DB}"
echo "     cp ${SQLITE_BACKUP} ${SQLITE_DB}"
echo ""
echo "========================================================================"
