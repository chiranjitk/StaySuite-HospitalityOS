#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — User Authentication Helper (nftables)
#
#  Called by: RADIUS auth callback, session timeout, logout, admin actions
#  Purpose:  Add/remove user IPs to/from authenticated_users nft set
#
#  This is the dynamic counterpart to staysuite-gateway.sh.
#  The gateway script sets up the base chains; this script modifies
#  the authenticated_users set at runtime.
#
#  Usage:
#    staysuite-user-auth.sh add    <ip> [timeout_seconds]   — Authorize user
#    staysuite-user-auth.sh remove <ip>                     — Deauthorize user
#    staysuite-user-auth.sh check  <ip>                     — Check if authorized
#    staysuite-user-auth.sh list                              — List all authorized
#    staysuite-user-auth.sh flush                             — Remove all authorized
#    staysuite-user-auth.sh add-network <cidr>               — Authorize subnet
#    staysuite-user-auth.sh remove-network <cidr>            — Deauthorize subnet
#
#  Examples:
#    ./staysuite-user-auth.sh add 192.168.1.100 3600    # Add for 1 hour
#    ./staysuite-user-auth.sh add 192.168.1.100 0       # Add indefinitely (no timeout)
#    ./staysuite-user-auth.sh remove 192.168.1.100     # Remove user
#    ./staysuite-user-auth.sh check 192.168.1.100      # Check status
#    ./staysuite-user-auth.sh add-network 192.168.1.0/24 # Add whole subnet
#
###########################################################################

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────

STAYSUITE_DIR="${STAYSUITE_DIR:-/usr/local/staysuite}"
LOG_TAG="staysuite-auth"
LOG_FILE="${STAYSUITE_DIR}/logs/auth.log"
TBL_MANGLE="inet staysuite_mangle"

# Set name for authenticated users
SET_AUTH_USERS="authenticated_users"
SET_AUTH_NETWORKS="authenticated_networks"

# Default timeout for authenticated sessions (seconds)
# 0 = no timeout (indefinite, relies on set timeout in gateway script)
DEFAULT_TIMEOUT="${DEFAULT_TIMEOUT:-0}"

# ═══════════════════════════════════════════════════════════════════════════
#  Utility Functions
# ═══════════════════════════════════════════════════════════════════════════

log() {
    local level="${1:-INFO}"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*" \
        | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*"
}

