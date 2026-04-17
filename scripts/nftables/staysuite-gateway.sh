#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — Gateway Firewall Script (nftables)
#
#  Equivalent of 24Online's defaultchains.sh, rewritten for nftables
#  on Rocky Linux 10.
#
#  Called during: System boot, NAS component start/restart, dhcp-service
#                start/restart, nftables-service /api/apply
#
#  Architecture:
#    1. Flush all existing StaySuite nftables rules
#    2. Create nftables tables (inet filter, inet nat, inet mangle)
#    3. Create nft sets for user management (authenticated, deny, etc.)
#    4. Create custom chains (open, accounting, portal_redirect, firewall)
#    5. Add per-interface rules (reads .nmconnection files from
#       /etc/NetworkManager/system-connections/)
#    6. Add captive portal redirect rules for unauthenticated users
#    7. Add authenticated user passthrough (via nft sets)
#    8. Add accounting/connmark rules for bandwidth tracking
#    9. Add MASQUERADE for WAN outbound traffic
#    10. Add security rules (drop SMB, SYN flood, fragments)
#    11. Save ruleset to /etc/nftables.d/staysuite.conf
#
#  Tables:
#    inet staysuite_filter  — filter rules (input, forward, output)
#    inet staysuite_nat     — NAT rules (prerouting, postrouting)
#    inet staysuite_mangle  — mangle rules (prerouting, postrouting, input, output)
#
#  Dynamic operations (runtime, via nft CLI or nftables-service API):
#    nft add element inet staysuite_mangle authenticated_users { 192.168.1.50 }
#    nft delete element inet staysuite_mangle authenticated_users { 192.168.1.50 }
#
#  See: staysuite-user-auth.sh for add/remove authenticated user helpers
#
###########################################################################

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
#  Configuration
# ═══════════════════════════════════════════════════════════════════════════

STAYSUITE_DIR="${STAYSUITE_DIR:-/usr/local/staysuite}"
PROPERTIES_DIR="${STAYSUITE_DIR}/properties"
NM_CONNS_DIR="/etc/NetworkManager/system-connections"
NFTABLES_CONF_DIR="/etc/nftables.d"
NFTABLES_CONF="${NFTABLES_CONF_DIR}/staysuite.conf"
LOG_TAG="staysuite-gateway"
LOG_FILE="${STAYSUITE_DIR}/logs/gateway.log"

# ─── Portal ports (24Online: 8888 HTTP, 8443 HTTPS) ────────────────────
PORTAL_HTTP_PORT="${PORTAL_HTTP_PORT:-3080}"
PORTAL_HTTPS_PORT="${PORTAL_HTTPS_PORT:-3443}"
GUI_PORT="${GUI_PORT:-3000}"
DNS_PORT="${DNS_PORT:-53}"
DHCP_PORT="${DHCP_PORT:-67}"

# ─── Open management ports ─────────────────────────────────────────────
# 22=SSH, 80/443=HTTP/HTTPS, 3000=GUI, 3010=RADIUS, 3011=DHCP, 3012=DNS, 3013=nftables
OPEN_TCP_PORTS="${OPEN_TCP_PORTS:-22,80,443,3000,3010,3011,3012,3013,3080,3443}"
OPEN_UDP_PORTS="${OPEN_UDP_PORTS:-53,67,68}"

# ─── Captive portal redirect (24Online: mark 10000=HTTP, 20000=HTTPS) ─
MARK_HTTP_REDIRECT=10000
MARK_HTTPS_REDIRECT=20000
MARK_AUTHENTICATED=30000

# ─── Rate limiting for unauthenticated users (24Online: 230/min) ───────
HTTP_RATE="${HTTP_RATE:-230/minute}"
HTTP_BURST="${HTTP_BURST:-40}"
HTTPS_RATE="${HTTPS_RATE:-230/minute}"
HTTPS_BURST="${HTTPS_BURST:-40}"

# ─── Multi-gateway ─────────────────────────────────────────────────────
MULTI_GW_ENABLED="${MULTI_GW_ENABLED:-N}"

# ─── Nettype constants (must match src/lib/network/nettypes.ts) ────────
#  0=LAN, 1=WAN, 2=VLAN, 3=Bridge, 4=Bond, 5=Management, 6=Guest, 7=IoT,
#  8=Unused, 9=DMZ, 10=WiFi
NETTYPE_LAN=0
NETTYPE_WAN=1
NETTYPE_VLAN=2
NETTYPE_BRIDGE=3
NETTYPE_BOND=4
NETTYPE_MANAGEMENT=5
NETTYPE_GUEST=6
NETTYPE_IOT=7
NETTYPE_UNUSED=8
NETTYPE_DMZ=9
NETTYPE_WIFI=10

# ─── nftables table names ──────────────────────────────────────────────
TBL_FILTER="inet staysuite_filter"
TBL_NAT="inet staysuite_nat"
TBL_MANGLE="inet staysuite_mangle"

# ═══════════════════════════════════════════════════════════════════════════
#  Utility Functions
# ═══════════════════════════════════════════════════════════════════════════

log() {
    local level="${1:-INFO}"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*" \
        | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*"
}

