#!/bin/bash
# common.sh — Shared library for StaySuite-HospitalityOS network scripts
# This file is sourced by other scripts; do not execute directly.

set -euo pipefail

# Source configuration
SCRIPT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/config.sh
source "${SCRIPT_LIB_DIR}/config.sh"

###############################################################################
# Logging functions
###############################################################################

# Ensure log directory exists
_ensure_log_dir() {
    if [[ ! -d "${NETWORK_LOG_DIR}" ]]; then
        mkdir -p "${NETWORK_LOG_DIR}" 2>/dev/null || true
    fi
}

# Internal: write a timestamped log line
_log() {
    local level="$1"
    shift
    local message="$*"
    _ensure_log_dir
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    printf "[%s] [%-5s] %s\n" "${ts}" "${level}" "${message}" >> "${NETWORK_LOG_FILE}" 2>/dev/null || true
}

log_info()  { _log "INFO"  "$@"; }
log_warn()  { _log "WARN"  "$@"; }
log_error() { _log "ERROR" "$@"; }

###############################################################################
# JSON output
###############################################################################

# Print structured JSON to stdout.
# Usage: json_output <success:bool> <data:json-string> <error:string>
#   - success: "true" or "false"
#   - data:    a valid JSON object string (or "null")
#   - error:   error message string (or "" for none)
json_output() {
    local success="$1"
    local data="${2:-{}}"
    local error="${3:-}"
    local timestamp
    timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

    # Build JSON safely
    if [[ "${success}" == "true" ]]; then
        printf '{"success":true,"data":%s,"error":"","timestamp":"%s"}\n' \
            "${data}" "${timestamp}"
    else
        # Escape quotes in error message
        error="${error//\"/\\\"}"
        printf '{"success":false,"data":{},"error":"%s","timestamp":"%s"}\n' \
            "${error}" "${timestamp}"
    fi
}

###############################################################################
# Validation functions
###############################################################################

# Validate interface name against allowed characters.
# Exits with error JSON if invalid.
validate_interface_name() {
    local name="$1"
    if [[ ! "${name}" =~ ^[a-zA-Z0-9._-]+$ ]]; then
        log_error "Invalid interface name: '${name}'"
        json_output false "{}" "Invalid interface name: '${name}'. Must match ^[a-zA-Z0-9._-]+\$"
        exit 1
    fi
}

# Validate IPv4 address format (dotted decimal).
validate_ipv4() {
    local ip="$1"
    local regex='^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$'
    if [[ ! "${ip}" =~ ${regex} ]]; then
        log_error "Invalid IPv4 address: '${ip}'"
        json_output false "{}" "Invalid IPv4 address: '${ip}'"
        exit 1
    fi
    for i in 1 2 3 4; do
        local octet="${BASH_REMATCH[${i}]}"
        if (( octet > 255 )); then
            log_error "Invalid IPv4 octet in '${ip}': ${octet}"
            json_output false "{}" "Invalid IPv4 address: '${ip}' (octet ${octet} > 255)"
            exit 1
        fi
    done
}

# Validate VLAN ID (1-4094).
validate_vlan_id() {
    local vlan_id="$1"
    if ! [[ "${vlan_id}" =~ ^[0-9]+$ ]] || (( vlan_id < MIN_VLAN_ID || vlan_id > MAX_VLAN_ID )); then
        log_error "Invalid VLAN ID: '${vlan_id}' (must be ${MIN_VLAN_ID}-${MAX_VLAN_ID})"
        json_output false "{}" "Invalid VLAN ID: '${vlan_id}'. Must be between ${MIN_VLAN_ID} and ${MAX_VLAN_ID}"
        exit 1
    fi
}

# Validate MTU value (576-9000).
validate_mtu() {
    local mtu="$1"
    if ! [[ "${mtu}" =~ ^[0-9]+$ ]] || (( mtu < MIN_MTU || mtu > MAX_MTU )); then
        log_error "Invalid MTU: '${mtu}' (must be ${MIN_MTU}-${MAX_MTU})"
        json_output false "{}" "Invalid MTU: '${mtu}'. Must be between ${MIN_MTU} and ${MAX_MTU}"
        exit 1
    fi
}

###############################################################################
# Command execution
###############################################################################

# Run a command with timeout. Logs errors.
# Usage: run_cmd "description" command arg1 arg2 ...
# Returns the command's exit code. On failure, logs the error.
# Stdout captured in CMD_OUTPUT, stderr in CMD_STDERR.
CMD_OUTPUT=""
CMD_STDERR=""
CMD_EXIT_CODE=0

