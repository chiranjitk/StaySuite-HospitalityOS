#!/bin/bash
# alias.sh — IP alias management for StaySuite-HospitalityOS
# Usage:
#   alias.sh add <interface> <ip> <netmask>
#   alias.sh remove <interface> <ip> <netmask>
#   alias.sh list <interface>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# alias_add <interface> <ip> <netmask>
###############################################################################
alias_add() {
    local interface="$1"
    local ip="$2"
    local netmask="$3"

    validate_interface_name "${interface}"
    validate_ipv4 "${ip}"

    # Validate netmask
    local cidr
    cidr=$(netmask_to_cidr "${netmask}")
    if (( cidr < 0 || cidr > 32 )); then
        json_output false "{}" "Invalid netmask: '${netmask}'"
        return 1
    fi

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    # Check if alias already exists
    local existing
    existing=$(ip -4 -o addr show dev "${interface}" 2>/dev/null | grep "${ip}/${cidr}" || true)
    if [[ -n "${existing}" ]]; then
        json_output false "{}" "IP alias ${ip}/${cidr} already exists on '${interface}'"
        return 1
    fi

    if ! run_cmd "Add IP alias ${ip}/${cidr} to ${interface}" sudo ip addr add "${ip}/${cidr}" dev "${interface}"; then
        json_output false "{}" "Failed to add IP alias '${ip}/${cidr}' to '${interface}'"
        return 1
    fi

    log_info "IP alias ${ip}/${cidr} added to ${interface}"
    json_output true "{\"interface\":\"${interface}\",\"ip\":\"${ip}\",\"netmask\":\"${netmask}\",\"cidr\":${cidr}}" ""
}

###############################################################################
# alias_remove <interface> <ip> <netmask>
###############################################################################
alias_remove() {
    local interface="$1"
    local ip="$2"
    local netmask="$3"

    validate_interface_name "${interface}"
    validate_ipv4 "${ip}"

    local cidr
    cidr=$(netmask_to_cidr "${netmask}")
    if (( cidr < 0 || cidr > 32 )); then
        json_output false "{}" "Invalid netmask: '${netmask}'"
        return 1
    fi

    if ! run_cmd "Remove IP alias ${ip}/${cidr} from ${interface}" sudo ip addr del "${ip}/${cidr}" dev "${interface}"; then
        json_output false "{}" "Failed to remove IP alias '${ip}/${cidr}' from '${interface}'"
        return 1
    fi

    log_info "IP alias ${ip}/${cidr} removed from ${interface}"
    json_output true "{\"interface\":\"${interface}\",\"ip\":\"${ip}\",\"netmask\":\"${netmask}\"}" ""
}

###############################################################################
# alias_list <interface>
###############################################################################
alias_list() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    local output
    output=$(ip -4 -o addr show dev "${interface}" 2>/dev/null || echo "")

    if [[ -z "${output}" ]]; then
        json_output true "{\"interface\":\"${interface}\",\"aliases\":[]}" ""
        return 0
    fi

    local aliases_json="["
    local first=true

    while IFS= read -r line; do
        # Example: "2: eth0    inet 192.168.1.1/24 brd 192.168.1.255 scope global eth0"
        local ip cidr scope
        ip=$(echo "${line}" | grep -oP 'inet \K[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')
        cidr=$(echo "${line}" | grep -oP 'inet [0-9.]+/\K[0-9]+')
        scope=$(echo "${line}" | grep -oP 'scope \K\w+' || echo "global")

        # Skip if no IP found
        [[ -z "${ip}" ]] && continue

        # Convert CIDR to netmask for display
        local netmask="0.0.0.0"
        case "${cidr}" in
            0)  netmask="0.0.0.0" ;;
            1)  netmask="128.0.0.0" ;;
            2)  netmask="192.0.0.0" ;;
            3)  netmask="224.0.0.0" ;;
            4)  netmask="240.0.0.0" ;;
            5)  netmask="248.0.0.0" ;;
            6)  netmask="252.0.0.0" ;;
            7)  netmask="254.0.0.0" ;;
            8)  netmask="255.0.0.0" ;;
            9)  netmask="255.128.0.0" ;;
            10) netmask="255.192.0.0" ;;
            11) netmask="255.224.0.0" ;;
            12) netmask="255.240.0.0" ;;
            13) netmask="255.248.0.0" ;;
            14) netmask="255.252.0.0" ;;
            15) netmask="255.254.0.0" ;;
            16) netmask="255.255.0.0" ;;
            17) netmask="255.255.128.0" ;;
            18) netmask="255.255.192.0" ;;
            19) netmask="255.255.224.0" ;;
            20) netmask="255.255.240.0" ;;
            21) netmask="255.255.248.0" ;;
            22) netmask="255.255.252.0" ;;
            23) netmask="255.255.254.0" ;;
            24) netmask="255.255.255.0" ;;
            25) netmask="255.255.255.128" ;;
            26) netmask="255.255.255.192" ;;
            27) netmask="255.255.255.224" ;;
            28) netmask="255.255.255.240" ;;
            29) netmask="255.255.255.248" ;;
            30) netmask="255.255.255.252" ;;
            31) netmask="255.255.255.254" ;;
            32) netmask="255.255.255.255" ;;
        esac

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            aliases_json+=","
        fi

        aliases_json+="{\"ip\":\"${ip}\",\"cidr\":${cidr},\"netmask\":\"${netmask}\",\"scope\":\"${scope}\"}"
    done <<< "${output}"

    aliases_json+="]"

    json_output true "{\"interface\":\"${interface}\",\"aliases\":${aliases_json}}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        add)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: alias.sh add <interface> <ip> <netmask>"
                exit 1
            fi
            alias_add "$2" "$3" "$4"
            ;;
        remove)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: alias.sh remove <interface> <ip> <netmask>"
                exit 1
            fi
            alias_remove "$2" "$3" "$4"
            ;;
        list)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: alias.sh list <interface>"
                exit 1
            fi
            alias_list "$2"
            ;;
        "")
            json_output false "{}" "Usage: alias.sh {add|remove|list}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
