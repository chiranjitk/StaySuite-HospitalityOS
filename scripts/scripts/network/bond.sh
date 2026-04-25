#!/bin/bash
# bond.sh — Bond interface management for StaySuite-HospitalityOS
# Usage:
#   bond.sh create <name> <mode> [--miimon <N>] [--lacp-rate <slow|fast>] [--primary <iface>] [--members <m1>,<m2>] [--ip IP] [--netmask MASK]
#   bond.sh delete <name>
#   bond.sh list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Valid bonding modes
VALID_BOND_MODES=("active-backup" "balance-rr" "balance-xor" "802.3ad" "balance-tlb" "balance-alb")

###############################################################################
# Validate bond mode
###############################################################################
validate_bond_mode() {
    local mode="$1"
    local valid=false
    for m in "${VALID_BOND_MODES[@]}"; do
        if [[ "${mode}" == "${m}" ]]; then
            valid=true
            break
        fi
    done
    if [[ "${valid}" == "false" ]]; then
        log_error "Invalid bond mode: '${mode}'"
        json_output false "{}" "Invalid bond mode: '${mode}'. Valid modes: ${VALID_BOND_MODES[*]}"
        return 1
    fi
}

###############################################################################
# Parse bond options
###############################################################################
parse_bond_options() {
    BOND_IP_ADDRESS=""
    BOND_NETMASK=""
    BOND_MIIMON="${DEFAULT_MIIMON}"
    BOND_LACP_RATE="${DEFAULT_LACP_RATE}"
    BOND_PRIMARY=""
    BOND_MEMBERS=""

    while (( $# > 0 )); do
        case "$1" in
            --miimon)
                BOND_MIIMON="$2"
                shift 2
                ;;
            --lacp-rate)
                BOND_LACP_RATE="$2"
                if [[ "${BOND_LACP_RATE}" != "slow" && "${BOND_LACP_RATE}" != "fast" ]]; then
                    json_output false "{}" "lacp-rate must be 'slow' or 'fast'"
                    return 1
                fi
                shift 2
                ;;
            --primary)
                BOND_PRIMARY="$2"
                shift 2
                ;;
            --members)
                BOND_MEMBERS="$2"
                shift 2
                ;;
            --ip)
                BOND_IP_ADDRESS="$2"
                shift 2
                ;;
            --netmask)
                BOND_NETMASK="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
}

BOND_MIIMON=""
BOND_LACP_RATE=""
BOND_PRIMARY=""
BOND_MEMBERS=""
BOND_IP_ADDRESS=""
BOND_NETMASK=""

###############################################################################
# bond_create <name> <mode> [options...]
###############################################################################
bond_create() {
    local name="$1"
    local mode="$2"
    shift 2

    validate_interface_name "${name}"
    validate_bond_mode "${mode}"

    # Check if bond already exists
    if [[ -e "/sys/class/net/${name}" ]]; then
        log_error "Bond interface '${name}' already exists"
        json_output false "{}" "Bond interface '${name}' already exists"
        return 1
    fi

    # Parse options
    parse_bond_options "$@"

    # Load bonding module
    if ! run_cmd "Load bonding module" sudo modprobe bonding; then
        log_warn "modprobe bonding failed (may already be loaded)"
    fi

    # Create bond interface
    if ! run_cmd "Create bond ${name}" sudo ip link add name "${name}" type bond mode "${mode}" miimon "${BOND_MIIMON}"; then
        json_output false "{}" "Failed to create bond interface '${name}'"
        return 1
    fi

    # Set LACP rate if 802.3ad mode
    if [[ "${mode}" == "802.3ad" ]]; then
        local lacp_val=0
        if [[ "${BOND_LACP_RATE}" == "fast" ]]; then
            lacp_val=1
        fi
        if ! run_cmd "Set LACP rate on ${name}" sudo ip link set "${name}" type bond lacp_rate "${lacp_val}"; then
            log_warn "Failed to set LACP rate (non-fatal)"
        fi
    fi

    # Set primary if specified
    if [[ -n "${BOND_PRIMARY}" ]]; then
        validate_interface_name "${BOND_PRIMARY}"
        if ! run_cmd "Set primary ${BOND_PRIMARY} on ${name}" sudo ip link set "${name}" type bond primary "${BOND_PRIMARY}"; then
            log_warn "Failed to set primary interface (non-fatal)"
        fi
    fi

    # Add members
    local members_json="["
    local first_member=true
    if [[ -n "${BOND_MEMBERS}" ]]; then
        IFS=',' read -ra member_list <<< "${BOND_MEMBERS}"
        for member in "${member_list[@]}"; do
            member="$(echo "${member}" | xargs)" # trim whitespace
            validate_interface_name "${member}"

            if [[ ! -e "/sys/class/net/${member}" ]]; then
                log_error "Member interface '${member}' does not exist"
                run_cmd "Delete bond ${name} (rollback)" sudo ip link del "${name}" || true
                json_output false "{}" "Member interface '${member}' does not exist"
                return 1
            fi

            if ! run_cmd "Add member ${member} to ${name}" sudo ip link set "${member}" master "${name}"; then
                log_warn "Failed to add member '${member}', cleaning up"
                run_cmd "Delete bond ${name} (rollback)" sudo ip link del "${name}" || true
                json_output false "{}" "Failed to add member '${member}' to bond '${name}'"
                return 1
            fi

            if [[ "${first_member}" == "true" ]]; then
                first_member=false
            else
                members_json+=","
            fi
            members_json+="\"${member}\""
        done
    fi
    members_json+="]"

    # Bring bond up
    if ! run_cmd "Bring up bond ${name}" sudo ip link set "${name}" up; then
        log_warn "Failed to bring up bond, cleaning up"
        run_cmd "Delete bond ${name} (rollback)" sudo ip link del "${name}" || true
        json_output false "{}" "Failed to bring up bond '${name}'"
        return 1
    fi

    # L3: Assign IP address if provided
    local ip_address=""
    local netmask=""
    local cidr_prefix=0
    if [[ -n "${BOND_IP_ADDRESS:-}" ]]; then
        ip_address="${BOND_IP_ADDRESS}"
        netmask="${BOND_NETMASK:-255.255.255.0}"
        cidr_prefix=$(netmask_to_cidr "${netmask}")
        
        if ! run_cmd "Assign IP ${ip_address}/${cidr_prefix} to ${name}" sudo ip addr add "${ip_address}/${cidr_prefix}" dev "${name}"; then
            log_warn "Failed to assign IP to bond, cleaning up"
            run_cmd "Delete bond ${name} (rollback)" sudo ip link del "${name}" || true
            json_output false "{}" "Failed to assign IP ${ip_address}/${cidr_prefix} to bond '${name}'"
            return 1
        fi
        log_info "IP ${ip_address}/${cidr_prefix} assigned to bond ${name}"
    fi

    local ip_json="null"
    local netmask_json="null"
    [[ -n "${ip_address}" ]] && ip_json="\"${ip_address}\""
    [[ -n "${netmask}" ]] && netmask_json="\"${netmask}\""
    
    log_info "Bond '${name}' created (mode=${mode}, miimon=${BOND_MIIMON}${ip_address:+, ip=${ip_address}/${cidr_prefix}})"
    json_output true "{\"name\":\"${name}\",\"mode\":\"${mode}\",\"miimon\":${BOND_MIIMON},\"lacp_rate\":\"${BOND_LACP_RATE}\",\"primary\":\"${BOND_PRIMARY}\",\"members\":${members_json},\"ipAddress\":${ip_json},\"netmask\":${netmask_json},\"cidr\":${cidr_prefix}}" ""
}