run_cmd() {
    local description="$1"
    shift

    log_info "Running: ${description} — $*"

    # Use timeout to prevent hanging
    local exit_code=0
    CMD_OUTPUT=""
    CMD_STDERR=""

    set +e
    CMD_OUTPUT=$(timeout "${CMD_TIMEOUT}" "$@" 2>&1)
    exit_code=$?
    set -e

    CMD_EXIT_CODE=${exit_code}

    if (( exit_code != 0 )); then
        log_error "${description} failed (exit ${exit_code}): $*"
        log_error "  stdout/stderr: ${CMD_OUTPUT}"
        return ${exit_code}
    fi

    log_info "${description} succeeded"
    return 0
}

###############################################################################
# Privilege check
###############################################################################

ensure_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        # Check if sudo is available
        if ! command -v sudo &>/dev/null; then
            log_error "Not running as root and sudo not available"
            json_output false "{}" "This script must be run as root or with sudo"
            exit 1
        fi
        # Re-exec with sudo if not already sudo'd
        if [[ -z "${SUDO_USER:-}" ]]; then
            log_info "Re-executing with sudo"
            exec sudo "$0" "$@"
        fi
    fi
}

###############################################################################
# /etc/network/interfaces file management
###############################################################################

# Ensure the interfaces file exists.
ensure_interfaces_file() {
    if [[ ! -f "${INTERFACES_FILE}" ]]; then
        log_info "Creating ${INTERFACES_FILE}"
        local dir
        dir="$(dirname "${INTERFACES_FILE}")"
        if [[ ! -d "${dir}" ]]; then
            mkdir -p "${dir}" 2>/dev/null || true
        fi
        {
            echo "# /etc/network/interfaces — managed by StaySuite HospitalityOS"
            echo "# Auto-generated header"
            echo ""
        } | sudo tee "${INTERFACES_FILE}" > /dev/null
    fi
}

# Backup the interfaces file.
backup_interfaces() {
    if [[ -f "${INTERFACES_FILE}" ]]; then
        local backup="${INTERFACES_FILE}.staysuite.bak"
        sudo cp "${INTERFACES_FILE}" "${backup}" 2>/dev/null || true
        log_info "Backed up ${INTERFACES_FILE} to ${backup}"
    fi
}

# Remove a managed block from the interfaces file.
# Usage: remove_block <marker_prefix>
# Removes lines between "MANAGED_MARKER: marker BEGIN" and "MANAGED_MARKER: marker END"
remove_block() {
    local marker_prefix="$1"

    if [[ ! -f "${INTERFACES_FILE}" ]]; then
        return 0
    fi

    # Use a temp file for safe in-place editing
    local tmp
    tmp="$(mktemp)"
    local in_block=false

    while IFS= read -r line || [[ -n "${line}" ]]; do
        if [[ "${line}" == *"${MANAGED_MARKER}: ${marker_prefix} BEGIN"* ]]; then
            in_block=true
            continue
        fi
        if [[ "${line}" == *"${MANAGED_MARKER}: ${marker_prefix} END"* ]]; then
            in_block=false
            continue
        fi
        if [[ "${in_block}" == "false" ]]; then
            echo "${line}"
        fi
    done < "${INTERFACES_FILE}" > "${tmp}"

    sudo cp "${tmp}" "${INTERFACES_FILE}" 2>/dev/null || true
    rm -f "${tmp}" 2>/dev/null || true
    log_info "Removed managed block: ${marker_prefix}"
}

###############################################################################
# Utility: netmask to CIDR conversion
###############################################################################

# Convert a dotted-decimal netmask to CIDR prefix length.
# Usage: netmask_to_cidr "255.255.255.0"  →  24
netmask_to_cidr() {
    local mask="$1"
    local cidr=0
    IFS='.' read -r o1 o2 o3 o4 <<< "${mask}"
    for octet in "${o1}" "${o2}" "${o3}" "${o4}"; do
        case "${octet}" in
            255) (( cidr += 8 )) ;;
            254) (( cidr += 7 )) ;;
            252) (( cidr += 6 )) ;;
            248) (( cidr += 5 )) ;;
            240) (( cidr += 4 )) ;;
            224) (( cidr += 3 )) ;;
            192) (( cidr += 2 )) ;;
            128) (( cidr += 1 )) ;;
            0)   ;;
            *)
                log_error "Invalid netmask octet: ${octet}"
                echo "-1"
                return 1
                ;;
        esac
    done
    echo "${cidr}"
}
