#!/bin/bash
# =============================================================================
# StaySuite HospitalityOS - Mini-Services Starter
# =============================================================================
# Starts all mini-services (realtime, availability, freeradius) for local
# development. Each service runs in the background with PID tracking.
#
# Usage:
#   ./start-services.sh            # Start all services
#   ./start-services.sh --no-color  # Disable colored output
#
# Stop services:
#   Press Ctrl+C or kill the parent process
#
# =============================================================================

set -e

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.services.pid"
LOG_DIR="$PROJECT_DIR/.logs"

# Color support
if [[ "${1:-}" == "--no-color" ]]; then
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC='';
else
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m';
fi

log_info()    { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; }

# ---------------------------------------------------------------------------
# Cleanup function - kills all child processes on exit
# ---------------------------------------------------------------------------
cleanup() {
    echo ""
    log_info "Shutting down all mini-services..."

    if [[ -f "$PID_FILE" ]]; then
        FAILED=0
        while IFS= read -r line; do
            # Each line format: SERVICE_NAME:PID
            SERVICE_NAME=$(echo "$line" | cut -d: -f1)
            PID=$(echo "$line" | cut -d: -f2)

            if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
                # Try graceful shutdown first (SIGTERM)
                kill "$PID" 2>/dev/null || true

                # Wait up to 5 seconds for graceful shutdown
                for i in $(seq 1 5); do
                    if ! kill -0 "$PID" 2>/dev/null; then
                        break
                    fi
                    sleep 1
                done

                # Force kill if still running
                if kill -0 "$PID" 2>/dev/null; then
                    kill -9 "$PID" 2>/dev/null || true
                    log_warn "Force-killed ${SERVICE_NAME} (PID ${PID})"
                else
                    log_info "Stopped ${SERVICE_NAME} (PID ${PID})"
                fi
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    # Kill any remaining child processes
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true

    wait 2>/dev/null || true
    log_success "All mini-services stopped."
    exit 0
}

# ---------------------------------------------------------------------------
# Check if a port is already in use
# ---------------------------------------------------------------------------
check_port() {
    local port=$1
    local service=$2

    if lsof -i :"$port" >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        log_error "Port ${port} is already in use. Cannot start ${service}."
        log_error "Kill the process using port ${port} first:"
        log_error "  lsof -i :${port} | grep LISTEN"
        log_error "  kill <PID>"
        return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Start a single service
# ---------------------------------------------------------------------------
start_service() {
    local service_name=$1
    local service_dir=$2
    local entry_file=$3
    local port=$4

    # Check port availability
    if ! check_port "$port" "$service_name"; then
        return 1
    fi

    # Verify service directory exists
    if [[ ! -d "$service_dir" ]]; then
        log_error "Service directory not found: ${service_dir}"
        return 1
    fi

    # Verify entry file exists
    if [[ ! -f "${service_dir}/${entry_file}" ]]; then
        log_error "Entry file not found: ${service_dir}/${entry_file}"
        return 1
    fi

    # Check if bun is available
    if ! command -v bun &>/dev/null; then
        log_error "Bun runtime not found. Install from https://bun.sh/"
        return 1
    fi

    # Check if dependencies are installed
    if [[ ! -d "${service_dir}/node_modules" ]]; then
        log_warn "Dependencies not installed for ${service_name}. Running 'bun install'..."
        (cd "$service_dir" && bun install) || {
            log_error "Failed to install dependencies for ${service_name}"
            return 1
        }
    fi

    # Start the service in the background
    log_info "Starting ${service_name} (port ${port})..."
    (cd "$service_dir" && bun --hot "$entry_file" > "${LOG_DIR}/${service_name}.log" 2>&1) &
    local pid=$!

    # Record PID
    echo "${service_name}:${pid}" >> "$PID_FILE"

    # Wait briefly and check if process is still running
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
        log_success "${service_name} started (PID ${pid}) on port ${port}"
        return 0
    else
        log_error "${service_name} failed to start. Check ${LOG_DIR}/${service_name}.log"
        # Show last few lines of log for debugging
        if [[ -f "${LOG_DIR}/${service_name}.log" ]]; then
            echo "  --- Last 5 log lines ---"
            tail -5 "${LOG_DIR}/${service_name}.log" | sed 's/^/  /'
        fi
        return 1
    fi
}

# =========================================================================
# Main
# =========================================================================

echo ""
log_info "================================================================"
log_info " StaySuite - Mini-Services Starter"
log_info "================================================================"
echo ""

# Kill old processes on startup and register cleanup trap
cleanup 2>/dev/null || true
trap cleanup EXIT INT TERM

# Create PID file and log directory
> "$PID_FILE"
mkdir -p "$LOG_DIR"

# Track startup errors
STARTUP_ERRORS=0

# ---------------------------------------------------------------------------
# Start Realtime Service (port 3003)
# ---------------------------------------------------------------------------
start_service \
    "realtime-service" \
    "$PROJECT_DIR/realtime-service" \
    "index.ts" \
    3003 \
    || STARTUP_ERRORS=$((STARTUP_ERRORS + 1))

# ---------------------------------------------------------------------------
# Start Availability Service (port 3002)
# ---------------------------------------------------------------------------
start_service \
    "availability-service" \
    "$PROJECT_DIR/availability-service" \
    "server.ts" \
    3002 \
    || STARTUP_ERRORS=$((STARTUP_ERRORS + 1))

# ---------------------------------------------------------------------------
# Start FreeRADIUS Management Service (port 3010)
# ---------------------------------------------------------------------------
start_service \
    "freeradius-service" \
    "$PROJECT_DIR/freeradius-service" \
    "index.ts" \
    3010 \
    || STARTUP_ERRORS=$((STARTUP_ERRORS + 1))

# ---------------------------------------------------------------------------
# Startup Summary
# ---------------------------------------------------------------------------
echo ""
if [[ $STARTUP_ERRORS -eq 0 ]]; then
    log_success "All mini-services started successfully!"
    echo ""
    log_info "Running services:"
    echo "  - Realtime Service:      http://localhost:3003"
    echo "  - Availability Service:  http://localhost:3002"
    echo "  - FreeRADIUS Service:    http://localhost:3010"
    echo ""
    log_info "Logs:     ${LOG_DIR}/"
    log_info "PIDs:     ${PID_FILE}"
    echo ""
    log_info "Press Ctrl+C to stop all services."
else
    log_warn "${STARTUP_ERRORS} service(s) failed to start."
    log_info "Check logs in ${LOG_DIR}/ for details."
    echo ""
    log_info "Running services:"
    if [[ -f "$PID_FILE" ]] && [[ -s "$PID_FILE" ]]; then
        while IFS=: read -r name pid; do
            if [[ -n "$name" ]] && kill -0 "$pid" 2>/dev/null; then
                echo "  - ${name} (PID ${pid})"
            fi
        done < "$PID_FILE"
    fi
fi

# Wait for all background processes
wait