validate_ip() {
    local ip="$1"
    # Basic IPv4 validation
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        local IFS='.'
        read -ra octets <<< "$ip"
        for octet in "${octets[@]}"; do
            if [ "$octet" -gt 255 ] 2>/dev/null; then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

validate_cidr() {
    local cidr="$1"
    if [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        local prefix="${cidr#*/}"
        if [ "$prefix" -ge 0 ] && [ "$prefix" -le 32 ] 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

check_nft_table() {
    if ! nft list tables 2>/dev/null | grep -q "staysuite_mangle"; then
        log "ERROR" "staysuite_mangle table not found. Run staysuite-gateway.sh first."
        return 1
    fi
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  Commands
# ═══════════════════════════════════════════════════════════════════════════

cmd_add() {
    local ip="$1"
    local timeout="${2:-$DEFAULT_TIMEOUT}"

    if ! validate_ip "$ip"; then
        log "ERROR" "Invalid IP address: $ip"
        return 1
    fi

    check_nft_table || return 1

    # Check if already in set
    if nft get element inet staysuite_mangle authenticated_users "{ $ip }" 2>/dev/null; then
        log "WARN" "IP $ip already authenticated, refreshing timeout..."
        # Delete and re-add to refresh timeout
        nft delete element inet staysuite_mangle authenticated_users "{ $ip }" 2>/dev/null || true
    fi

    if [ "$timeout" -gt 0 ] 2>/dev/null; then
        # Add with timeout (auto-removes after timeout expires)
        nft add element inet staysuite_mangle authenticated_users "{ $ip timeout ${timeout}s }"
        log "AUTH" "User $ip authorized (timeout: ${timeout}s)"
    else
        # Add without explicit timeout (uses set default: 86400s = 24h)
        nft add element inet staysuite_mangle authenticated_users "{ $ip }"
        log "AUTH" "User $ip authorized (indefinite)"
    fi

    return 0
}

cmd_remove() {
    local ip="$1"

    if ! validate_ip "$ip"; then
        log "ERROR" "Invalid IP address: $ip"
        return 1
    fi

    # Remove from set (no error if not present)
    if nft delete element inet staysuite_mangle authenticated_users "{ $ip }" 2>/dev/null; then
        log "AUTH" "User $ip deauthorized"
    else
        log "WARN" "User $ip not found in authenticated set"
    fi

    return 0
}

cmd_check() {
    local ip="$1"

    if ! validate_ip "$ip"; then
        log "ERROR" "Invalid IP address: $ip"
        return 1
    fi

    if nft get element inet staysuite_mangle authenticated_users "{ $ip }" 2>/dev/null; then
        echo "AUTHENTICATED"
        return 0
    else
        echo "NOT_AUTHENTICATED"
        return 1
    fi
}

cmd_list() {
    echo "=== Authenticated Users ==="
    nft list set inet staysuite_mangle authenticated_users 2>/dev/null || echo "(set not found)"
    echo ""
    echo "=== Authenticated Networks ==="
    nft list set inet staysuite_mangle authenticated_networks 2>/dev/null || echo "(set not found)"
    echo ""
    echo "=== Deny Networks ==="
    nft list set inet staysuite_mangle deny_networks 2>/dev/null || echo "(set not found)"
    echo ""
    echo "=== Portal Exempt ==="
    nft list set inet staysuite_mangle portal_exempt 2>/dev/null || echo "(set not found)"
}

cmd_flush() {
    log "WARN" "Flushing ALL authenticated users!"
    nft flush set inet staysuite_mangle authenticated_users 2>/dev/null || true
    nft flush set inet staysuite_mangle authenticated_networks 2>/dev/null || true
    log "AUTH" "All users deauthorized"
}

cmd_add_network() {
    local cidr="$1"

    if ! validate_cidr "$cidr"; then
        log "ERROR" "Invalid CIDR: $cidr (expected format: 192.168.1.0/24)"
        return 1
    fi

    check_nft_table || return 1

    nft add element inet staysuite_mangle authenticated_networks "{ $cidr }" 2>/dev/null
    log "AUTH" "Network $cidr authorized"
}

cmd_remove_network() {
    local cidr="$1"

    if ! validate_cidr "$cidr"; then
        log "ERROR" "Invalid CIDR: $cidr"
        return 1
    fi

    nft delete element inet staysuite_mangle authenticated_networks "{ $cidr }" 2>/dev/null
    log "AUTH" "Network $cidr deauthorized"
}

cmd_add_deny() {
    local cidr="$1"

    if ! validate_cidr "$cidr"; then
        log "ERROR" "Invalid CIDR for deny: $cidr"
        return 1
    fi

    check_nft_table || return 1

    nft add element inet staysuite_mangle deny_networks "{ $cidr }" 2>/dev/null
    log "FIREWALL" "Denied network $cidr"
}

cmd_remove_deny() {
    local cidr="$1"

    nft delete element inet staysuite_mangle deny_networks "{ $cidr }" 2>/dev/null
    log "FIREWALL" "Removed deny for $cidr"
}

cmd_add_exempt() {
    local ip="$1"

    if ! validate_ip "$ip"; then
        log "ERROR" "Invalid IP for exempt: $ip"
        return 1
    fi

    nft add element inet staysuite_mangle portal_exempt "{ $ip }" 2>/dev/null
    log "FIREWALL" "Added portal exempt: $ip"
}

cmd_remove_exempt() {
    local ip="$1"

    nft delete element inet staysuite_mangle portal_exempt "{ $ip }" 2>/dev/null
    log "FIREWALL" "Removed portal exempt: $ip"
}

cmd_block_mac() {
    local mac="$1"

    if [[ ! "$mac" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]; then
        log "ERROR" "Invalid MAC address: $mac (expected XX:XX:XX:XX:XX:XX)"
        return 1
    fi

    nft add element inet staysuite_filter blocked_macs "{ $mac }" 2>/dev/null
    log "FIREWALL" "Blocked MAC: $mac"
}

cmd_unblock_mac() {
    local mac="$1"

    nft delete element inet staysuite_filter blocked_macs "{ $mac }" 2>/dev/null
    log "FIREWALL" "Unblocked MAC: $mac"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

usage() {
    cat << 'EOF'
StaySuite User Authentication Helper (nftables)

Usage: staysuite-user-auth.sh <command> [args...]

Commands:
  add <ip> [timeout]           Authorize user IP (timeout in seconds, 0=indefinite)
  remove <ip>                  Deauthorize user IP
  check <ip>                   Check if IP is authenticated
  list                         List all authenticated users, networks, denied
  flush                        Remove ALL authenticated users

  add-network <cidr>           Authorize whole subnet (e.g. 192.168.1.0/24)
  remove-network <cidr>        Deauthorize subnet

  add-deny <cidr>              Block network
  remove-deny <cidr>           Unblock network

  add-exempt <ip>              Add portal-exempt IP (bypasses captive portal)
  remove-exempt <ip>           Remove portal-exempt IP

  block-mac <mac>              Block MAC address (XX:XX:XX:XX:XX:XX)
  unblock-mac <mac>            Unblock MAC address

Examples:
  staysuite-user-auth.sh add 192.168.1.100 3600
  staysuite-user-auth.sh remove 192.168.1.100
  staysuite-user-auth.sh add-network 10.0.0.0/8
  staysuite-user-auth.sh block-mac AA:BB:CC:DD:EE:FF
  staysuite-user-auth.sh flush
EOF
    exit 1
}

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    local cmd="${1:-}"

    case "$cmd" in
        add)           cmd_add "$2" "${3:-$DEFAULT_TIMEOUT}" ;;
        remove)        cmd_remove "$2" ;;
        check)         cmd_check "$2" ;;
        list)          cmd_list ;;
        flush)         cmd_flush ;;
        add-network)   cmd_add_network "$2" ;;
        remove-network) cmd_remove_network "$2" ;;
        add-deny)      cmd_add_deny "$2" ;;
        remove-deny)   cmd_remove_deny "$2" ;;
        add-exempt)    cmd_add_exempt "$2" ;;
        remove-exempt) cmd_remove_exempt "$2" ;;
        block-mac)     cmd_block_mac "$2" ;;
        unblock-mac)   cmd_unblock_mac "$2" ;;
        -h|--help|help) usage ;;
        *)             log "ERROR" "Unknown command: $cmd"; usage ;;
    esac
}

main "$@"
