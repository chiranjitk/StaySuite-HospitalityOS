#!/bin/bash
# vlan.sh — VLAN interface management for StaySuite-HospitalityOS
# Usage:
#   vlan.sh create <parent> <vlanId> [name] [mtu]
#   vlan.sh delete <name>
#   vlan.sh list

set -euo pipefail

# Resolve lib directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# vlan_create <parent> <vlanId> [name] [mtu]
###############################################################################
vlan_create() {
    local parent="$1"
    local vlan_id="$2"
    local name="${3:-}"
    local mtu="${4:-}"

    validate_interface_name "${parent}"
    validate_vlan_id "${vlan_id}"

    # Auto-generate name if not provided
    if [[ -z "${name}" ]]; then
        name="${parent}.${vlan_id}"
    fi

    validate_interface_name "${name}"

    # Verify parent exists
    if [[ ! -e "/sys/class/net/${parent}" ]]; then
        log_error "Parent interface '${parent}' does not exist"
        json_output false "{}" "Parent interface '${parent}' does not exist"
        return 1
    fi

    # Check if VLAN interface already exists
    if [[ -e "/sys/class/net/${name}" ]]; then
        log_error "VLAN interface '${name}' already exists"
        json_output false "{}" "VLAN interface '${name}' already exists"
        return 1
    fi

    # Create VLAN interface
    if ! run_cmd "Create VLAN ${name}" sudo ip link add link "${parent}" name "${name}" type vlan id "${vlan_id}"; then
        json_output false "{}" "Failed to create VLAN interface '${name}'"
        return 1
    fi

    # Set MTU if specified
    if [[ -n "${mtu}" ]]; then
        validate_mtu "${mtu}"
        if ! run_cmd "Set MTU on ${name}" sudo ip link set "${name}" mtu "${mtu}"; then
            # Rollback
            log_warn "Failed to set MTU, cleaning up VLAN"
            run_cmd "Delete VLAN ${name} (rollback)" sudo ip link del "${name}" || true
            json_output false "{}" "Failed to set MTU on '${name}'"
            return 1
        fi
    fi

    # Bring interface up
    if ! run_cmd "Bring up ${name}" sudo ip link set "${name}" up; then
        log_warn "Failed to bring up VLAN, cleaning up"
        run_cmd "Delete VLAN ${name} (rollback)" sudo ip link del "${name}" || true
        json_output false "{}" "Failed to bring up VLAN interface '${name}'"
        return 1
    fi

    log_info "VLAN interface '${name}' created successfully (parent=${parent}, vlan_id=${vlan_id})"
    json_output true "{\"name\":\"${name}\",\"parent\":\"${parent}\",\"vlan_id\":${vlan_id},\"mtu\":${mtu:-0}}" ""
}

###############################################################################
# vlan_delete <name>
###############################################################################
vlan_delete() {
    local name="$1"

    validate_interface_name "${name}"

    if [[ ! -e "/sys/class/net/${name}" ]]; then
        log_error "Interface '${name}' does not exist"
        json_output false "{}" "Interface '${name}' does not exist"
        return 1
    fi

    if ! run_cmd "Delete VLAN ${name}" sudo ip link del "${name}"; then
        json_output false "{}" "Failed to delete VLAN interface '${name}'"
        return 1
    fi

    log_info "VLAN interface '${name}' deleted successfully"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# vlan_list
###############################################################################
vlan_list() {
    local output
    if ! output=$(ip -o link show type vlan 2>&1); then
        log_error "Failed to list VLAN interfaces"
        json_output false "{}" "Failed to list VLAN interfaces"
        return 1
    fi

    if [[ -z "${output}" ]]; then
        json_output true "[]" ""
        return 0
    fi

    # Parse VLAN output into JSON array
    local json="["
    local first=true

    while IFS= read -r line; do
        # Example: "3: eth0.100@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc ..."
        local iface vlan_id parent mtu state
        iface=$(echo "${line}" | awk -F': ' '{print $2}' | awk '{print $1}')
        vlan_id=$(echo "${line}" | grep -oP 'vlan id \K[0-9]+' || echo "unknown")
        parent=$(echo "${line}" | grep -oP '\K[^@]+(?=@)' | awk '{print $1}' || echo "unknown")
        mtu=$(echo "${line}" | grep -oP 'mtu \K[0-9]+' || echo "1500")

        # Determine state
        if echo "${line}" | grep -q "UP"; then
            state="UP"
        else
            state="DOWN"
        fi

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            json+=","
        fi

        json+="{\"name\":\"${iface}\",\"vlan_id\":${vlan_id},\"parent\":\"${parent}\",\"mtu\":${mtu},\"state\":\"${state}\"}"
    done <<< "${output}"

    json+="]"

    json_output true "${json}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        create)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: vlan.sh create <parent> <vlanId> [name] [mtu]"
                exit 1
            fi
            vlan_create "$2" "$3" "${4:-}" "${5:-}"
            ;;
        delete)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: vlan.sh delete <name>"
                exit 1
            fi
            vlan_delete "$2"
            ;;
        list)
            vlan_list
            ;;
        "")
            json_output false "{}" "Usage: vlan.sh {create|delete|list}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'. Usage: vlan.sh {create|delete|list}"
            exit 1
            ;;
    esac
}

main "$@"
