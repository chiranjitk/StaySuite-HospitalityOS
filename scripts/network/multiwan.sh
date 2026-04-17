#!/bin/bash
# multiwan.sh — Multi-WAN configuration for StaySuite-HospitalityOS
# Usage:
#   multiwan.sh apply-weighted <config_json>
#   multiwan.sh apply-failover <config_json>
#   multiwan.sh apply-round-robin <config_json>
#   multiwan.sh reset
#   multiwan.sh deploy-monitor <config_json>
#
# Config JSON format:
# {
#   "interfaces": [
#     {"name": "eth0", "gateway": "10.0.0.1", "weight": 10, "subnet": "10.0.0.0/24", "metric": 100},
#     {"name": "eth1", "gateway": "20.0.0.1", "weight": 5,  "subnet": "20.0.0.0/24", "metric": 200}
#   ],
#   "monitor": {"enabled": true, "interval": 30, "targets": ["8.8.8.8", "1.1.1.1"]}
# }

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Custom nftables chain name
NFT_CHAIN="staysuite_wan"
NFT_TABLE="staysuite_mangle"

###############################################################################
# Parse JSON config using python3
# Outputs lines of: key=value for each interface entry
###############################################################################
parse_config() {
    local config_json="$1"
    echo "${config_json}" | python3 -c "
import json, sys
config = json.load(sys.stdin)
ifaces = config.get('interfaces', [])
for i, iface in enumerate(ifaces):
    name = iface.get('name', '')
    gateway = iface.get('gateway', '')
    weight = iface.get('weight', 1)
    subnet = iface.get('subnet', '')
    metric = iface.get('metric', 100)
    print(f'IFACE_{i}_NAME={name}')
    print(f'IFACE_{i}_GATEWAY={gateway}')
    print(f'IFACE_{i}_WEIGHT={weight}')
    print(f'IFACE_{i}_SUBNET={subnet}')
    print(f'IFACE_{i}_METRIC={metric}')
print(f'IFACE_COUNT={len(ifaces)}')

monitor = config.get('monitor', {})
print(f'MONITOR_ENABLED={monitor.get(\"enabled\", False)}')
print(f'MONITOR_INTERVAL={monitor.get(\"interval\", 30)}')
targets = monitor.get('targets', [])
print(f'MONITOR_TARGETS={\",\".join(targets)}')
" 2>/dev/null
}

###############################################################################
# Setup nftables mangle table for multi-WAN
###############################################################################
setup_nftables() {
    # Create table and chain if they don't exist
    sudo nft list table "${NFT_TABLE}" &>/dev/null || \
        sudo nft add table "${NFT_TABLE}" 2>/dev/null || true

    sudo nft list chain "${NFT_TABLE}" "${NFT_CHAIN}" &>/dev/null || \
        sudo nft add chain "${NFT_TABLE}" "${NFT_CHAIN}" '{ type filter hook postrouting priority mangle ; }' 2>/dev/null || true

    log_info "nftables table ${NFT_TABLE} chain ${NFT_CHAIN} ready"
}

###############################################################################
# Setup per-interface routing tables
###############################################################################
setup_routing_tables() {
    local iface_name="$1"
    local table_num="$2"
    local subnet="$3"

    # Add to rt_tables if not present
    if ! grep -q "${iface_name}" /etc/iproute2/rt_tables 2>/dev/null; then
        echo "${table_num}    ${iface_name}" | sudo tee -a /etc/iproute2/rt_tables > /dev/null
    fi

    # Add route to table
    sudo ip route flush table "${table_num}" 2>/dev/null || true
    sudo ip route add "${subnet}" dev "${iface_name}" table "${table_num}" 2>/dev/null || true
}

