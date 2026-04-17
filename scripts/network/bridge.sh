#!/bin/bash
# bridge.sh — Bridge interface management for StaySuite-HospitalityOS
# Usage:
#   bridge.sh create <name> [--stp <on|off>] [--forward-delay <N>] [--members <m1>,<m2>]
#   bridge.sh delete <name>
#   bridge.sh add-member <bridge> <member>
#   bridge.sh remove-member <bridge> <member>
#   bridge.sh list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# Parse options for create
###############################################################################
parse_bridge_options() {
    local stp="${DEFAULT_STP}"
    local forward_delay="${DEFAULT_FORWARD_DELAY}"
    local members=""

    while (( $# > 0 )); do
        case "$1" in
            --stp)
                stp="$2"
                if [[ "${stp}" != "on" && "${stp}" != "off" ]]; then
                    json_output false "{}" "STP must be 'on' or 'off'"
                    return 1
                fi
                shift 2
                ;;
            --forward-delay)
                forward_delay="$2"
                shift 2
                ;;
            --members)
                members="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    BRIDGE_STP="${stp}"
    BRIDGE_FORWARD_DELAY="${forward_delay}"
    BRIDGE_MEMBERS="${members}"
}

# Globals set by parse_bridge_options
BRIDGE_STP=""
BRIDGE_FORWARD_DELAY=""
BRIDGE_MEMBERS=""

###############################################################################
# bridge_create <name> [options...]
###############################################################################
bridge_create() {
    local name="$1"
    shift

    validate_interface_name "${name}"

    # Check if bridge already exists
    if [[ -e "/sys/class/net/${name}" ]]; then
        log_error "Bridge '${name}' already exists"
        json_output false "{}" "Bridge '${name}' already exists"
        return 1
    fi

    # Parse options
    parse_bridge_options "$@"

    local stp_state=0
    if [[ "${BRIDGE_STP}" == "on" ]]; then
        stp_state=1
    fi

    # Create bridge
    if ! run_cmd "Create bridge ${name}" sudo ip link add name "${name}" type bridge; then
        json_output false "{}" "Failed to create bridge '${name}'"
        return 1
    fi

    # Set STP and forward delay
    if ! run_cmd "Configure bridge ${name}" sudo ip link set "${name}" type bridge stp_state "${stp_state}" forward_delay "${BRIDGE_FORWARD_DELAY}"; then
        log_warn "Failed to configure bridge settings, cleaning up"
        run_cmd "Delete bridge ${name} (rollback)" sudo ip link del "${name}" || true
        json_output false "{}" "Failed to configure bridge '${name}'"
        return 1
    fi

    # Add members if specified
    local members_json="["
    local first_member=true
    if [[ -n "${BRIDGE_MEMBERS}" ]]; then
        IFS=',' read -ra member_list <<< "${BRIDGE_MEMBERS}"
        for member in "${member_list[@]}"; do
            member="$(echo "${member}" | xargs)" # trim whitespace
            validate_interface_name "${member}"

            if [[ ! -e "/sys/class/net/${member}" ]]; then
                log_error "Member interface '${member}' does not exist"
                # Rollback
                run_cmd "Delete bridge ${name} (rollback)" sudo ip link del "${name}" || true
                json_output false "{}" "Member interface '${member}' does not exist"
                return 1
            fi

            if ! run_cmd "Add member ${member} to ${name}" sudo ip link set "${member}" master "${name}"; then
                log_warn "Failed to add member '${member}', cleaning up"
                run_cmd "Delete bridge ${name} (rollback)" sudo ip link del "${name}" || true
                json_output false "{}" "Failed to add member '${member}' to bridge '${name}'"
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

    # Bring bridge up
    if ! run_cmd "Bring up bridge ${name}" sudo ip link set "${name}" up; then
        log_warn "Failed to bring up bridge, cleaning up"
        run_cmd "Delete bridge ${name} (rollback)" sudo ip link del "${name}" || true
        json_output false "{}" "Failed to bring up bridge '${name}'"
        return 1
    fi

    log_info "Bridge '${name}' created successfully (stp=${BRIDGE_STP}, forward_delay=${BRIDGE_FORWARD_DELAY})"
    json_output true "{\"name\":\"${name}\",\"stp\":\"${BRIDGE_STP}\",\"forward_delay\":${BRIDGE_FORWARD_DELAY},\"members\":${members_json}}" ""
}

