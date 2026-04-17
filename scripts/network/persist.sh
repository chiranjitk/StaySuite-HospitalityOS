#!/bin/bash
# persist.sh — Persistence to /etc/network/interfaces for StaySuite-HospitalityOS
# Usage:
#   persist.sh bridge <name> <stp> <forwardDelay> <members_json>
#   persist.sh remove-bridge <name>
#   persist.sh bond <name> <mode> <miimon> <lacpRate> <primary> <members_json>
#   persist.sh remove-bond <name>
#   persist.sh ip-config <interface> <mode> <ip> <netmask> <gateway> <dns1> <dns2>
#   persist.sh alias-add <interface> <ip> <netmask>
#   persist.sh alias-remove <interface> <ip>
#   persist.sh route-add <interface> <destination> <gateway>
#   persist.sh route-remove <interface> <destination> <gateway>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# File manipulation helpers
###############################################################################

# Backup the interfaces file
backup_interfaces() {
    if [[ -f "${INTERFACES_FILE}" ]]; then
        local backup="${INTERFACES_FILE}.staysuite.bak.$(date '+%Y%m%d%H%M%S')"
        cp "${INTERFACES_FILE}" "${backup}" 2>/dev/null || true
        log_info "Backed up ${INTERFACES_FILE} to ${backup}"
    fi
}

# Ensure the interfaces file exists
ensure_interfaces_file() {
    if [[ ! -f "${INTERFACES_FILE}" ]]; then
        mkdir -p "$(dirname "${INTERFACES_FILE}")" 2>/dev/null || true
        cat > "${INTERFACES_FILE}" << 'EOF'
# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

# The loopback network interface
auto lo
iface lo inet loopback
EOF
        log_info "Created default ${INTERFACES_FILE}"
    fi
}

# Remove a managed block from the interfaces file
# Usage: remove_block <marker-prefix>
remove_block() {
    local marker_prefix="$1"
    local begin_marker="${MANAGED_MARKER}: ${marker_prefix} BEGIN"
    local end_marker="${MANAGED_MARKER}: ${marker_prefix} END"

    if [[ -f "${INTERFACES_FILE}" ]]; then
        # Use sed to remove the block (including surrounding empty lines)
        sudo sed -i "/${begin_marker}/,/${end_marker}/d" "${INTERFACES_FILE}" 2>/dev/null || true
    fi
}

# Append a managed block to the interfaces file
# Usage: append_block <marker-prefix> <block_content>
append_block() {
    local marker_prefix="$1"
    local block_content="$2"

    ensure_interfaces_file

    # Remove existing block first
    remove_block "${marker_prefix}"

    # Append new block
    {
        echo ""
        echo "${MANAGED_MARKER}: ${marker_prefix} BEGIN"
        echo "${block_content}"
        echo "${MANAGED_MARKER}: ${marker_prefix} END"
    } | sudo tee -a "${INTERFACES_FILE}" > /dev/null
}