###############################################################################
# multiwan_apply_weighted <config_json>
###############################################################################
multiwan_apply_weighted() {
    local config_json="$1"

    log_info "Applying weighted ECMP multi-WAN configuration"

    # Parse config
    local parsed
    parsed=$(parse_config "${config_json}")
    eval "${parsed}"

    if (( IFACE_COUNT < 2 )); then
        json_output false "{}" "Weighted ECMP requires at least 2 WAN interfaces"
        return 1
    fi

    # Build nexthop route command
    local route_cmd="sudo ip route replace default"
    local interfaces_json="["
    local first=true

    for (( i = 0; i < IFACE_COUNT; i++ )); do
        eval "local name=\$IFACE_${i}_NAME"
        eval "local gateway=\$IFACE_${i}_GATEWAY"
        eval "local weight=\$IFACE_${i}_WEIGHT"
        eval "local subnet=\$IFACE_${i}_SUBNET"
        eval "local metric=\$IFACE_${i}_METRIC"

        validate_interface_name "${name}"
        validate_ipv4 "${gateway}"

        route_cmd+=" nexthop via ${gateway} weight ${weight} dev ${name}"

        # Per-table routing
        local table_num=$((MULTIWAN_TABLE_START + i))
        setup_routing_tables "${name}" "${table_num}" "${subnet}"

        # Policy rule: traffic from this subnet uses this table
        sudo ip rule add from "${subnet}" lookup "${table_num}" 2>/dev/null || \
            sudo ip rule replace from "${subnet}" lookup "${table_num}" 2>/dev/null || true

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            interfaces_json+=","
        fi
        interfaces_json+="{\"name\":\"${name}\",\"gateway\":\"${gateway}\",\"weight\":${weight},\"table\":${table_num}}"
    done
    interfaces_json+="]"

    # Remove existing default route
    sudo ip route del default 2>/dev/null || true

    # Apply the multi-path route
    if ! run_cmd "Apply weighted ECMP route" ${route_cmd}; then
        json_output false "{}" "Failed to apply weighted ECMP route"
        return 1
    fi

    log_info "Weighted ECMP multi-WAN applied with ${IFACE_COUNT} interfaces"
    json_output true "{\"mode\":\"weighted\",\"interfaces\":${interfaces_json}}" ""
}

###############################################################################
# multiwan_apply_failover <config_json>
###############################################################################
multiwan_apply_failover() {
    local config_json="$1"

    log_info "Applying failover multi-WAN configuration"

    local parsed
    parsed=$(parse_config "${config_json}")
    eval "${parsed}"

    if (( IFACE_COUNT < 2 )); then
        json_output false "{}" "Failover requires at least 2 WAN interfaces"
        return 1
    fi

    # Remove existing default route
    sudo ip route del default 2>/dev/null || true

    local interfaces_json="["
    local first=true

    for (( i = 0; i < IFACE_COUNT; i++ )); do
        eval "local name=\$IFACE_${i}_NAME"
        eval "local gateway=\$IFACE_${i}_GATEWAY"
        eval "local subnet=\$IFACE_${i}_SUBNET"
        eval "local metric=\$IFACE_${i}_METRIC"

        validate_interface_name "${name}"
        validate_ipv4 "${gateway}"

        local table_num=$((MULTIWAN_TABLE_START + i))
        setup_routing_tables "${name}" "${table_num}" "${subnet}"

        # Primary gets metric 100, backups get higher metrics
        local route_metric=$((100 + (i * 100)))

        if (( i == 0 )); then
            # Primary
            if ! run_cmd "Add primary default route" sudo ip route add default via "${gateway}" dev "${name}" metric "${route_metric}"; then
                json_output false "{}" "Failed to add primary default route"
                return 1
            fi
        else
            # Backup with higher metric
            if ! run_cmd "Add backup default route via ${name}" sudo ip route add default via "${gateway}" dev "${name}" metric "${route_metric}"; then
                log_warn "Failed to add backup route for ${name} (non-fatal)"
            fi
        fi

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            interfaces_json+=","
        fi
        interfaces_json+="{\"name\":\"${name}\",\"gateway\":\"${gateway}\",\"metric\":${route_metric},\"role\":\"$([ ${i} -eq 0 ] && echo 'primary' || echo 'backup')\",\"table\":${table_num}}"
    done
    interfaces_json+="]"

    log_info "Failover multi-WAN applied with ${IFACE_COUNT} interfaces"
    json_output true "{\"mode\":\"failover\",\"interfaces\":${interfaces_json}}" ""
}