###############################################################################
# bond_delete <name>
###############################################################################
bond_delete() {
    local name="$1"

    validate_interface_name "${name}"

    if [[ ! -e "/sys/class/net/${name}" ]]; then
        log_error "Bond interface '${name}' does not exist"
        json_output false "{}" "Bond interface '${name}' does not exist"
        return 1
    fi

    # Remove all members first
    if [[ -d "/proc/net/bonding/${name}" ]]; then
        local member
        while IFS= read -r member; do
            member="$(echo "${member}" | xargs)"
            if [[ -n "${member}" ]]; then
                run_cmd "Remove member ${member} from ${name}" sudo ip link set "${member}" nomaster || true
            fi
        done < <(grep "Slave Interface:" "/proc/net/bonding/${name}" 2>/dev/null | awk '{print $3}' || true)
    fi

    if ! run_cmd "Delete bond ${name}" sudo ip link del "${name}"; then
        json_output false "{}" "Failed to delete bond '${name}'"
        return 1
    fi

    log_info "Bond '${name}' deleted successfully"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# bond_list
###############################################################################
bond_list() {
    local bonds_json="["
    local first=true

    # Find all bond interfaces via /sys/class/net
    for iface_path in /sys/class/net/bond*; do
        [[ -e "${iface_path}" ]] || continue
        local bond_name
        bond_name="$(basename "${iface_path}")"

        # Skip if not actually a bond
        [[ ! -d "/proc/net/bonding/${bond_name}" ]] && continue

        local mode="unknown"
        local miimon=0
        local primary=""
        local members_json_arr="["
        local first_m=true

        # Parse bonding info
        if [[ -f "/proc/net/bonding/${bond_name}" ]]; then
            mode=$(grep "Bonding Mode:" "/proc/net/bonding/${bond_name}" 2>/dev/null | sed 's/Bonding Mode: //' | awk '{print $1}' || echo "unknown")
            miimon=$(grep "MII Status:" "/proc/net/bonding/${bond_name}" 2>/dev/null | head -1 | grep -oP 'MII Polling Interval \(ms\): \K[0-9]+' || echo "0")
            primary=$(grep "Primary Slave:" "/proc/net/bonding/${bond_name}" 2>/dev/null | sed 's/Primary Slave: //' || echo "none")

            while IFS= read -r member; do
                member="$(echo "${member}" | xargs)"
                [[ -z "${member}" ]] && continue
                if [[ "${first_m}" == "true" ]]; then
                    first_m=false
                else
                    members_json_arr+=","
                fi
                members_json_arr+="\"${member}\""
            done < <(grep "Slave Interface:" "/proc/net/bonding/${bond_name}" 2>/dev/null | awk '{print $3}' || true)
        fi
        members_json_arr+="]"

        # Get state
        local state="DOWN"
        if [[ -f "/sys/class/net/${bond_name}/operstate" ]]; then
            state=$(cat "/sys/class/net/${bond_name}/operstate" 2>/dev/null || echo "DOWN")
        fi

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            bonds_json+=","
        fi

        bonds_json+="{\"name\":\"${bond_name}\",\"mode\":\"${mode}\",\"miimon\":${miimon},\"primary\":\"${primary}\",\"state\":\"${state}\",\"members\":${members_json_arr}}"
    done

    bonds_json+="]"

    json_output true "${bonds_json}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        create)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: bond.sh create <name> <mode> [--miimon <N>] [--lacp-rate <slow|fast>] [--primary <iface>] [--members <m1>,<m2>] [--ip IP] [--netmask MASK]"
                exit 1
            fi
            bond_create "$2" "$3" "${@:4}"
            ;;
        delete)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: bond.sh delete <name>"
                exit 1
            fi
            bond_delete "$2"
            ;;
        list)
            bond_list
            ;;
        "")
            json_output false "{}" "Usage: bond.sh {create|delete|list}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