###############################################################################
# persist_bridge <name> <stp> <forwardDelay> <members_json>
###############################################################################
persist_bridge() {
    local name="$1"
    local stp="$2"
    local forward_delay="$3"
    local members_json="$4"

    validate_interface_name "${name}"

    backup_interfaces
    ensure_interfaces_file

    # Parse members from JSON array
    local members=""
    if [[ -n "${members_json}" && "${members_json}" != "[]" && "${members_json}" != "null" ]]; then
        # Remove brackets and quotes
        members=$(echo "${members_json}" | sed 's/[][]//g; s/"//g; s/,/ /g')
    fi

    local block=""
    block+="iface ${name} inet manual"
    if [[ -n "${members}" ]]; then
        block+=$'\n'"    bridge-ports ${members}"
    fi
    block+=$'\n'"    bridge-stp ${stp}"
    block+=$'\n'"    bridge-fd ${forward_delay}"

    append_block "bridge-${name}" "${block}"

    log_info "Bridge '${name}' configuration persisted to ${INTERFACES_FILE}"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# persist_remove_bridge <name>
###############################################################################
persist_remove_bridge() {
    local name="$1"

    validate_interface_name "${name}"

    backup_interfaces
    remove_block "bridge-${name}"

    log_info "Bridge '${name}' configuration removed from ${INTERFACES_FILE}"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# persist_bond <name> <mode> <miimon> <lacpRate> <primary> <members_json>
###############################################################################
persist_bond() {
    local name="$1"
    local mode="$2"
    local miimon="$3"
    local lacp_rate="$4"
    local primary="$5"
    local members_json="$6"

    validate_interface_name "${name}"

    backup_interfaces
    ensure_interfaces_file

    # Parse members from JSON array
    local members=""
    if [[ -n "${members_json}" && "${members_json}" != "[]" && "${members_json}" != "null" ]]; then
        members=$(echo "${members_json}" | sed 's/[][]//g; s/"//g; s/,/ /g')
    fi

    local block=""
    block+="iface ${name} inet manual"
    if [[ -n "${members}" ]]; then
        block+=$'\n'"    bond-slaves ${members}"
    fi
    block+=$'\n'"    bond-miimon ${miimon}"
    block+=$'\n'"    bond-mode ${mode}"
    if [[ "${mode}" == "802.3ad" ]]; then
        block+=$'\n'"    bond-lacp-rate ${lacp_rate}"
    fi
    if [[ -n "${primary}" && "${primary}" != "null" && "${primary}" != "none" ]]; then
        block+=$'\n'"    bond-primary ${primary}"
    fi

    append_block "bond-${name}" "${block}"

    log_info "Bond '${name}' configuration persisted to ${INTERFACES_FILE}"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# persist_remove_bond <name>
###############################################################################
persist_remove_bond() {
    local name="$1"

    validate_interface_name "${name}"

    backup_interfaces
    remove_block "bond-${name}"

    log_info "Bond '${name}' configuration removed from ${INTERFACES_FILE}"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# persist_ip_config <interface> <mode> <ip> <netmask> <gateway> <dns1> <dns2>
###############################################################################
persist_ip_config() {
    local interface="$1"
    local mode="$2"
    local ip="$3"
    local netmask="$4"
    local gateway="$5"
    local dns1="$6"
    local dns2="$7"

    validate_interface_name "${interface}"

    backup_interfaces
    ensure_interfaces_file

    local block=""
    local inet_method="dhcp"

    if [[ "${mode}" == "static" && -n "${ip}" && "${ip}" != "null" ]]; then
        inet_method="static"
        local cidr
        cidr=$(netmask_to_cidr "${netmask}")

        block+="iface ${interface} inet ${inet_method}"
        block+=$'\n'"    address ${ip}"
        if [[ -n "${cidr}" && "${cidr}" != "-1" ]]; then
            block+=$'\n'"    netmask ${netmask}"
        fi
        if [[ -n "${gateway}" && "${gateway}" != "null" && "${gateway}" != "" ]]; then
            block+=$'\n'"    gateway ${gateway}"
        fi
        if [[ -n "${dns1}" && "${dns1}" != "null" && "${dns1}" != "" ]]; then
            block+=$'\n'"    dns-nameservers ${dns1}"
            if [[ -n "${dns2}" && "${dns2}" != "null" && "${dns2}" != "" ]]; then
                block+=" ${dns2}"
            fi
        fi
    else
        block+="iface ${interface} inet dhcp"
    fi

    # Use auto stanza marker
    local marker_prefix="iface-${interface}"

    # Remove existing block
    remove_block "${marker_prefix}"

    # Check if there's an "auto" line for this interface
    if ! grep -q "^auto ${interface}" "${INTERFACES_FILE}" 2>/dev/null; then
        echo "auto ${interface}" | sudo tee -a "${INTERFACES_FILE}" > /dev/null
    fi

    append_block "${marker_prefix}" "${block}"

    log_info "IP config for '${interface}' persisted to ${INTERFACES_FILE}"
    json_output true "{\"interface\":\"${interface}\",\"mode\":\"${mode}\"}" ""
}

###############################################################################
# persist_alias_add <interface> <ip> <netmask>
###############################################################################
persist_alias_add() {
    local interface="$1"
    local ip="$2"
    local netmask="$3"

    validate_interface_name "${interface}"
    validate_ipv4 "${ip}"

    local cidr
    cidr=$(netmask_to_cidr "${netmask}")

    backup_interfaces
    ensure_interfaces_file

    local marker_prefix="alias-${interface}-${ip}"
    local block=""
    block+="    up ip addr add ${ip}/${cidr} dev ${interface}"
    block+=$'\n'"    down ip addr del ${ip}/${cidr} dev ${interface}"

    append_block "${marker_prefix}" "${block}"

    log_info "Alias ${ip}/${cidr} on ${interface} persisted to ${INTERFACES_FILE}"
    json_output true "{\"interface\":\"${interface}\",\"ip\":\"${ip}\",\"cidr\":${cidr}}" ""
}

###############################################################################
# persist_alias_remove <interface> <ip>
###############################################################################
persist_alias_remove() {
    local interface="$1"
    local ip="$2"

    validate_interface_name "${interface}"
    validate_ipv4 "${ip}"

    backup_interfaces
    remove_block "alias-${interface}-${ip}"

    log_info "Alias ${ip} on ${interface} removed from ${INTERFACES_FILE}"
    json_output true "{\"interface\":\"${interface}\",\"ip\":\"${ip}\"}" ""
}

###############################################################################
# persist_route_add <interface> <destination> <gateway>
###############################################################################
persist_route_add() {
    local interface="$1"
    local destination="$2"
    local gateway="$3"

    validate_interface_name "${interface}"
    validate_ipv4 "${gateway}"

    backup_interfaces
    ensure_interfaces_file

    local marker_prefix="route-${interface}-${destination}"
    local block=""
    block+="    up ip route add ${destination} via ${gateway} dev ${interface}"
    block+=$'\n'"    down ip route del ${destination} via ${gateway} dev ${interface}"

    append_block "${marker_prefix}" "${block}"

    log_info "Route ${destination} via ${gateway} on ${interface} persisted"
    json_output true "{\"interface\":\"${interface}\",\"destination\":\"${destination}\",\"gateway\":\"${gateway}\"}" ""
}

###############################################################################
# persist_route_remove <interface> <destination> <gateway>
###############################################################################
persist_route_remove() {
    local interface="$1"
    local destination="$2"
    local gateway="$3"

    validate_interface_name "${interface}"

    backup_interfaces
    remove_block "route-${interface}-${destination}"

    log_info "Route ${destination} on ${interface} removed from ${INTERFACES_FILE}"
    json_output true "{\"interface\":\"${interface}\",\"destination\":\"${destination}\"}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        bridge)
            if (( $# < 5 )); then
                json_output false "{}" "Usage: persist.sh bridge <name> <stp> <forwardDelay> <members_json>"
                exit 1
            fi
            persist_bridge "$2" "$3" "$4" "$5"
            ;;
        remove-bridge)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: persist.sh remove-bridge <name>"
                exit 1
            fi
            persist_remove_bridge "$2"
            ;;
        bond)
            if (( $# < 7 )); then
                json_output false "{}" "Usage: persist.sh bond <name> <mode> <miimon> <lacpRate> <primary> <members_json>"
                exit 1
            fi
            persist_bond "$2" "$3" "$4" "$5" "$6" "$7"
            ;;
        remove-bond)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: persist.sh remove-bond <name>"
                exit 1
            fi
            persist_remove_bond "$2"
            ;;
        ip-config)
            if (( $# < 8 )); then
                json_output false "{}" "Usage: persist.sh ip-config <interface> <mode> <ip> <netmask> <gateway> <dns1> <dns2>"
                exit 1
            fi
            persist_ip_config "$2" "$3" "$4" "$5" "$6" "$7" "$8"
            ;;
        alias-add)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: persist.sh alias-add <interface> <ip> <netmask>"
                exit 1
            fi
            persist_alias_add "$2" "$3" "$4"
            ;;
        alias-remove)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: persist.sh alias-remove <interface> <ip>"
                exit 1
            fi
            persist_alias_remove "$2" "$3"
            ;;
        route-add)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: persist.sh route-add <interface> <destination> <gateway>"
                exit 1
            fi
            persist_route_add "$2" "$3" "$4"
            ;;
        route-remove)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: persist.sh route-remove <interface> <destination> <gateway>"
                exit 1
            fi
            persist_route_remove "$2" "$3" "$4"
            ;;
        "")
            json_output false "{}" "Usage: persist.sh {bridge|remove-bridge|bond|remove-bond|ip-config|alias-add|alias-remove|route-add|route-remove}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