###############################################################################
# multiwan_apply_round_robin <config_json>
###############################################################################
multiwan_apply_round_robin() {
    local config_json="$1"

    log_info "Applying round-robin ECMP multi-WAN configuration"

    local parsed
    parsed=$(parse_config "${config_json}")
    eval "${parsed}"

    if (( IFACE_COUNT < 2 )); then
        json_output false "{}" "Round-robin ECMP requires at least 2 WAN interfaces"
        return 1
    fi

    # Round-robin is ECMP with equal weights
    local route_cmd="sudo ip route replace default"
    local interfaces_json="["
    local first=true

    for (( i = 0; i < IFACE_COUNT; i++ )); do
        eval "local name=\$IFACE_${i}_NAME"
        eval "local gateway=\$IFACE_${i}_GATEWAY"
        eval "local subnet=\$IFACE_${i}_SUBNET"

        validate_interface_name "${name}"
        validate_ipv4 "${gateway}"

        # Equal weight of 1 for round-robin
        route_cmd+=" nexthop via ${gateway} weight 1 dev ${name}"

        local table_num=$((MULTIWAN_TABLE_START + i))
        setup_routing_tables "${name}" "${table_num}" "${subnet}"

        sudo ip rule add from "${subnet}" lookup "${table_num}" 2>/dev/null || \
            sudo ip rule replace from "${subnet}" lookup "${table_num}" 2>/dev/null || true

        if [[ "${first}" == "true" ]]; then
            first=false
        else
            interfaces_json+=","
        fi
        interfaces_json+="{\"name\":\"${name}\",\"gateway\":\"${gateway}\",\"weight\":1,\"table\":${table_num}}"
    done
    interfaces_json+="]"

    # Remove existing default route
    sudo ip route del default 2>/dev/null || true

    if ! run_cmd "Apply round-robin ECMP route" ${route_cmd}; then
        json_output false "{}" "Failed to apply round-robin ECMP route"
        return 1
    fi

    log_info "Round-robin ECMP multi-WAN applied with ${IFACE_COUNT} interfaces"
    json_output true "{\"mode\":\"round-robin\",\"interfaces\":${interfaces_json}}" ""
}

###############################################################################
# multiwan_reset
###############################################################################
multiwan_reset() {
    log_info "Resetting all multi-WAN configuration"

    local errors=0

    # Flush custom routing tables
    for table_num in $(seq "${MULTIWAN_TABLE_START}" "${MULTIWAN_TABLE_END}"); do
        sudo ip route flush table "${table_num}" 2>/dev/null || true
    done

    # Remove custom policy rules
    local rules
    rules=$(sudo ip rule show | grep "lookup ${MULTIWAN_TABLE_START}" || true)
    while IFS= read -r rule; do
        [[ -z "${rule}" ]] && continue
        local pref
        pref=$(echo "${rule}" | awk '{print $1}')
        sudo ip rule del pref "${pref}" 2>/dev/null || true
    done <<< "${rules}"

    # Also remove rules for any table in our range
    for table_num in $(seq "${MULTIWAN_TABLE_START}" "${MULTIWAN_TABLE_END}"); do
        rules=$(sudo ip rule show | grep "lookup ${table_num}" || true)
        while IFS= read -r rule; do
            [[ -z "${rule}" ]] && continue
            local pref
            pref=$(echo "${rule}" | awk '{print $1}')
            sudo ip rule del pref "${pref}" 2>/dev/null || (( errors++ )) || true
        done <<< "${rules}"
    done

    # Remove nftables chain
    sudo nft delete chain "${NFT_TABLE}" "${NFT_CHAIN}" 2>/dev/null || true
    sudo nft delete table "${NFT_TABLE}" 2>/dev/null || true

    # Clean up rt_tables entries
    sudo sed -i "/staysuite/d" /etc/iproute2/rt_tables 2>/dev/null || true

    log_info "Multi-WAN configuration reset complete"
    json_output true "{\"message\":\"All multi-WAN rules, routes, and tables have been reset\"}" ""
}

###############################################################################
# multiwan_deploy_monitor <config_json>
###############################################################################
multiwan_deploy_monitor() {
    local config_json="$1"

    log_info "Deploying WAN health monitor"

    local parsed
    parsed=$(parse_config "${config_json}")
    eval "${parsed}"

    local monitor_script="/etc/network/staysuite-wan-monitor.sh"
    local interval="${MONITOR_INTERVAL:-30}"
    local enabled="${MONITOR_ENABLED:-false}"
    local targets="${MONITOR_TARGETS:-8.8.8.8,1.1.1.1}"

    if [[ "${enabled}" != "True" && "${enabled}" != "true" ]]; then
        log_info "WAN monitoring disabled in config"
        json_output true "{\"message\":\"WAN monitoring disabled\",\"script\":\"${monitor_script}\"}" ""
        return 0
    fi

    # Parse interfaces for the monitor
    local iface_list=""
    local gateway_list=""
    for (( i = 0; i < IFACE_COUNT; i++ )); do
        eval "local name=\$IFACE_${i}_NAME"
        eval "local gateway=\$IFACE_${i}_GATEWAY"
        iface_list+="${name} "
        gateway_list+="${gateway} "
    done

    # Convert targets to array-like string
    local target_arr
    target_arr=$(echo "${targets}" | sed 's/,/ /g')

    sudo mkdir -p /etc/network 2>/dev/null || true

    cat << 'MONITOR_EOF' | sudo tee "${monitor_script}" > /dev/null
#!/bin/bash
# StaySuite WAN Health Monitor
# Auto-deployed by multiwan.sh
# This script monitors WAN interface health and triggers failover

set -euo pipefail

LOG_FILE="/var/log/staysuite/wan-monitor.log"
STATE_FILE="/var/run/staysuite/wan-state.json"
INTERVAL=__INTERVAL__
INTERFACES=(__IFACES__)
GATEWAYS=(__GATEWAYS__)
TARGETS=(__TARGETS__)

mkdir -p "$(dirname "${LOG_FILE}")" "$(dirname "${STATE_FILE}")" 2>/dev/null || true

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}" 2>/dev/null || true
}