###############################################################################
# bridge_delete <name>
###############################################################################
bridge_delete() {
    local name="$1"

    validate_interface_name "${name}"

    if [[ ! -e "/sys/class/net/${name}" ]]; then
        log_error "Bridge '${name}' does not exist"
        json_output false "{}" "Bridge '${name}' does not exist"
        return 1
    fi

    # Remove all members first
    local members_output
    members_output=$(ip -j link show "${name}" 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data and 'ifname' in data[0]:
    info = data[0].get('linkinfo', {}).get('info_slave_data', {})
    print(info.get('slave_list', ''))
" 2>/dev/null || echo "")

    if [[ -n "${members_output}" ]]; then
        # Parse the slave list - ip -j format varies; use bridge link as fallback
        local member
        while IFS= read -r member; do
            member=$(echo "${member}" | awk '{print $2}')
            if [[ -n "${member}" ]]; then
                run_cmd "Remove member ${member} from ${name}" sudo ip link set "${member}" nomaster || true
            fi
        done < <(bridge link 2>/dev/null | grep "${name}" || true)
    fi

    if ! run_cmd "Delete bridge ${name}" sudo ip link del "${name}"; then
        json_output false "{}" "Failed to delete bridge '${name}'"
        return 1
    fi

    log_info "Bridge '${name}' deleted successfully"
    json_output true "{\"name\":\"${name}\"}" ""
}

###############################################################################
# bridge_add_member <bridge> <member>
###############################################################################
bridge_add_member() {
    local bridge="$1"
    local member="$2"

    validate_interface_name "${bridge}"
    validate_interface_name "${member}"

    if [[ ! -e "/sys/class/net/${bridge}" ]]; then
        json_output false "{}" "Bridge '${bridge}' does not exist"
        return 1
    fi

    if [[ ! -e "/sys/class/net/${member}" ]]; then
        json_output false "{}" "Interface '${member}' does not exist"
        return 1
    fi

    if ! run_cmd "Add member ${member} to ${bridge}" sudo ip link set "${member}" master "${bridge}"; then
        json_output false "{}" "Failed to add '${member}' to bridge '${bridge}'"
        return 1
    fi

    json_output true "{\"bridge\":\"${bridge}\",\"member\":\"${member}\"}" ""
}

###############################################################################
# bridge_remove_member <bridge> <member>
###############################################################################
bridge_remove_member() {
    local bridge="$1"
    local member="$2"

    validate_interface_name "${bridge}"
    validate_interface_name "${member}"

    if ! run_cmd "Remove member ${member} from ${bridge}" sudo ip link set "${member}" nomaster; then
        json_output false "{}" "Failed to remove '${member}' from bridge '${bridge}'"
        return 1
    fi

    json_output true "{\"bridge\":\"${bridge}\",\"member\":\"${member}\"}" ""
}

###############################################################################
# bridge_list
###############################################################################
bridge_list() {
    local bridges_json="["
    local first=true

    # List all bridge interfaces
    while IFS= read -r line; do
        local bridge_name
        bridge_name=$(echo "${line}" | awk -F': ' '{print $2}' | awk '{print $1}')
        [[ -z "${bridge_name}" ]] && continue

        # Get STP state
        local stp="off"
        local fd=15
        if [[ -f "/sys/class/net/${bridge_name}/bridge/stp_state" ]]; then
            local stp_val
            stp_val=$(cat "/sys/class/net/${bridge_name}/bridge/stp_state" 2>/dev/null || echo "0")
            if [[ "${stp_val}" == "1" ]]; then
                stp="on"
            fi
        fi

        if [[ -f "/sys/class/net/${bridge_name}/bridge/forward_delay" ]]; then
            fd=$(cat "/sys/class/net/${bridge_name}/bridge/forward_delay" 2>/dev/null || echo "15")
        fi

        # Get state
        local state="DOWN"
        if [[ -f "/sys/class/net/${bridge_name}/operstate" ]]; then
            state=$(cat "/sys/class/net/${bridge_name}/operstate" 2>/dev/null || echo "DOWN")
        fi

        # Get members
        local members_json_arr="["
        local first_m=true
        while IFS= read -r mline; do
            local miface
            miface=$(echo "${mline}" | awk '{print $2}')
            [[ -z "${miface}" ]] && continue
            if [[ "${first_m}" == "true" ]]; then
                first_m=false
            else
                members_json_arr+=","
            fi
            members_json_arr+="\"${miface}\""
        done < <(bridge link 2>/dev/null | grep -v "^$" || true)
        members_json_arr+="]"

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            bridges_json+=","
        fi

        bridges_json+="{\"name\":\"${bridge_name}\",\"stp\":\"${stp}\",\"forward_delay\":${fd},\"state\":\"${state}\",\"members\":${members_json_arr}}"
    done < <(ip -o link show type bridge 2>/dev/null || true)

    bridges_json+="]"

    json_output true "${bridges_json}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        create)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: bridge.sh create <name> [--stp <on|off>] [--forward-delay <N>] [--members <m1>,<m2>]"
                exit 1
            fi
            bridge_create "$2" "${@:3}"
            ;;
        delete)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: bridge.sh delete <name>"
                exit 1
            fi
            bridge_delete "$2"
            ;;
        add-member)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: bridge.sh add-member <bridge> <member>"
                exit 1
            fi
            bridge_add_member "$2" "$3"
            ;;
        remove-member)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: bridge.sh remove-member <bridge> <member>"
                exit 1
            fi
            bridge_remove_member "$2" "$3"
            ;;
        list)
            bridge_list
            ;;
        "")
            json_output false "{}" "Usage: bridge.sh {create|delete|add-member|remove-member|list}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
