#!/bin/bash
# ip-config.sh — IP configuration management for StaySuite-HospitalityOS
# Usage:
#   ip-config.sh set-static <interface> <ip> <netmask> [gateway] [dns1] [dns2]
#   ip-config.sh set-dhcp <interface>
#   ip-config.sh flush <interface>
#   ip-config.sh set-mtu <interface> <mtu>
#   ip-config.sh up <interface>
#   ip-config.sh down <interface>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# ip_set_static <interface> <ip> <netmask> [gateway] [dns1] [dns2]
###############################################################################
ip_set_static() {
    local interface="$1"
    local ip="$2"
    local netmask="$3"
    local gateway="${4:-}"
    local dns1="${5:-}"
    local dns2="${6:-}"

    validate_interface_name "${interface}"
    validate_ipv4 "${ip}"

    local cidr
    cidr=$(netmask_to_cidr "${netmask}")
    if (( cidr < 0 || cidr > 32 )); then
        json_output false "{}" "Invalid netmask: '${netmask}'"
        return 1
    fi

    if [[ -n "${gateway}" ]]; then
        validate_ipv4 "${gateway}"
    fi

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    # Flush existing addresses
    run_cmd "Flush IPs on ${interface}" sudo ip addr flush dev "${interface}" || true

    # Add the new address
    if ! run_cmd "Add IP ${ip}/${cidr} to ${interface}" sudo ip addr add "${ip}/${cidr}" dev "${interface}"; then
        json_output false "{}" "Failed to set IP address '${ip}/${cidr}' on '${interface}'"
        return 1
    fi

    # Add default gateway if specified
    if [[ -n "${gateway}" ]]; then
        # Remove existing default route first
        run_cmd "Remove existing default route" sudo ip route del default dev "${interface}" 2>/dev/null || true
        if ! run_cmd "Add default gateway ${gateway} via ${interface}" sudo ip route add default via "${gateway}" dev "${interface}"; then
            log_warn "Failed to set default gateway (non-fatal)"
        fi
    fi

    # Write DNS if specified
    if [[ -n "${dns1}" ]]; then
        local dns_line="nameserver ${dns1}"
        if [[ -n "${dns2}" ]]; then
            dns_line+=$'\n'"nameserver ${dns2}"
        fi
        # Ensure resolv.conf head exists for managed entries
        if [[ -f "/etc/resolv.conf" ]]; then
            if ! grep -q "# STAYSUITE_MANAGED" /etc/resolv.conf 2>/dev/null; then
                # Backup
                cp /etc/resolv.conf /etc/resolv.conf.staysuite.bak 2>/dev/null || true
                {
                    echo "# STAYSUITE_MANAGED"
                    echo "${dns_line}"
                    echo "# END STAYSUITE_MANAGED"
                } > /etc/resolv.conf 2>/dev/null || true
            fi
        fi
    fi

    # Bring interface up
    run_cmd "Bring up ${interface}" sudo ip link set "${interface}" up || true

    log_info "Static IP configured: ${interface} -> ${ip}/${cidr} gateway=${gateway:-none}"
    json_output true "{\"interface\":\"${interface}\",\"ip\":\"${ip}\",\"cidr\":${cidr},\"netmask\":\"${netmask}\",\"gateway\":\"${gateway:-\"\"}\"}" ""
}

###############################################################################
# ip_set_dhcp <interface>
###############################################################################
ip_set_dhcp() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    # Flush existing addresses
    run_cmd "Flush IPs on ${interface}" sudo ip addr flush dev "${interface}" || true

    # Try dhclient first, fall back to systemctl
    if command -v dhclient &>/dev/null; then
        if ! run_cmd "Run dhclient on ${interface}" sudo dhclient "${interface}"; then
            log_warn "dhclient failed, trying systemctl restart networking"
            run_cmd "Restart networking" sudo systemctl restart networking || true
        fi
    else
        if ! run_cmd "Restart networking for DHCP" sudo systemctl restart networking; then
            json_output false "{}" "Failed to enable DHCP on '${interface}'"
            return 1
        fi
    fi

    log_info "DHCP enabled on ${interface}"
    json_output true "{\"interface\":\"${interface}\",\"mode\":\"dhcp\"}" ""
}

###############################################################################
# ip_flush <interface>
###############################################################################
ip_flush() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    if ! run_cmd "Flush IPs on ${interface}" sudo ip addr flush dev "${interface}"; then
        json_output false "{}" "Failed to flush IPs on '${interface}'"
        return 1
    fi

    log_info "All IPs flushed on ${interface}"
    json_output true "{\"interface\":\"${interface}\"}" ""
}

###############################################################################
# ip_set_mtu <interface> <mtu>
###############################################################################
ip_set_mtu() {
    local interface="$1"
    local mtu="$2"

    validate_interface_name "${interface}"
    validate_mtu "${mtu}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    if ! run_cmd "Set MTU ${mtu} on ${interface}" sudo ip link set "${interface}" mtu "${mtu}"; then
        json_output false "{}" "Failed to set MTU on '${interface}'"
        return 1
    fi

    log_info "MTU set to ${mtu} on ${interface}"
    json_output true "{\"interface\":\"${interface}\",\"mtu\":${mtu}}" ""
}

###############################################################################
# ip_up <interface>
###############################################################################
ip_up() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    if ! run_cmd "Bring up ${interface}" sudo ip link set "${interface}" up; then
        json_output false "{}" "Failed to bring up '${interface}'"
        return 1
    fi

    json_output true "{\"interface\":\"${interface}\",\"state\":\"up\"}" ""
}

###############################################################################
# ip_down <interface>
###############################################################################
ip_down() {
    local interface="$1"

    validate_interface_name "${interface}"

    if [[ ! -e "/sys/class/net/${interface}" ]]; then
        json_output false "{}" "Interface '${interface}' does not exist"
        return 1
    fi

    if ! run_cmd "Bring down ${interface}" sudo ip link set "${interface}" down; then
        json_output false "{}" "Failed to bring down '${interface}'"
        return 1
    fi

    json_output true "{\"interface\":\"${interface}\",\"state\":\"down\"}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        set-static)
            if (( $# < 4 )); then
                json_output false "{}" "Usage: ip-config.sh set-static <interface> <ip> <netmask> [gateway] [dns1] [dns2]"
                exit 1
            fi
            ip_set_static "$2" "$3" "$4" "${5:-}" "${6:-}" "${7:-}"
            ;;
        set-dhcp)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: ip-config.sh set-dhcp <interface>"
                exit 1
            fi
            ip_set_dhcp "$2"
            ;;
        flush)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: ip-config.sh flush <interface>"
                exit 1
            fi
            ip_flush "$2"
            ;;
        set-mtu)
            if (( $# < 3 )); then
                json_output false "{}" "Usage: ip-config.sh set-mtu <interface> <mtu>"
                exit 1
            fi
            ip_set_mtu "$2" "$3"
            ;;
        up)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: ip-config.sh up <interface>"
                exit 1
            fi
            ip_up "$2"
            ;;
        down)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: ip-config.sh down <interface>"
                exit 1
            fi
            ip_down "$2"
            ;;
        "")
            json_output false "{}" "Usage: ip-config.sh {set-static|set-dhcp|flush|set-mtu|up|down}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