ping_test() {
    local target="$1"
    local iface="$2"
    local count=3
    local timeout=2

    if ping -I "${iface}" -c "${count}" -W "${timeout}" "${target}" &>/dev/null; then
        return 0
    fi
    return 1
}

check_interface() {
    local iface="$1"
    local idx="$2"
    local gateway="${GATEWAYS[${idx}]}"
    local up=false

    # Test each target
    for target in "${TARGETS[@]}"; do
        if ping_test "${target}" "${iface}"; then
            up=true
            break
        fi
    done

    # Also check gateway reachability
    if [[ "${up}" == "true" ]]; then
        ping_test "${gateway}" "${iface}" || up=false
    fi

    if [[ "${up}" == "true" ]]; then
        log_msg "WAN ${iface} (${gateway}) is UP"
        echo "1"
    else
        log_msg "WAN ${iface} (${gateway}) is DOWN"
        echo "0"
    fi
}

write_state() {
    local state_json="{\"timestamp\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
    state_json+="\"interfaces\":["

    local first=true
    for i in "${!INTERFACES[@]}"; do
        local status
        status=$(check_interface "${INTERFACES[${i}]}" "${i}")
        if [[ "${first}" == "true" ]]; then
            first=false
        else
            state_json+=","
        fi
        state_json+="{\"name\":\"${INTERFACES[${i}]}\",\"gateway\":\"${GATEWAYS[${i}]}\",\"up\":${status}}"
    done

    state_json+="]}"
    echo "${state_json}" > "${STATE_FILE}"
}

# Main loop
while true; do
    write_state
    sleep "${INTERVAL}"
done
MONITOR_EOF

    # Replace placeholders
    sudo sed -i "s/__INTERVAL__/${interval}/g" "${monitor_script}"
    sudo sed -i "s/__IFACES__/$(echo ${iface_list} | sed 's/ /","/g; s/^/"/; s/$/"/' | tr -d '\n')/g" "${monitor_script}"
    sudo sed -i "s/__GATEWAYS__/$(echo ${gateway_list} | sed 's/ /","/g; s/^/"/; s/$/"/' | tr -d '\n')/g" "${monitor_script}"
    sudo sed -i "s/__TARGETS__/$(echo ${target_arr} | sed 's/ /","/g; s/^/"/; s/$/"/' | tr -d '\n')/g" "${monitor_script}"

    sudo chmod +x "${monitor_script}"

    log_info "WAN monitor deployed to ${monitor_script}"
    json_output true "{\"script\":\"${monitor_script}\",\"interval\":${interval},\"targets\":\"${targets}\"}" ""
}

###############################################################################
# Main
###############################################################################
main() {
    local action="${1:-}"

    case "${action}" in
        apply-weighted)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: multiwan.sh apply-weighted <config_json>"
                exit 1
            fi
            multiwan_apply_weighted "$2"
            ;;
        apply-failover)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: multiwan.sh apply-failover <config_json>"
                exit 1
            fi
            multiwan_apply_failover "$2"
            ;;
        apply-round-robin)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: multiwan.sh apply-round-robin <config_json>"
                exit 1
            fi
            multiwan_apply_round_robin "$2"
            ;;
        reset)
            multiwan_reset
            ;;
        deploy-monitor)
            if (( $# < 2 )); then
                json_output false "{}" "Usage: multiwan.sh deploy-monitor <config_json>"
                exit 1
            fi
            multiwan_deploy_monitor "$2"
            ;;
        "")
            json_output false "{}" "Usage: multiwan.sh {apply-weighted|apply-failover|apply-round-robin|reset|deploy-monitor}"
            exit 1
            ;;
        *)
            json_output false "{}" "Unknown action: '${action}'"
            exit 1
            ;;
    esac
}

main "$@"
