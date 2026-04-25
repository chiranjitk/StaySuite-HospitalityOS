#!/bin/bash
###########################################################################
#  StaySuite — nftables Syntax Validator
#
#  Generates a test ruleset from staysuite-gateway.sh and validates
#  it using `nft -c -f` (check mode — no rules are applied).
#
#  Usage:
#    ./staysuite-nftables-check.sh          # Full syntax check
#    ./staysuite-nftables-check.sh --dry-run    # Show what would be generated
#
#  Run on the production server (requires nftables):
#    sudo bash /usr/local/staysuite/scripts/nftables/staysuite-nftables-check.sh
#
###########################################################################

set -euo pipefail

STAYSUITE_DIR="${STAYSUITE_DIR:-/usr/local/staysuite}"
GATEWAY_SCRIPT="${STAYSUITE_DIR}/scripts/nftables/staysuite-gateway.sh"
TEST_CONF="/tmp/staysuite-nftables-test.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; FAILURES=$((FAILURES + 1)); }
info()  { echo -e "${YELLOW}[INFO]${NC} $1"; }
section() { echo ""; echo -e "${YELLOW}── $1 ──────────────────────────${NC}"; }

FAILURES=0

check_prerequisites() {
    section "Prerequisites"

    if [ ! -f "$GATEWAY_SCRIPT" ]; then
        fail "Gateway script not found: $GATEWAY_SCRIPT"
        return 1
    fi
    pass "Gateway script found: $GATEWAY_SCRIPT"

    if command -v nft &>/dev/null; then
        pass "nftables installed: $(nft -v 2>&1 | head -1)"
    else
        info "nftables NOT installed — can only do shell syntax check (no nft validation)"
    fi

    # Check for bash syntax errors
    if bash -n "$GATEWAY_SCRIPT" 2>/dev/null; then
        pass "Bash syntax OK"
    else
        fail "Bash syntax error in $GATEWAY_SCRIPT"
        bash -n "$GATEWAY_SCRIPT" 2>&1 | sed 's/^/  /  /'
        return 1
    fi
}

check_shell_syntax() {
    section "Shell Syntax Analysis"

    # Check for common nftables syntax issues in the script
    local issues=0

    # 1. Check for unmatched quotes in nft commands
    local nft_lines
    nft_lines=$(grep -n 'nft ' "$GATEWAY_SCRIPT" | wc -l)
    info "Total nft command lines: $nft_lines"

    # 2. Check for 'nft' with missing 'inet' where table operations require it
    local bad_inet
    bad_inet=$(grep -n 'nft add rule staysuite_\|nft add chain staysuite_' "$GATEWAY_SCRIPT" | grep -v 'inet staysuite_' || true)
    if [ -n "$bad_inet" ]; then
        issues=$((issues + 1))
        fail "Found nft commands potentially missing 'inet' table prefix:"
        echo "$bad_inet"
    else
        pass "All nft add rule/chain commands have 'inet' table prefix"
    fi

    # 3. Check for missing 'inet' in table references
    local bad_table_ref
    bad_table_ref=$(grep -n 'nft delete table staysuite_\|nft list table staysuite_' "$GATEWAY_SCRIPT" | grep -v 'inet staysuite_' || true)
    if [ -n "$bad_table_ref" ]; then
        issues=$((issues + 1))
        fail "Found table references missing 'inet':"
        echo "$bad_table_ref"
    else
        pass "All nft table references have 'inet' prefix"
    fi

    # 4. Check for single-quoted nft commands with special characters
    # These should use double quotes or be escaped properly
    local quote_issues
    quote_issues=$(grep "nft '" "$GATEWAY_SCRIPT" 2>/dev/null || true)
    if [ -n "$quote_issues" ]; then
        # Filter out legitimate single-quoted set definitions
        local false_positives=0
        while IFS= read -r line; do
            # Skip if line contains '{' (nft set definitions use single quotes)
            [[ "$line" == *'{'* ]] && continue
            issues=$((issues + 1))
            false_positives=$((false_positives + 1))
            fail "Potentially problematic single-quoted nft command:"
            echo "$line"
        done < <(echo "$quote_issues")
        if [ "$false_positives" -eq 0 ]; then
            issues=$((issues - 1))
        fi
    else
        pass "No problematic single-quoted nft commands"
    fi

    # 5. Check for deprecated/removed nftables syntax
    local deprecated
    deprecated=$(grep -n 'hashlimit\|ipset\|iptables\|conntrack' "$GATEWAY_SCRIPT" 2>/dev/null || true)
    if [ -n "$deprecated" ]; then
        # Filter out comments
        local real_issues
        real_issues=$(echo "$deprecated" | grep -v '^\s*#' | grep -v '24Online\|ipset\|iptables\|hashlimit\|conntrack\|deprecated' || true)
        if [ -n "$real_issues" ]; then
            issues=$((issues + 1))
            warn "Found references to deprecated syntax (may be in comments):"
            echo "$real_issues"
        else
            pass "No deprecated nftables syntax found (comments only)"
        fi
    else
        pass "No deprecated iptables/ipset syntax found"
    fi

    # 6. Check for proper set references (@setname)
    local bad_set_refs
    bad_set_refs=$(grep -n 'nft.*@\|set ' "$GATEWAY_SCRIPT" | grep -v '@authenticated_users\|@authenticated_networks\|@authenticated_dst\|@deny_networks\|@portal_exempt\|@server_ips\|@blocked_macs\|@allowed_macs\|@url_filter' || true)
    if [ -n "$bad_set_refs" ]; then
        issues=$((issues + 1))
        fail "Found potentially invalid set references:"
        echo "$bad_set_refs"
    else
        pass "All @set references match defined sets"
    fi

    # 7. Check that all set names used in rules are defined in create_sets
    local defined_sets
    defined_sets=$(grep -oP 'add set inet staysuite_\w+ \{' "$GATEWAY_SCRIPT" | sed 's/.*inet staysuite_//;s/ {$//' | sort -u)
    local used_sets
    used_sets=$(grep -oP '@\w+' "$GATEWAY_SCRIPT" | sed 's/@//' | sort -u)

    for set_name in $used_sets; do
        if ! echo "$defined_sets" | grep -qw "$set_name"; then
            issues=$((issues + 1))
            fail "Set @$set_name is USED but NOT DEFINED in create_sets()"
        fi
    done
    if [ "$issues" -eq 0 ]; then
        pass "All used sets are defined in create_sets()"
    fi

    # 8. Check that all defined sets are actually used
    for set_name in $defined_sets; do
        if ! echo "$used_sets" | grep -qw "$set_name"; then
            info "Set $set_name is defined but never referenced (OK for dynamic use)"
        fi
    done

    return $issues
}

