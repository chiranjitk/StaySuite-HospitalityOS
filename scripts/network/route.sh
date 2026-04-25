#!/bin/bash
# route.sh — Routing management for StaySuite-HospitalityOS
# Usage:
#   route.sh add <destination> <gateway> [metric] [interface]
#   route.sh delete <destination> <gateway>
#   route.sh list
#   route.sh add-default <gateway> [interface]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# route_add <destination> <gateway> [metric] [interface]
###############################################################################
route_add() {
    local destination="$1"
    local gateway="$2"
    local metric="${3:-}"
    local interface="${4:-}"

    validate_ipv4 "${gateway}"

    # Validate destination (can be IP/CIDR or just IP)
    if [[ "${destination}" != */* ]]; then
        validate_ipv4 "${destination}"
    else
        local dest_ip
        dest_ip="${destination%/*}"
        validate_ipv4 "${dest_ip}"
    fi

    local cmd=(sudo ip route add "${destination}" via "${gateway}")
    if [[ -n "${interface}" ]]; then
        validate_interface_name "${interface}"
        cmd+=(dev "${interface}")
    fi
    if [[ -n "${metric}" ]]; then
        cmd+=(metric "${metric}")
    fi

    if ! run_cmd "Add route ${destination} via ${gateway}" "${cmd[@]}"; then
        json_output false "{}" "Failed to add route ${destination} via ${gateway}"
        return 1
    fi

    log_info "Route added: ${destination} via ${gateway}"
    json_output true "{\"destination\":\"${destination}\",\"gateway\":\"${gateway}\",\"metric\":${metric:-0},\"interface\":\"${interface:-\"\"}\"}" ""
}

###############################################################################
# route_delete <destination> <gateway>
###############################################################################
route_delete() {
    local destination="$1"
    local gateway="$2"

    validate_ipv4 "${gateway}"

    if [[ "${destination}" != */* ]]; then
        validate_ipv4 "${destination}"
    else
        local dest_ip
        dest_ip="${destination%/*}"
        validate_ipv4 "${dest_ip}"
    fi

    if ! run_cmd "Delete route ${destination} via ${gateway}" sudo ip route del "${destination}" via "${gateway}"; then
        json_output false "{}" "Failed to delete route ${destination} via ${gateway}"
        return 1
    fi

    log_info "Route deleted: ${destination} via ${gateway}"
    json_output true "{\"destination\":\"${destination}\",\"gateway\":\"${gateway}\"}" ""
}

###############################################################################
# route_list
###############################################################################
route_list() {
    local output
    output=$(ip -o route show 2>&1)

    if [[ -z "${output}" ]]; then
        json_output true "[]" ""
        return 0
    fi

    local routes_json="["
    local first=true

    while IFS= read -r line; do
        # Example: "default via 192.168.1.1 dev eth0 proto dhcp metric 100"
        # Example: "10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.1"
        local dest gateway dev src metric proto scope

        dest=$(echo "${line}" | awk '{print $1}')
        gateway=$(echo "${line}" | grep -oP 'via \K[0-9.]+' || echo "")
        dev=$(echo "${line}" | grep -oP 'dev \K[a-zA-Z0-9._-]+' || echo "")
        src=$(echo "${line}" | grep -oP 'src \K[0-9.]+' || echo "")
        metric=$(echo "${line}" | grep -oP 'metric \K[0-9]+' || echo "0")
        proto=$(echo "${line}" | grep -oP 'proto \K\w+' || echo "unknown")
        scope=$(echo "${line}" | grep -oP 'scope \K\w+' || echo "")

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            routes_json+=","
        fi

        routes_json+="{\"destination\":\"${dest}\",\"gateway\":\"${gateway}\",\"dev\":\"${dev}\",\"src\":\"${src}\",\"metric\":${metric},\"proto\":\"${proto}\",\"scope\":\"${scope}\"}"
    done <<< "${output}"

    routes_json+="]"

    json_output true "${routes_json}" ""
}

###############################################################################
# route_add_default <gateway> [interface]
###############################################################################
route_add_default() {
    local gateway="$1"
    local interface="${2:-}"

    validate_ipv4 "${gateway}"

    local cmd=(sudo ip route add default via "${gateway}")
    if [[ -n "${interface}" ]]; then
        validate_interface_name "${interface}"
        cmd+=(dev "${interface}")
    fi

    if ! run_cmd "Add default route via ${gateway}" "${cmd[@]}"; then
        json_output false "{}" "Failed to add default route via ${gateway}"
        return 1
    fi

    log_info "Default route added: via ${gateway}"
    json_output true "{\"destination\":\"default\",\"gateway\":\"${gateway}\",\"interface\":\"${interface:-\"\"}\"}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        add)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: route.sh add <destination> <gateway> [metric] [interface]"
                exit 1
            fi
            route_add "$2" "$3" "${4:-}" "${5:-}"
            ;;
        delete)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: route.sh delete <destination> <gateway>"
                exit 1
            fi
            route_delete "$2" "$3"
            ;;
        list)
            route_list
            ;;
        add-default)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: route.sh add-default <gateway> [interface]"
                exit 1
            fi
            route_add_default "$2" "${3:-}"
            ;;
        "")
            json_output false "{}" "Usage: route.sh {add|delete|list|add-default}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
