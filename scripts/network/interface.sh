#!/bin/bash
# interface.sh — Interface listing and info for StaySuite-HospitalityOS
# Usage:
#   interface.sh list
#   interface.sh info <name>
#   interface.sh stats <name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

###############################################################################
# Read a sysfs file safely
###############################################################################
read_sysfs() {
    local path="$1"
    if [[ -f "${path}" ]]; then
        cat "${path}" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

###############################################################################
# Detect interface type
###############################################################################
detect_iface_type() {
    local name="$1"
    local sys_path="/sys/class/net/${name}"

    if [[ -d "${sys_path}/bridge" ]]; then
        echo "bridge"
    elif [[ -f "/proc/net/bonding/${name}" ]]; then
        echo "bond"
    elif [[ -d "${sys_path}/device" ]] && [[ -L "${sys_path}/device" ]]; then
        # Check if it's a VLAN
        if [[ -f "${sys_path}/type" ]]; then
            local iface_type
            iface_type=$(read_sysfs "${sys_path}/type")
            if [[ "${iface_type}" == "1" ]]; then
                # Could be VLAN or physical; check master
                if [[ -L "${sys_path}/master" ]]; then
                    echo "slave"
                else
                    # Check if there's a VLAN subdirectory
                    if [[ -d "${sys_path}/upper_${name%.*}" ]] 2>/dev/null || echo "${name}" | grep -q '\.'; then
                        echo "vlan"
                    else
                        echo "ethernet"
                    fi
                fi
            else
                echo "unknown"
            fi
        else
            echo "ethernet"
        fi
    elif [[ -L "${sys_path}/master" ]]; then
        echo "slave"
    else
        echo "unknown"
    fi
}

###############################################################################
# Get interface IPs as JSON array
###############################################################################
get_iface_ips() {
    local name="$1"
    local output
    output=$(ip -4 -o addr show dev "${name}" 2>/dev/null || echo "")

    if [[ -z "${output}" ]]; then
        echo "[]"
        return 0
    fi

    local json="["
    local first=true

    while IFS= read -r line; do
        local ip cidr
        ip=$(echo "${line}" | grep -oP 'inet \K[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')
        cidr=$(echo "${line}" | grep -oP 'inet [0-9.]+/\K[0-9]+')
        [[ -z "${ip}" ]] && continue

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            json+=","
        fi
        json+="{\"ip\":\"${ip}\",\"cidr\":${cidr}}"
    done <<< "${output}"

    json+="]"
    echo "${json}"
}

###############################################################################
# interface_list
###############################################################################
interface_list() {
    local interfaces_json="["
    local first=true

    for iface_path in /sys/class/net/*; do
        [[ -e "${iface_path}" ]] || continue
        local name
        name="$(basename "${iface_path}")"

        # Skip loopback
        [[ "${name}" == "lo" ]] && continue

        local mac mtu state type rx_bytes tx_bytes
        local sys_path="/sys/class/net/${name}"

        mac=$(read_sysfs "${sys_path}/address")
        mtu=$(read_sysfs "${sys_path}/mtu")
        state=$(read_sysfs "${sys_path}/operstate")
        rx_bytes=$(read_sysfs "${sys_path}/statistics/rx_bytes")
        tx_bytes=$(read_sysfs "${sys_path}/statistics/tx_bytes")
        type=$(detect_iface_type "${name}")

        # Handle empty stats
        rx_bytes="${rx_bytes:-0}"
        tx_bytes="${tx_bytes:-0}"

        local ips
        ips=$(get_iface_ips "${name}")

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            interfaces_json+=","
        fi

        interfaces_json+="{"
        interfaces_json+="\"name\":\"${name}\","
        interfaces_json+="\"type\":\"${type}\","
        interfaces_json+="\"mac\":\"${mac}\","
        interfaces_json+="\"mtu\":${mtu},"
        interfaces_json+="\"state\":\"${state}\","
        interfaces_json+="\"ips\":${ips},"
        interfaces_json+="\"rx_bytes\":${rx_bytes},"
        interfaces_json+="\"tx_bytes\":${tx_bytes}"
        interfaces_json+="}"
    done

    interfaces_json+="]"

    json_output true "${interfaces_json}" ""
}

###############################################################################
# interface_info <name>
###############################################################################
interface_info() {
    local name="$1"

    validate_interface_name "${name}"

    if [[ ! -e "/sys/class/net/${name}" ]]; then
        json_output false "{}" "Interface '${name}' does not exist"
        return 1
    fi

    local sys_path="/sys/class/net/${name}"

    local mac mtu state type speed duplex carrier
    local rx_bytes tx_bytes rx_packets tx_packets rx_errors tx_errors rx_dropped tx_dropped
    local flags

    mac=$(read_sysfs "${sys_path}/address")
    mtu=$(read_sysfs "${sys_path}/mtu")
    state=$(read_sysfs "${sys_path}/operstate")
    type=$(detect_iface_type "${name}")
    speed=$(read_sysfs "${sys_path}/speed")
    duplex=$(read_sysfs "${sys_path}/duplex")
    carrier=$(read_sysfs "${sys_path}/carrier")

    rx_bytes=$(read_sysfs "${sys_path}/statistics/rx_bytes")
    tx_bytes=$(read_sysfs "${sys_path}/statistics/tx_bytes")
    rx_packets=$(read_sysfs "${sys_path}/statistics/rx_packets")
    tx_packets=$(read_sysfs "${sys_path}/statistics/tx_packets")
    rx_errors=$(read_sysfs "${sys_path}/statistics/rx_errors")
    tx_errors=$(read_sysfs "${sys_path}/statistics/tx_errors")
    rx_dropped=$(read_sysfs "${sys_path}/statistics/rx_dropped")
    tx_dropped=$(read_sysfs "${sys_path}/statistics/tx_dropped")

    # Default empty values
    speed="${speed:-0}"
    duplex="${duplex:-unknown}"
    carrier="${carrier:-0}"
    rx_bytes="${rx_bytes:-0}"
    tx_bytes="${tx_bytes:-0}"
    rx_packets="${rx_packets:-0}"
    tx_packets="${tx_packets:-0}"
    rx_errors="${rx_errors:-0}"
    tx_errors="${tx_errors:-0}"
    rx_dropped="${rx_dropped:-0}"
    tx_dropped="${tx_dropped:-0}"

    local ips
    ips=$(get_iface_ips "${name}")

    # Get master if slave
    local master=""
    if [[ -L "${sys_path}/master" ]]; then
        master="$(basename "$(readlink "${sys_path}/master")")"
    fi

    # Get bridge members if bridge
    local members_json="[]"
    if [[ "${type}" == "bridge" ]]; then
        local members="["
        local first_m=true
        while IFS= read -r mline; do
            local miface
            miface=$(echo "${mline}" | awk '{print $2}')
            [[ -z "${miface}" ]] && continue
            if [[ "${first_m}" == "true" ]]; then
                first_m=false
            else
                members+=","
            fi
            members+="\"${miface}\""
        done < <(bridge link 2>/dev/null | grep -v "^$" || true)
        members+="]"
        members_json="${members}"
    fi

    # Get bond info if bond
    local bond_mode="" bond_members_json="[]"
    if [[ "${type}" == "bond" ]] && [[ -f "/proc/net/bonding/${name}" ]]; then
        bond_mode=$(grep "Bonding Mode:" "/proc/net/bonding/${name}" 2>/dev/null | sed 's/Bonding Mode: //' | awk '{print $1}' || echo "unknown")
        local bmembers="["
        local first_bm=true
        while IFS= read -r bmember; do
            bmember="$(echo "${bmember}" | xargs)"
            [[ -z "${bmember}" ]] && continue
            if [[ "${first_bm}" == "true" ]]; then
                first_bm=false
            else
                bmembers+=","
            fi
            bmembers+="\"${bmember}\""
        done < <(grep "Slave Interface:" "/proc/net/bonding/${name}" 2>/dev/null | awk '{print $3}' || true)
        bmembers+="]"
        bond_members_json="${bmembers}"
    fi

    json_output true "{"
    json_output true ""  # not used; building manually below

    # Build the JSON manually since json_output is simple
    local timestamp
    timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

    printf '{"success":true,"data":{'
    printf '"name":"%s",' "${name}"
    printf '"type":"%s",' "${type}"
    printf '"mac":"%s",' "${mac}"
    printf '"mtu":%s,' "${mtu}"
    printf '"state":"%s",' "${state}"
    printf '"speed":%s,' "${speed}"
    printf '"duplex":"%s",' "${duplex}"
    printf '"carrier":%s,' "${carrier}"
    printf '"master":"%s",' "${master}"
    printf '"ips":%s,' "${ips}"
    printf '"members":%s,' "${members_json}"
    printf '"bond_mode":"%s",' "${bond_mode}"
    printf '"bond_members":%s,' "${bond_members_json}"
    printf '"rx_bytes":%s,' "${rx_bytes}"
    printf '"tx_bytes":%s,' "${tx_bytes}"
    printf '"rx_packets":%s,' "${rx_packets}"
    printf '"tx_packets":%s,' "${tx_packets}"
    printf '"rx_errors":%s,' "${rx_errors}"
    printf '"tx_errors":%s,' "${tx_errors}"
    printf '"rx_dropped":%s,' "${rx_dropped}"
    printf '"tx_dropped":%s' "${tx_dropped}"
    printf '},"error":"","timestamp":"%s"}\n' "${timestamp}"
}

###############################################################################
# interface_stats <name>
###############################################################################
interface_stats() {
    local name="$1"

    validate_interface_name "${name}"

    if [[ ! -e "/sys/class/net/${name}" ]]; then
        json_output false "{}" "Interface '${name}' does not exist"
        return 1
    fi

    local sys_path="/sys/class/net/${name}"

    local rx_bytes tx_bytes rx_packets tx_packets rx_errors tx_errors
    local rx_dropped tx_dropped rx_fifo tx_fifo rx_frame tx_collisions
    local rx_multicast tx_compressed rx_compressed

    rx_bytes=$(read_sysfs "${sys_path}/statistics/rx_bytes")
    tx_bytes=$(read_sysfs "${sys_path}/statistics/tx_bytes")
    rx_packets=$(read_sysfs "${sys_path}/statistics/rx_packets")
    tx_packets=$(read_sysfs "${sys_path}/statistics/tx_packets")
    rx_errors=$(read_sysfs "${sys_path}/statistics/rx_errors")
    tx_errors=$(read_sysfs "${sys_path}/statistics/tx_errors")
    rx_dropped=$(read_sysfs "${sys_path}/statistics/rx_dropped")
    tx_dropped=$(read_sysfs "${sys_path}/statistics/tx_dropped")
    rx_fifo=$(read_sysfs "${sys_path}/statistics/rx_fifo_errors")
    tx_fifo=$(read_sysfs "${sys_path}/statistics/tx_fifo_errors")
    rx_frame=$(read_sysfs "${sys_path}/statistics/rx_frame_errors")
    tx_collisions=$(read_sysfs "${sys_path}/statistics/collisions")
    rx_multicast=$(read_sysfs "${sys_path}/statistics/multicast")
    tx_compressed=$(read_sysfs "${sys_path}/statistics/tx_compressed")
    rx_compressed=$(read_sysfs "${sys_path}/statistics/rx_compressed")

    # Default empty values
    rx_bytes="${rx_bytes:-0}"; tx_bytes="${tx_bytes:-0}"
    rx_packets="${rx_packets:-0}"; tx_packets="${tx_packets:-0}"
    rx_errors="${rx_errors:-0}"; tx_errors="${tx_errors:-0}"
    rx_dropped="${rx_dropped:-0}"; tx_dropped="${tx_dropped:-0}"
    rx_fifo="${rx_fifo:-0}"; tx_fifo="${tx_fifo:-0}"
    rx_frame="${rx_frame:-0}"; tx_collisions="${tx_collisions:-0}"
    rx_multicast="${rx_multicast:-0}"
    tx_compressed="${tx_compressed:-0}"; rx_compressed="${rx_compressed:-0}"

    json_output true "{"
    local timestamp
    timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

    printf '{"success":true,"data":{'
    printf '"interface":"%s",' "${name}"
    printf '"rx":{"bytes":%s,"packets":%s,"errors":%s,"dropped":%s,"fifo_errors":%s,"frame_errors":%s,"multicast":%s,"compressed":%s},' \
        "${rx_bytes}" "${rx_packets}" "${rx_errors}" "${rx_dropped}" "${rx_fifo}" "${rx_frame}" "${rx_multicast}" "${rx_compressed}"
    printf '"tx":{"bytes":%s,"packets":%s,"errors":%s,"dropped":%s,"fifo_errors":%s,"collisions":%s,"compressed":%s}' \
        "${tx_bytes}" "${tx_packets}" "${tx_errors}" "${tx_dropped}" "${tx_fifo}" "${tx_collisions}" "${tx_compressed}"
    printf '},"error":"","timestamp":"%s"}\n' "${timestamp}"
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        list)
            interface_list
            ;;
        info)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: interface.sh info <name>"
                exit 1
            fi
            interface_info "$2"
            ;;
        stats)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: interface.sh stats <name>"
                exit 1
            fi
            interface_stats "$2"
            ;;
        "")
            json_output false "{}" "Usage: interface.sh {list|info|stats}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