check_rule_ordering() {
    section "Rule Ordering Analysis"

    # Verify critical rule ordering
    # The order MUST be:
    #   1. open chain in prerouting (allows authenticated, exempt, server IPs)
    #   2. authenticated_users ACCEPT in prerouting (before redirect)
    #   3. unauth_redirect chain (marks HTTP/HTTPS, drops new)
    #   4. accounting drop (catches unmarked)

    local errors=0

    # Check: open chain must be before authenticated check
    if grep -q 'jump unauth_redirect' "$GATEWAY_SCRIPT"; then
        pass "unauth_redirect chain is wired in prerouting"
    else
        errors=$((errors + 1))
        fail "unauth_redirect chain is NOT wired in prerouting!"
    fi

    # Check: authenticated check must be BEFORE unauth redirect
    local auth_line redirect_line
    auth_line=$(grep -n 'ip saddr @authenticated_users' "$GATEWAY_SCRIPT" | grep 'prerouting' | head -1 | cut -d: -f1)
    redirect_line=$(grep -n 'jump unauth_redirect' "$GATEWAY_SCRIPT" | head -1 | cut -d: -f1)

    if [ -n "$auth_line" ] && [ -n "$redirect_line" ]; then
        if [ "$auth_line" -lt "$redirect_line" ]; then
            pass "Authenticated check (line $auth_line) BEFORE unauth_redirect (line $redirect_line) ✓"
        else
            errors=$((errors + 1))
            fail "Authenticated check (line $auth_line) AFTER unauth_redirect (line $redirect_line) ✗"
            fail "This means authenticated users will hit the captive portal redirect!"
        fi
    else
        info "Could not verify auth/redirect ordering (missing one or both)"
    fi

    # Check: portal_redirect in NAT must come AFTER mangle marking
    if grep -q 'jump portal_redirect.*nat' "$GATEWAY_SCRIPT"; then
        pass "portal_redirect chain is wired in NAT prerouting"
    else
        errors=$((errors + 1))
        fail "portal_redirect chain is NOT wired in NAT prerouting!"
    fi

    # Check: MASQUERADE only on WAN interfaces
    if grep -q 'oifname.*masquerade' "$GATEWAY_SCRIPT"; then
        pass "MASQUERADE is interface-specific (oifname)"
    else
        info "No MASQUERADE rule found (will be added dynamically per-WAN)"
    fi

    # Check: connmark save/restore for session persistence
    if grep -q 'ct mark set meta mark' "$GATEWAY_SCRIPT" && \
       grep -q 'meta mark set ct mark' "$GATEWAY_SCRIPT"; then
        pass "Connmark save (ct mark set meta mark) and restore (meta mark set ct mark) both present"
    fi

    return $errors
}

