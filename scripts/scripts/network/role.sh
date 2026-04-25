#!/bin/bash
# role.sh — Interface role management for StaySuite-HospitalityOS
# Usage:
#   role.sh set <interface> <role> [priority]
#   role.sh remove <interface>
#   role.sh list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Valid roles
VALID_ROLES=("wan" "lan" "dmz" "management" "wifi" "guest" "iot" "unused")

###############################################################################
# Validate role
###############################################################################
validate_role() {
    local role="$1"
    local valid=false
    for r in "${VALID_ROLES[@]}"; do
        if [[ "${role}" == "${r}" ]]; then
            valid=true
            break
        fi
    done
    if [[ "${valid}" == "false" ]]; then
        log_error "Invalid role: '${role}'"
        json_output false "{}" "Invalid role: '${role}'. Valid roles: ${VALID_ROLES[*]}"
        return 1
    fi
}

###############################################################################
# role_set <interface> <role> [priority]
###############################################################################
role_set() {
    local interface="$1"
    local role="$2"
    local priority="${3:-0}"

    validate_interface_name "${interface}"
    validate_role "${role}"

    # Validate priority is a number
    if ! [[ "${priority}" =~ ^[0-9]+$ ]]; then
        json_output false "{}" "Priority must be a non-negative integer"
        return 1
    fi

    ensure_interfaces_file

    backup_interfaces

    # Check if the interface stanza exists in the file
    local iface_exists
    iface_exists=$(grep -c "^iface ${interface}" "${INTERFACES_FILE}" 2>/dev/null || echo "0")

    if (( iface_exists == 0 )); then
        # Create a basic interface stanza with the role
        local block="iface ${interface} inet dhcp"
        local marker_prefix="iface-${interface}"

        # Check for auto line
        if ! grep -q "^auto ${interface}" "${INTERFACES_FILE}" 2>/dev/null; then
            echo "auto ${interface}" | sudo tee -a "${INTERFACES_FILE}" > /dev/null
        fi

        append_block_role "${marker_prefix}" "${block}" "${role}" "${priority}"
    else
        # Find the iface line and add role comment after it
        # First remove any existing role comments for this interface
        remove_role_from_file "${interface}"

        # Add role comment after the iface line
        sudo sed -i "/^iface ${interface} /a\\    ${ROLE_MARKER}: ${role}\n    ${PRIORITY_MARKER}: ${priority}" "${INTERFACES_FILE}" 2>/dev/null || true
    fi

    log_info "Role '${role}' set on interface '${interface}' (priority=${priority})"
    json_output true "{\"interface\":\"${interface}\",\"role\":\"${role}\",\"priority\":${priority}}" ""
}

###############################################################################
# Helper: Append a block with role markers (for new interface stanzas)
###############################################################################
append_block_role() {
    local marker_prefix="$1"
    local block_content="$2"
    local role="$3"
    local priority="$4"

    ensure_interfaces_file

    # Remove existing block
    remove_block "${marker_prefix}"

    # Append new block with role
    {
        echo ""
        echo "${MANAGED_MARKER}: ${marker_prefix} BEGIN"
        echo "${block_content}"
        echo "    ${ROLE_MARKER}: ${role}"
        echo "    ${PRIORITY_MARKER}: ${priority}"
        echo "${MANAGED_MARKER}: ${marker_prefix} END"
    } | sudo tee -a "${INTERFACES_FILE}" > /dev/null
}

###############################################################################
# Helper: Remove existing role comments for an interface
###############################################################################
remove_role_from_file() {
    local interface="$1"

    if [[ -f "${INTERFACES_FILE}" ]]; then
        # Remove role and priority comments that belong to this interface
        # We need to find them in the context of the interface stanza
        sudo sed -i "/^iface ${interface}/,/iface /{
            /${ROLE_MARKER}/d
            /${PRIORITY_MARKER}/d
        }" "${INTERFACES_FILE}" 2>/dev/null || true

        # Also handle the last interface stanza (no following iface line)
        sudo sed -i "/^iface ${interface}/,\${
            /${ROLE_MARKER}/d
            /${PRIORITY_MARKER}/d
        }" "${INTERFACES_FILE}" 2>/dev/null || true
    fi
}

###############################################################################
# role_remove <interface>
###############################################################################
role_remove() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -f "${INTERFACES_FILE}" ]]; then
        json_output true "{\"interface\":\"${interface}\"}" ""
        return 0
    fi

    backup_interfaces
    remove_role_from_file "${interface}"

    log_info "Role removed from interface '${interface}'"
    json_output true "{\"interface\":\"${interface}\"}" ""
}

###############################################################################
# role_list
###############################################################################
role_list() {
    local roles_json="["
    local first=true

    if [[ -f "${INTERFACES_FILE}" ]]; then
        local current_iface=""
        local current_role=""
        local current_priority="0"

        while IFS= read -r line; do
            # Check for interface stanza
            if [[ "${line}" =~ ^iface[[:space:]]+([a-zA-Z0-9._-]+) ]]; then
                # Save previous interface if it had a role
                if [[ -n "${current_iface}" && -n "${current_role}" ]]; then
                    if [[ "${first}" == "true" ]]; then
                        first=false
                    else
                        roles_json+=","
                    fi
                    roles_json+="{\"interface\":\"${current_iface}\",\"role\":\"${current_role}\",\"priority\":${current_priority}}"
                fi
                current_iface="${BASH_REMATCH[1]}"
                current_role=""
                current_priority="0"
            fi

            # Check for role comment
            if [[ "${line}" =~ ${ROLE_MARKER}:[[:space:]]*(\w+) ]]; then
                current_role="${BASH_REMATCH[1]}"
            fi

            # Check for priority comment
            if [[ "${line}" =~ ${PRIORITY_MARKER}:[[:space:]]*([0-9]+) ]]; then
                current_priority="${BASH_REMATCH[1]}"
            fi
        done < "${INTERFACES_FILE}"

        # Don't forget the last interface
        if [[ -n "${current_iface}" && -n "${current_role}" ]]; then
            if [[ "${first}" == "true" ]]; then
                first=false
            else
                roles_json+=","
            fi
            roles_json+="{\"interface\":\"${current_iface}\",\"role\":\"${current_role}\",\"priority\":${current_priority}}"
        fi
    fi

    roles_json+="]"

    json_output true "${roles_json}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        set)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: role.sh set <interface> <role> [priority]"
                exit 1
            fi
            role_set "$2" "$3" "${4:-0}"
            ;;
        remove)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: role.sh remove <interface>"
                exit 1
            fi
            role_remove "$2"
            ;;
        list)
            role_list
            ;;
        "")
            json_output false "{}" "Usage: role.sh {set|remove|list}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