# Read value from .nmconnection INI file
# Usage: nm_get file section key
nm_get() {
    local file="$1" section="$2" key="$3"
    # Parse INI: look for [section] then key=value within that section
    awk -v section="$section" -v key="$key" '
        /^\[/ { in_section = ($0 == "[" section "]") }
        in_section && $1 == key && /=/ {
            sub(/^[^=]*=[[:space:]]*/, "", $0)
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
            # Remove surrounding quotes
            gsub(/^["\x27]|["\x27]$/, "", $0)
            print; exit
        }
    ' "$file" 2>/dev/null
}

# Get nettype from [staysuite] section
nm_get_nettype() {
    nm_get "$1" staysuite nettype
}

# Get interface type from [connection] section
nm_get_type() {
    nm_get "$1" connection type
}

# Get interface name from [connection] section
nm_get_ifname() {
    nm_get "$1" connection interface-name
}

# Get IPv4 method (manual/dhcp/disabled)
nm_get_ipv4_method() {
    nm_get "$1" ipv4 method
}

# Get first IPv4 address (strips CIDR if present)
nm_get_ipv4_addr() {
    local file="$1"
    local method addr1
    method=$(nm_get "$file" ipv4 method)
    if [ "$method" = "manual" ] || [ "$method" = "static" ]; then
        addr1=$(nm_get "$file" ipv4 address1)
        [ -n "$addr1" ] && echo "${addr1%%/*}"
    fi
}

# Get IPv4 CIDR prefix
nm_get_ipv4_prefix() {
    local file="$1"
    local method addr1
    method=$(nm_get "$file" ipv4 method)
    if [ "$method" = "manual" ] || [ "$method" = "static" ]; then
        addr1=$(nm_get "$file" ipv4 address1)
        if [[ "$addr1" == *"/"* ]]; then
            echo "${addr1#*/}"
        else
            echo "24"
        fi
    fi
}

# Get IPv4 gateway
nm_get_ipv4_gw() {
    local file="$1"
    nm_get "$file" ipv4 gateway
}

# Convert CIDR prefix to netmask (24 → 255.255.255.0)
cidr_to_netmask() {
    local cidr=$1
    local n=0 mask=""
    for i in 1 2 3 4; do
        local bits=$((cidr > 8 ? 8 : cidr))
        mask="${mask}$((256 - (256 >> bits)))."
        cidr=$((cidr - bits))
    done
    echo "${mask%.}"
}

# Check if nft command is available
check_nftables() {
    if ! command -v nft &>/dev/null; then
        log "ERROR" "nftables not installed. Run: dnf install nftables"
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 1: Flush All Existing StaySuite Rules
#  (24Online equivalent: iptables -t mangle -F, iptables -X, etc.)
# ═══════════════════════════════════════════════════════════════════════════

flush_all() {
    log "STEP 1: Flushing all StaySuite nftables rules..."

    # Delete our custom tables (this removes ALL chains and sets within them)
    nft delete table inet staysuite_filter 2>/dev/null || true
    nft delete table inet staysuite_nat     2>/dev/null || true
    nft delete table inet staysuite_mangle  2>/dev/null || true

    log "Flush complete."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 2: Create Tables & Base Chains
#  (24Online equivalent: creating mangle, nat, filter tables implicitly)
# ═══════════════════════════════════════════════════════════════════════════

create_tables() {
    log "STEP 2: Creating nftables tables and base chains..."

    # ─── inet staysuite_filter ──────────────────────────────────────────
    nft add table inet staysuite_filter

    # input: traffic destined to the server itself
    nft 'add chain inet staysuite_filter input { type filter hook input priority 0; policy accept; }'

    # forward: traffic passing through (gateway/NAT)
    nft 'add chain inet staysuite_filter forward { type filter hook forward priority 0; policy drop; }'

    # output: traffic originating from the server
    nft 'add chain inet staysuite_filter output { type filter hook output priority 0; policy accept; }'

    # ─── inet staysuite_nat ────────────────────────────────────────────
    nft add table inet staysuite_nat

    # prerouting: DNAT/redirect (before routing decision)
    nft 'add chain inet staysuite_nat prerouting { type nat hook prerouting priority dstnat; }'

    # postrouting: SNAT/masquerade (after routing decision)
    nft 'add chain inet staysuite_nat postrouting { type nat hook postrouting priority srcnat; }'

    # ─── inet staysuite_mangle ─────────────────────────────────────────
    nft add table inet staysuite_mangle

    nft 'add chain inet staysuite_mangle prerouting  { type filter hook prerouting priority mangle; }'
    nft 'add chain inet staysuite_mangle postrouting { type filter hook postrouting priority mangle; }'
    nft 'add chain inet staysuite_mangle input      { type filter hook input priority mangle; }'
    nft 'add chain inet staysuite_mangle output     { type filter hook output priority mangle; }'

    log "Tables created: staysuite_filter, staysuite_nat, staysuite_mangle"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 3: Create Sets (replaces ipset)
#  (24Online equivalent: ipset -N loggedinusers hash:net, usersset list:set, etc.)
# ═══════════════════════════════════════════════════════════════════════════

create_sets() {
    log "STEP 3: Creating nft sets (replacing ipset)..."

    # ─── Mangle table sets (user management) ───────────────────────────

    # Authenticated user IPs — dynamically added/removed by RADIUS auth callback
    # (24Online: ipset -N loggedinusers hash:net)
    nft 'add set inet staysuite_mangle authenticated_users { type ipv4_addr; flags interval,timeout; timeout 86400s; gc-interval 5m; size 65536; }'

    # Authenticated user subnets/networks
    # (24Online: ipset -N loggedinusersnetwork hash:net)
    nft 'add set inet staysuite_mangle authenticated_networks { type ipv4_addr; flags interval; size 1024; }'

    # Destination IPs for authenticated users (for accounting)
    # (24Online: ipset -N loggedinusersdstip hash:net)
    nft 'add set inet staysuite_mangle authenticated_dst { type ipv4_addr; flags interval; size 1024; }'

    # Denied networks — blocked subnets
    # (24Online: ipset -N denynetwork bitmap:ip,mac range ...)
    nft 'add set inet staysuite_mangle deny_networks { type ipv4_addr; flags interval; size 1024; }'

    # Captive portal exempt IPs — management IPs, APs, switches, etc.
    nft 'add set inet staysuite_mangle portal_exempt { type ipv4_addr; flags interval; size 1024; }'

    # Server IPs (auto-populated from .nmconnection scan)
    nft 'add set inet staysuite_mangle server_ips { type ipv4_addr; flags interval; size 64; }'

    # ─── Filter table sets (security) ──────────────────────────────────

    # MAC blacklist
    nft 'add set inet staysuite_filter blocked_macs { type ether_addr; flags interval; size 4096; }'

    # MAC whitelist (when in whitelist mode, only these MACs get DHCP/internet)
    nft 'add set inet staysuite_filter allowed_macs { type ether_addr; flags interval; size 4096; }'

    # URL filter sinkhole IPs
    nft 'add set inet staysuite_filter url_filter_sinkholes { type ipv4_addr; flags interval; size 4096; }'

    # Multi-gateway per-gateway IP sets (created dynamically)
    # nft 'add set inet staysuite_mangle gw1_ips { type ipv4_addr; ... }'

    log "Sets created."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 4: Create Custom Chains
#  (24Online equivalent: iptables -t mangle -N open, accountingup, acctup, etc.)
# ═══════════════════════════════════════════════════════════════════════════

create_chains() {
    log "STEP 4: Creating custom chains..."

    # ─── Mangle chains ─────────────────────────────────────────────────

    # open: always-allowed traffic (loopback, ICMP, server self, established)
    nft add chain inet staysuite_mangle open

    # auth_passthrough: rules for authenticated users (connmark save/restore)
    nft add chain inet staysuite_mangle auth_passthrough

    # unauth_redirect: mark HTTP/HTTPS for captive portal redirect
    # (24Online: accountingup chain with mark 10000/20000)
    nft add chain inet staysuite_mangle unauth_redirect

    # accounting_up: upload bandwidth accounting (download from LAN perspective)
    nft add chain inet staysuite_mangle accounting_up

    # accounting_dn: download bandwidth accounting
    nft add chain inet staysuite_mangle accounting_dn

    # firewall_up: bandwidth firewall for upload (per-user/plan caps)
    nft add chain inet staysuite_mangle firewall_up

    # firewall_dn: bandwidth firewall for download
    nft add chain inet staysuite_mangle firewall_dn

    # ─── NAT chains ────────────────────────────────────────────────────

    # portal_redirect: captive portal HTTP/HTTPS redirect
    # (24Online: iptables -t nat -I PREROUTING -m mark --mark 10000 -j REDIRECT --to-ports 8888)
    nft add chain inet staysuite_nat portal_redirect

    # port_forward: DNAT port forwarding rules
    nft add chain inet staysuite_nat port_forward

    # ─── Filter chains ─────────────────────────────────────────────────

    # lan_to_wan: filter rules for LAN→WAN forwarded traffic
    nft add chain inet staysuite_filter lan_to_wan

    # server_protect: protection rules for the server itself
    nft add chain inet staysuite_filter server_protect

    log "Custom chains created."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 5: Open Rules (Always Allowed Traffic)
#  (24Online equivalent: iptables -I open -s 0/0 -d 127.0.0.1 -j ACCEPT, etc.)
# ═══════════════════════════════════════════════════════════════════════════

add_open_rules() {
    log "STEP 5: Adding open rules..."

    # ─── Loopback ──────────────────────────────────────────────────────
    nft add rule inet staysuite_mangle open iif lo accept
    nft add rule inet staysuite_mangle open oif lo accept

    # ─── ICMP (ping) ──────────────────────────────────────────────────
    nft add rule inet staysuite_mangle open icmp accept
    nft add rule inet staysuite_mangle open icmpv6 accept

    # ─── Established/Related connections ───────────────────────────────
    nft add rule inet staysuite_mangle open ct state established,related accept

    # ─── Authenticated users bypass everything ─────────────────────────
    nft add rule inet staysuite_mangle open ip saddr @authenticated_users accept
    nft add rule inet staysuite_mangle open ip saddr @authenticated_networks accept

    # ─── Portal exempt IPs ─────────────────────────────────────────────
    nft add rule inet staysuite_mangle open ip saddr @portal_exempt accept

    # ─── Server IPs (self-traffic) ─────────────────────────────────────
    nft add rule inet staysuite_mangle open ip saddr @server_ips accept
    nft add rule inet staysuite_mangle open ip daddr @server_ips accept

    # ─── Jump to open from prerouting (first chain) ────────────────────
    # (24Online: iptables -A PREROUTING -s 0/0 -d 0/0 -j open -t mangle)
    nft add rule inet staysuite_mangle prerouting jump open

    log "Open rules configured."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 6: Per-Interface Rules
#  (24Online equivalent: loop over ifcfg-eth* files, check nettype, add rules)
#
#  Key logic:
#    - For each .nmconnection file, read device, nettype, IP, netmask
#    - nettype 0 (LAN), 2 (VLAN), 6 (Guest), 7 (IoT), 10 (WiFi):
#        → Open server ports
#        → Mark HTTP/HTTPS for captive portal redirect
#        → Rate limit unauthorized traffic
#    - nettype 1 (WAN):
#        → MASQUERADE outbound traffic
#        → Restrict inbound to established only
#    - nettype 5 (Management):
#        → Open management ports, no portal redirect
# ═══════════════════════════════════════════════════════════════════════════

add_interface_rules() {
    log "STEP 6: Adding per-interface rules from NetworkManager..."

    if [ ! -d "$NM_CONNS_DIR" ]; then
        log "WARN" "$NM_CONNS_DIR not found, skipping interface rules"
        return
    fi

    local conn_file device nettype ipaddr prefix netmask conn_type gw
    local lan_count=0 wan_count=0

    for conn_file in "$NM_CONNS_DIR"/*.nmconnection; do
        [ -f "$conn_file" ] || continue

        conn_type=$(nm_get_type "$conn_file")
        device=$(nm_get_ifname "$conn_file")
        nettype=$(nm_get_nettype "$conn_file" 2>/dev/null)
        ipaddr=$(nm_get_ipv4_addr "$conn_file")
        prefix=$(nm_get_ipv4_prefix "$conn_file")
        gw=$(nm_get_ipv4_gw "$conn_file")

        # Skip if no IP or device name
        [ -z "$ipaddr" ]  && continue
        [ -z "$device" ]  && continue
        [ -z "$nettype" ] && nettype=0

        netmask=$(cidr_to_netmask "${prefix:-24}")

        # Add server IP to the server_ips set
        nft add element inet staysuite_mangle server_ips "{ $ipaddr }" 2>/dev/null || true

        log "  Interface: $device type=$conn_type nettype=$nettype ip=$ipaddr/$prefix gw=${gw:-none}"

        # ─── Determine if this is a DHCP-eligible interface ────────────
        # (24Online: nettype=0 LAN, nettype=2 VLAN → captive portal redirect)
        case "$nettype" in
            $NETTYPE_LAN|$NETTYPE_VLAN|$NETTYPE_BRIDGE|$NETTYPE_BOND|$NETTYPE_GUEST|$NETTYPE_IOT|$NETTYPE_WIFI)
                add_lan_interface_rules "$device" "$ipaddr" "$prefix" "$nettype" "$gw"
                lan_count=$((lan_count + 1))
                ;;
            $NETTYPE_WAN)
                add_wan_interface_rules "$device" "$ipaddr" "$prefix" "$gw"
                wan_count=$((wan_count + 1))
                ;;
            $NETTYPE_MANAGEMENT)
                add_mgmt_interface_rules "$device" "$ipaddr" "$prefix"
                lan_count=$((lan_count + 1))
                ;;
            $NETTYPE_DMZ)
                add_dmz_interface_rules "$device" "$ipaddr" "$prefix"
                lan_count=$((lan_count + 1))
                ;;
            *)
                log "  Skipping $device (nettype=$nettype, unused)"
                ;;
        esac
    done

    log "Interface rules: $lan_count LAN-facing, $wan_count WAN-facing"
}

# ─── LAN Interface Rules ────────────────────────────────────────────────
# (24Online: the ifcfg-eth* loop for nettype=0 and nettype=2)
#
# Key logic from 24Online:
#   1. Allow server ports (SSH, HTTP, DNS, etc.)
#   2. Mark HTTP for captive portal redirect (mark 10000)
#   3. Rate limit unauthorized HTTP/HTTPS (hashlimit)
#   4. Drop all other unauthorized new connections
#   5. Allow established HTTP/HTTPS (for redirect responses)

add_lan_interface_rules() {
    local device="$1" ipaddr="$2" prefix="$3" nettype="$4" gw="$5"

    # ─── Mangle: Open ports for server on this interface ───────────────
    # (24Online: iptables -I open -s $ipaddr -d 0/0 -j ACCEPT -t mangle)

    # Allow traffic FROM this interface's subnet TO server
    nft add rule inet staysuite_mangle open \
        iifname "$device" ip daddr @server_ips accept

    # Allow ICMP to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" ip daddr @server_ips icmp accept

    # Allow established/related to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" ip daddr @server_ips ct state established,related accept

    # Allow management TCP ports to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" tcp dport { $OPEN_TCP_PORTS } accept

    # Allow DNS (UDP+TCP) to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" udp dport $DNS_PORT accept
    nft add rule inet staysuite_mangle open \
        iifname "$device" tcp dport $DNS_PORT accept

    # Allow DHCP (UDP 67/68) to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" udp dport { 67, 68 } accept

    # Allow related UDP responses to server
    nft add rule inet staysuite_mangle open \
        iifname "$device" udp ct state established,related accept

    # ─── Filter: Drop dangerous ports TO server ────────────────────────
    # (24Online: iptables -I open -s 0/0 -d $ipaddr -m multiport -p tcp --dport 8007,8009,3306,389,3128 -j DROP)
    nft add rule inet staysuite_filter input \
        iifname "$device" tcp dport { 3306, 5432, 6379, 27017, 11211 } drop
    nft add rule inet staysuite_filter input \
        iifname "$device" udp dport { 137, 138, 139, 445 } drop

    # ─── Mangle: SMB/CIFS drop (global, in open chain) ────────────────
    # (24Online: iptables -A open -t mangle -s 0/0 -d 0/0 -m multiport -p tcp --dport 137,138,139,445 -j DROP)
    nft add rule inet staysuite_mangle open \
        tcp dport { 137, 138, 139, 445 } drop
    nft add rule inet staysuite_mangle open \
        udp dport { 137, 138, 139, 445 } drop

    # ─── Mangle: Captive Portal Redirect for UNAUTHENTICATED traffic ───
    # ONLY for guest-facing interfaces (Guest, WiFi, IoT, VLAN)
    # NOT for Management or LAN (nettype 0 = LAN may also be guest-facing,
    # so we include all DHCP-eligible interfaces)
    #
    # (24Online: the accountingup chain with mark 10000/20000)

    # --- Rate limit HTTP for unauthorized users ---
    # (24Online: iptables -A accountingup -p tcp --dport 80 -s $ipaddr/$netmask
    #            -m state --state NEW -m hashlimit --hashlimit 230/min
    #            --hashlimit-burst 40 --hashlimit-mode srcip
    #            --hashlimit-name UNAUTH_TRAFFIC -j ACCEPT -t mangle)
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" tcp dport 80 \
        ct state new \
        limit rate "$HTTP_RATE" burst "$HTTP_BURST" packets \
        meta mark set $MARK_HTTP_REDIRECT

    # --- Rate limit HTTPS for unauthorized users ---
    # (24Online: iptables -A accountingup -p tcp --dport 443 ... mark 20000)
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" tcp dport 443 \
        ct state new \
        limit rate "$HTTPS_RATE" burst "$HTTPS_BURST" packets \
        meta mark set $MARK_HTTPS_REDIRECT

    # --- Allow established HTTP/HTTPS through (for redirect responses) ---
    # (24Online: iptables -A accountingup -p tcp -s $ipaddr/$netmask -d 0/0
    #            -m multiport --dport 80,443 -j ACCEPT -t mangle)
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" tcp dport { 80, 443 } \
        ct state established,related \
        accept

    # --- Allow DHCP and DNS always (even for unauthenticated) ---
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" udp dport { 53, 67, 68 } accept
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" tcp dport 53 accept

    # --- Allow ARP ---
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" arp accept

    # --- Allow ICMP (for captive portal detection) ---
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" icmp accept

    # --- Drop all other NEW unauthorized connections ---
    # (24Online: iptables -A accountingup -s $ipaddr/$netmask -d 0/0 -m state --state NEW -j DROP)
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" \
        ct state new \
        drop

    # --- Accept what's left (established/related already handled by open chain) ---
    nft add rule inet staysuite_mangle unauth_redirect \
        iifname "$device" \
        accept

    # ─── Filter: Allow forward for authenticated users ──────────────────
    nft add rule inet staysuite_filter forward \
        iifname "$device" ip saddr @authenticated_users accept
    nft add rule inet staysuite_filter forward \
        iifname "$device" ip saddr @authenticated_networks accept
    nft add rule inet staysuite_filter forward \
        iifname "$device" ct state established,related accept

    # ─── Filter: Allow forward for portal exempt IPs ───────────────────
    nft add rule inet staysuite_filter forward \
        iifname "$device" ip saddr @portal_exempt accept
}

# ─── WAN Interface Rules ────────────────────────────────────────────────
# (24Online: nettype=1 interfaces get MASQUERADE + restricted input)

add_wan_interface_rules() {
    local device="$1" ipaddr="$2" prefix="$3" gw="$4"

    # ─── Filter: Restrict inbound from WAN ────────────────────────────
    # Only allow established/related from WAN
    nft add rule inet staysuite_filter input \
        iifname "$device" ct state established,related accept

    # Allow ICMP (ping) from WAN (rate limited)
    nft add rule inet staysuite_filter input \
        iifname "$device" icmp limit rate 5/second accept

    # Allow management ports from portal_exempt IPs
    nft add rule inet staysuite_filter input \
        iifname "$device" ip saddr @portal_exempt tcp dport { 22, 443 } accept

    # ─── NAT: MASQUERADE outbound traffic from LAN ────────────────────
    # (24Online: implicit via NAT + routing)
    nft add rule inet staysuite_nat postrouting \
        oifname "$device" masquerade \
        comment "StaySuite MASQUERADE via $device"

    # ─── Mangle: Save/restore connmarks for policy routing ─────────────
    nft add rule inet staysuite_mangle prerouting \
        iif "$device" ct state established,related \
        meta mark set ct mark

    nft add rule inet staysuite_mangle postrouting \
        oif "$device" ct mark set meta mark
}

# ─── Management Interface Rules ─────────────────────────────────────────

add_mgmt_interface_rules() {
    local device="$1" ipaddr="$2" prefix="$3"

    # Allow all management traffic — no captive portal redirect
    nft add rule inet staysuite_mangle open \
        iifname "$device" accept

    nft add rule inet staysuite_filter forward \
        iifname "$device" accept
}

# ─── DMZ Interface Rules ────────────────────────────────────────────────

add_dmz_interface_rules() {
    local device="$1" ipaddr="$2" prefix="$3"

    # DMZ: allow established/related, plus specific ports
    nft add rule inet staysuite_filter forward \
        iifname "$device" ct state established,related accept
    nft add rule inet staysuite_filter forward \
        oifname "$device" ct state established,related accept
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 7: Captive Portal Redirect (NAT)
#  (24Online equivalent: iptables -t nat -I PREROUTING -m mark --mark 10000
#                          -j REDIRECT -p tcp --to-ports 8888)
# ═══════════════════════════════════════════════════════════════════════════

add_captive_portal_redirect() {
    log "STEP 7: Adding captive portal redirect rules..."

    # ─── NAT: HTTP redirect (mark 10000 → portal port) ─────────────────
    # (24Online: iptables -t nat -I PREROUTING -m mark --mark 10000 -j REDIRECT -p tcp --to-ports 8888)
    nft add rule inet staysuite_nat portal_redirect \
        meta mark $MARK_HTTP_REDIRECT tcp dport 80 \
        dnat to ":$PORTAL_HTTP_PORT" \
        comment "StaySuite HTTP captive portal redirect"

    # ─── NAT: HTTPS redirect (mark 20000 → portal port) ───────────────
    # Note: True HTTPS redirect requires MITM (sslstrip) or TCP RST approach
    # Many gateways just redirect HTTP and use DNS manipulation for HTTPS
    # (24Online: iptables -t nat -I PREROUTING -m mark --mark 20000 -j REDIRECT -p tcp --to-ports 8443)
    nft add rule inet staysuite_nat portal_redirect \
        meta mark $MARK_HTTPS_REDIRECT tcp dport 443 \
        dnat to ":$PORTAL_HTTPS_PORT" \
        comment "StaySuite HTTPS captive portal redirect"

    # ─── Wire: prerouting → portal_redirect chain ──────────────────────
    # This MUST come after the mangle marking rules in prerouting
    nft add rule inet staysuite_nat prerouting jump portal_redirect

    # ─── NAT: Open chain last (allow management NAT access) ────────────
    # (24Online: iptables -t nat -I PREROUTING -j open)
    nft add rule inet staysuite_nat prerouting accept

    # ─── NAT: port_forward chain ───────────────────────────────────────
    nft add rule inet staysuite_nat prerouting jump port_forward

    log "Captive portal redirect: HTTP → :$PORTAL_HTTP_PORT, HTTPS → :$PORTAL_HTTPS_PORT"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 8: Authenticated User Passthrough & Connmark
#  (24Online equivalent: iptables -t mangle -I PREROUTING -m set --match-set
#                          usersset src,src -j ACCEPT, CONNMARK save/restore)
# ═══════════════════════════════════════════════════════════════════════════

add_auth_passthrough() {
    log "STEP 8: Adding authenticated user passthrough rules..."

    # ─── Authenticated users ACCEPT (bypass everything) ────────────────
    # (24Online: iptables -t mangle -I PREROUTING -m set --match-set usersset src,src -j ACCEPT)
    # MUST be in prerouting BEFORE the unauth_redirect chain
    nft add rule inet staysuite_mangle prerouting \
        ip saddr @authenticated_users \
        accept

    nft add rule inet staysuite_mangle prerouting \
        ip saddr @authenticated_networks \
        accept

    # Portal exempt → accept
    nft add rule inet staysuite_mangle prerouting \
        ip saddr @portal_exempt \
        accept

    # Server IPs → accept
    nft add rule inet staysuite_mangle prerouting \
        ip saddr @server_ips \
        accept

    # ─── Connmark: Save mark to connection ─────────────────────────────
    # (24Online: iptables -t mangle -I PREROUTING -m set --match-set usersset src,src -j CONNMARK --save-mark)
    nft add rule inet staysuite_mangle auth_passthrough \
        ip saddr @authenticated_users \
        ct mark set meta mark

    nft add rule inet staysuite_mangle auth_passthrough \
        ip saddr @authenticated_networks \
        ct mark set meta mark

    # ─── Connmark: Restore mark from connection ────────────────────────
    # (24Online: iptables -t mangle -I PREROUTING -m set --match-set usersset src,src -j CONNMARK --restore-mark)
    nft add rule inet staysuite_mangle prerouting \
        ip saddr @authenticated_users \
        meta mark set ct mark

    nft add rule inet staysuite_mangle postrouting \
        ip daddr @authenticated_users \
        meta mark set ct mark

    # ─── Connmark: Authenticated with existing mark → ACCEPT ──────────
    # (24Online: iptables -t mangle -I PREROUTING -m set --match-set usersset src,src -m connmark ! --mark 0 -j ACCEPT)
    nft add rule inet staysuite_mangle prerouting \
        ip saddr @authenticated_users \
        ct mark != 0 \
        accept

    # ─── Wire: unauth_redirect chain in prerouting ────────────────────
    # After authenticated passthrough, run unauth_redirect
    nft add rule inet staysuite_mangle prerouting jump unauth_redirect

    # ─── POSTROUTING: connmark save ────────────────────────────────────
    nft add rule inet staysuite_mangle postrouting \
        ct mark set meta mark

    # ─── POSTROUTING: Allow fragmented packets ─────────────────────────
    # (24Online: iptables -I POSTROUTING -f -j DROP -t mangle)
    nft add rule inet staysuite_mangle postrouting \
        ip frag-offload & 0x1fff != 0 \
        drop

    log "Auth passthrough configured."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 9: Accounting & Bandwidth Marks
#  (24Online equivalent: iptables -t mangle -A PREROUTING -s 0/0 -d 0/0
#                          -j accountingup, accountingdn, etc.)
# ═══════════════════════════════════════════════════════════════════════════

add_accounting() {
    log "STEP 9: Adding accounting/bandwidth rules..."

    # ─── Upload accounting (mangle PREROUTING) ────────────────────────
    # Traffic from LAN clients to internet
    nft add rule inet staysuite_mangle accounting_up \
        meta mark set $MARK_AUTHENTICATED

    nft add rule inet staysuite_mangle accounting_up \
        ct mark set meta mark

    # ─── Download accounting (mangle POSTROUTING) ─────────────────────
    # Traffic from internet to LAN clients
    nft add rule inet staysuite_mangle accounting_dn \
        meta mark set $MARK_AUTHENTICATED

    nft add rule inet staysuite_mangle accounting_dn \
        ct mark set meta mark

    # ─── Drop packets without mark in mangle (end of chain) ──────────
    # (24Online: iptables -I accountingup -m connmark ! --mark 0 -j DROP -t mangle)
    nft add rule inet staysuite_mangle prerouting \
        ct mark == 0 \
        drop

    log "Accounting configured."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 10: Multi-Gateway (Policy Routing) Support
#  (24Online equivalent: ipset -N gw${gatewayid}ipset + fwmark per gateway)
# ═══════════════════════════════════════════════════════════════════════════

add_multi_gateway() {
    log "STEP 10: Multi-gateway support..."

    if [ "$MULTI_GW_ENABLED" != "Y" ] && [ "$MULTI_GW_ENABLED" != "y" ]; then
        log "Multi-gateway not enabled, skipping."
        return
    fi

    # Multi-gateway rules are added dynamically by the multi-WAN service.
    # Each gateway gets:
    #   nft add set inet staysuite_mangle gw<N>_ips { type ipv4_addr; }
    #   nft add rule inet staysuite_mangle prerouting ip saddr @gw<N>_ips meta mark set <fwmark>
    #   nft add rule inet staysuite_nat postrouting meta mark <fwmark> oifname <wan_device> masquerade

    log "Multi-gateway base prepared. Dynamic rules added by multi-WAN service."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 11: Security Rules
#  (24Online equivalent: /usr/local/scripts/general_settings.sh,
#                          drop SMB, SYN flood, etc.)
# ═══════════════════════════════════════════════════════════════════════════

add_security_rules() {
    log "STEP 11: Adding security rules..."

    # ─── SYN flood protection ──────────────────────────────────────────
    nft add rule inet staysuite_filter input \
        tcp flags & (fin|syn|rst|ack) == syn \
        ct state new \
        limit rate 10/second burst 20 packets \
        accept

    nft add rule inet staysuite_filter input \
        tcp flags & (fin|syn|rst|ack) == syn \
        ct state new \
        drop

    # ─── Drop invalid packets ──────────────────────────────────────────
    nft add rule inet staysuite_filter input ct state invalid drop
    nft add rule staysuite_filter forward ct state invalid drop 2>/dev/null || true

    # ─── Drop fragmented packets ───────────────────────────────────────
    nft add rule inet staysuite_filter input ip frag-offload & 0x1fff != 0 drop

    # ─── SMB logging (24Online: LOG --log-prefix "CRYPT_NETSEC") ─────
    nft add rule inet staysuite_filter input \
        tcp dport { 137, 138, 139, 445 } \
        log prefix "STAYSUITE_SMB_DROP " \
        limit rate 5/minute \
        drop

    # ─── ICMP: Allow echo-request, drop rest ──────────────────────────
    nft add rule inet staysuite_filter input \
        icmp type echo-request \
        limit rate 5/second \
        accept

    # ─── MAC blacklist filter ──────────────────────────────────────────
    nft add rule inet staysuite_filter input \
        ether saddr @blocked_macs drop

    nft add rule inet staysuite_filter forward \
        ether saddr @blocked_macs drop

    # ─── SNMP monitoring ports ─────────────────────────────────────────
    nft add rule inet staysuite_filter input \
        udp dport { 161, 162 } accept

    log "Security rules configured."
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 12: Load Deny Networks
#  (24Online equivalent: /etc/denynetwork file + generate_denynetwork_file.sh)
# ═══════════════════════════════════════════════════════════════════════════

load_deny_networks() {
    local deny_file="${STAYSUITE_DIR}/firewall/deny-networks"
    if [ -f "$deny_file" ]; then
        log "STEP 12: Loading deny networks from $deny_file..."
        local count=0
        while IFS= read -r line; do
            line=$(echo "$line" | sed 's/#.*//' | tr -d '[:space:]')
            [ -z "$line" ] && continue
            nft add element inet staysuite_mangle deny_networks "{ $line }" 2>/dev/null || true
            count=$((count + 1))
        done < "$deny_file"

        # Block deny networks
        nft add rule inet staysuite_mangle open ip saddr @deny_networks drop
        nft add rule inet staysuite_filter forward ip saddr @deny_networks drop
        log "Loaded $count deny network(s)."
    else
        log "STEP 12: No deny-networks file found, skipping."
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 13: Load Portal Exempt IPs
# ═══════════════════════════════════════════════════════════════════════════

load_portal_exempt() {
    local exempt_file="${STAYSUITE_DIR}/firewall/portal-exempt"
    if [ -f "$exempt_file" ]; then
        log "Loading portal-exempt IPs from $exempt_file..."
        while IFS= read -r line; do
            line=$(echo "$line" | sed 's/#.*//' | tr -d '[:space:]')
            [ -z "$line" ] && continue
            nft add element inet staysuite_mangle portal_exempt "{ $line }" 2>/dev/null || true
        done < "$exempt_file"
    fi

    # Default: Add all private ranges (APs, switches, infrastructure)
    nft add element inet staysuite_mangle portal_exempt "{ 10.0.0.0/8 }" 2>/dev/null || true
    nft add element inet staysuite_mangle portal_exempt "{ 172.16.0.0/12 }" 2>/dev/null || true
    nft add element inet staysuite_mangle portal_exempt "{ 192.168.0.0/16 }" 2>/dev/null || true
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 14: Load Blocked MACs
#  (24Online equivalent: /usr/local/scripts/blockmacentries.sh)
# ═══════════════════════════════════════════════════════════════════════════

load_blocked_macs() {
    local mac_file="${STAYSUITE_DIR}/firewall/blocked-macs"
    if [ -f "$mac_file" ]; then
        log "Loading blocked MACs from $mac_file..."
        while IFS= read -r line; do
            line=$(echo "$line" | sed 's/#.*//' | tr -d '[:space:]')
            [ -z "$line" ] && continue
            # Validate MAC format
            if [[ "$line" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]; then
                nft add element inet staysuite_filter blocked_macs "{ $line }" 2>/dev/null || true
            fi
        done < "$mac_file"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 15: Final PREROUTING drop (catch-all)
#  (24Online equivalent: the LAST rule in the chain)
# ═══════════════════════════════════════════════════════════════════════════

add_final_drop() {
    log "STEP 15: Adding final catch-all rules..."

    # ICMP passthrough (before final drop)
    nft add rule inet staysuite_mangle prerouting icmp accept
    nft add rule inet staysuite_mangle postrouting icmp accept

    # Final drop in PREROUTING (catches everything not handled above)
    # (24Online: implicitly handled by chain order)
    # Note: We do NOT add a final drop here because:
    #   1. The open chain already has 'accept' for authenticated users
    #   2. The unauth_redirect chain already has 'drop' for new unauthorized connections
    #   3. The connmark == 0 drop in accounting handles the rest
}

# ═══════════════════════════════════════════════════════════════════════════
#  Step 16: Save Ruleset
# ═══════════════════════════════════════════════════════════════════════════

save_ruleset() {
    log "STEP 16: Saving nftables ruleset..."

    mkdir -p "$NFTABLES_CONF_DIR"
    nft list ruleset > "$NFTABLES_CONF"

    # Ensure nftables service loads our rules on boot
    if [ -f /etc/sysconfig/nftables-config ]; then
        sed -i "s|^NFTABLES_CONF=.*|NFTABLES_CONF=\"$NFTABLES_CONF\"|" /etc/sysconfig/nftables-config
    else
        echo "NFTABLES_CONF=\"$NFTABLES_CONF\"" > /etc/sysconfig/nftables-config
    fi

    log "Ruleset saved to $NFTABLES_CONF"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    mkdir -p "$NFTABLES_CONF_DIR" 2>/dev/null || true

    log "╔═══════════════════════════════════════════════════════════════╗"
    log "║  StaySuite HospitalityOS — Gateway Firewall (nftables)         ║"
    log "║  Rocky Linux 10 — Captive Portal Gateway Setup                ║"
    log "╚═══════════════════════════════════════════════════════════════╝"

    check_nftables

    # Execute steps in order (24Online script order preserved)
    flush_all                   # Step 1:  Flush all existing rules
    create_tables               # Step 2:  Create tables & base chains
    create_sets                 # Step 3:  Create nft sets (ipset replacement)
    create_chains               # Step 4:  Create custom chains
    add_open_rules              # Step 5:  Open rules (always allowed)
    add_interface_rules         # Step 6:  Per-interface rules (.nmconnection)
    add_captive_portal_redirect # Step 7:  NAT portal redirect (HTTP→portal)
    add_auth_passthrough        # Step 8:  Authenticated user bypass + connmark
    add_accounting              # Step 9:  Accounting/bandwidth marks
    add_multi_gateway           # Step 10: Multi-WAN policy routing
    add_security_rules          # Step 11: Security (SYN flood, invalid, etc.)
    load_deny_networks          # Step 12: Load deny networks
    load_portal_exempt          # Step 13: Load portal exempt IPs
    load_blocked_macs           # Step 14: Load blocked MACs
    add_final_drop              # Step 15: Final catch-all
    save_ruleset                # Step 16: Save to disk

    # ─── Summary ──────────────────────────────────────────────────────
    log "═══════════════════════════════════════════════════════════════"
    log "Gateway firewall initialized successfully."
    log ""
    log "Tables: staysuite_filter, staysuite_nat, staysuite_mangle"
    log "Portal: HTTP :$PORTAL_HTTP_PORT, HTTPS :$PORTAL_HTTPS_PORT"
    log "Config: $NFTABLES_CONF"
    log ""
    log "Dynamic operations (runtime):"
    log "  Add authenticated user:"
    log "    nft add element inet staysuite_mangle authenticated_users { 192.168.1.50 }"
    log "  Remove authenticated user:"
    log "    nft delete element inet staysuite_mangle authenticated_users { 192.168.1.50 }"
    log "═══════════════════════════════════════════════════════════════"
}

# ─── Run ───────────────────────────────────────────────────────────────
main "$@"