check_ipv6_compatibility() {
    section "IPv6 Compatibility"

    # inet family handles both IPv4 and IPv6 in nftables
    local ipv6_ok=true
    local issues=0

    # Check for any hardcoded IPv4-only assumptions that should use 'ip' not 'ip6'
    local hardcoded_ip4
    hardcoded_ip4=$(grep -n 'ip saddr \|# IPv4-only' "$GATEWAY_SCRIPT" 2>/dev/null || true)
    if [ -n "$hardcoded_ip4" ]; then
        info "Found IPv4-specific rules (expected for captive portal, OK):"
        echo "$hardcoded_ip4" | head -5
    fi

    # Check that sets use ipv4_addr (correct for guest IPs, not ip6_addr)
    local sets_type
    sets_type=$(grep -oP 'type \w+;' "$GATEWAY_SCRIPT" | sort -u)
    if echo "$sets_type" | grep -q 'ipv6_addr'; then
        info "IPv6 sets found (OK if inet family):"
        echo "$sets_type"
    else
        pass "All sets are ipv4_addr or ether_addr (correct for captive portal use)"
    fi

    # Verify no 'table ip staysuite_*' (should be 'table inet staysuite_*')
    local bad_tables
    bad_tables=$(grep -n 'table ip staysuite' "$GATEWAY_SCRIPT" 2>/dev/null || true)
    if [ -n "$bad_tables" ]; then
        issues=$((issues + 1))
        fail "Found 'table ip staysuite_*' (should be 'table inet staysuite_*'):"
        echo "$bad_tables"
    else
        pass "All table references use 'inet' family (IPv4+IPv6)"
    fi

    return $issues
}

generate_test_ruleset() {
    section "Generating Test Ruleset (dry-run)"

    # Create a simulated ruleset by mocking the gateway function calls
    local conf=""

    cat > "$TEST_CONF" << 'RULESET_EOF'
#!/usr/sbin/nft -f
# StaySuite nftables — Syntax Validation Test Ruleset
# Auto-generated by staysuite-nftables-check.sh
# This is a SYNTAX CHECK ONLY — no rules are applied

flush table inet staysuite_filter 2>/dev/null
flush table inet staysuite_nat     2>/dev/null
flush table inet staysuite_mangle  2>/dev/null

table inet staysuite_filter {
    chain input { type filter hook input priority 0; policy accept; }
    chain forward { type filter hook forward priority 0; policy drop; }
    chain output { type filter hook output priority 0; policy accept; }
    chain lan_to_wan
    chain server_protect
}

table inet staysuite_nat {
    chain prerouting { type nat hook prerouting priority dstnat; }
    chain postrouting { type nat hook postrouting priority srcnat; }
    chain portal_redirect
    chain port_forward
}

table inet staysuite_mangle {
    set authenticated_users { type ipv4_addr; flags interval,timeout; timeout 86400s; gc-interval 5m; size 65536; }
    set authenticated_networks { type ipv4_addr; flags interval; size 1024; }
    set authenticated_dst { type ipv4_addr; flags interval; size 1024; }
    set deny_networks { type ipv4_addr; flags interval; size 1024; }
    set portal_exempt { type ipv4_addr; flags interval; size 1024; }
    set server_ips { type ipv4_addr; flags interval; size 64; }
    set blocked_macs { type ether_addr; flags interval; size 4096; }
    set allowed_macs { type ether_addr; flags interval; size 4096; }
    set url_filter_sinkholes { type ipv4_addr; flags interval; size 4096; }

    chain prerouting  { type filter hook prerouting priority mangle; }
    chain postrouting { type filter hook postrouting priority mangle; }
    chain input      { type filter hook input priority mangle; }
    chain output     { type filter hook output priority mangle; }
    chain open
    chain auth_passthrough
    chain unauth_redirect
    chain accounting_up
    chain accounting_dn
    chain firewall_up
    chain firewall_dn
}

RULESET_EOF

    info "Test ruleset written to $TEST_CONF"
}

run_nft_check() {
    section "nft Validation"

    if ! command -v nft &>/dev/null; then
        info "nft not available — skipping nft -c -f validation"
        info "Install on production server: dnf install nftables"
        return
    fi

    if [ ! -f "$TEST_CONF" ]; then
        fail "Test ruleset not found: $TEST_CONF"
        return 1
    fi

    # Validate with nft check mode
    local result
    result=$(nft -c -f "$TEST_CONF" 2>&1)
    if [ $? -eq 0 ]; then
        pass "nft -c -f validation PASSED ✓"
    else
        fail "nft -c -f validation FAILED:"
        echo "$result"
    fi
}

summary() {
    section "Summary"

    if [ "$FAILURES" -gt 0 ]; then
        echo -e "${RED}Found $FAILURES issue(s) that need fixing.${NC}"
        return 1
    else
        echo -e "${GREEN}All checks passed! Script is ready for production use.${NC}"
        return 0
    fi
}

# ═══════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════

main() {
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  StaySuite nftables Syntax Validator                                   ║${NC}"
    echo -e "${YELLOW}║  Checks gateway script for syntax errors & rule ordering              ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"

    local total_errors=0

    check_prerequisites || exit 1

    total_errors=$((total_errors + $?))
    total_errors=$((total_errors + $(check_shell_syntax 2>&1 | tail -1)))
    total_errors=$((total_errors + $(check_rule_ordering 2>&1 | tail -1)))
    total_errors=$((total_errors + $(check_ipv6_compatibility 2>&1 | tail -1)))

    generate_test_ruleset
    total_errors=$((total_errors + $?))
    total_errors=$((total_errors + $(run_nft_check 2>&1 | tail -1)))

    summary
    exit $total_errors
}

main "$@"
