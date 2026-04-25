# StaySuite HospitalityOS — WiFi & Network Management
## Complete Deployment Guide for Debian 13 with nftables

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [WiFi Menu Structure & Pages](#2-wifi-menu-structure--pages)
3. [Service Architecture](#3-service-architecture)
4. [Debian 13 System Requirements](#4-debian-13-system-requirements)
5. [nftables Firewall Integration](#5-nftables-firewall-integration)
6. [FreeRADIUS Configuration](#6-freeradius-configuration)
7. [Kea DHCP Server](#7-kea-dhcp-server)
8. [DNS Server (dnsmasq)](#8-dns-server-dnsmasq)
9. [Captive Portal](#9-captive-portal)
10. [Network Interfaces & VLANs](#10-network-interfaces--vlans)
11. [WiFi Access & Voucher Flow](#11-wifi-access--voucher-flow)
12. [Reports & Monitoring](#12-reports--monitoring)
13. [End-to-End Data Flow](#13-end-to-end-data-flow)
14. [Deployment Steps](#14-deployment-steps)
15. [Troubleshooting](#15-troubleshooting)
16. [Security Hardening](#16-security-hardening)
17. [API Reference Summary](#17-api-reference-summary)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    StaySuite HospitalityOS                    │
│                   Next.js 16 (Port 3000)                      │
│                                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │ WiFi    │ │ DNS     │ │ Firewall│ │ Captive Portal   │  │
│  │ Access  │ │ Server  │ │ & BW    │ │ & Hotspot        │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬─────────┘  │
│       │           │           │               │              │
│  ┌────▼───────────▼───────────▼───────────────▼──────────┐  │
│  │              Next.js API Routes                       │  │
│  │   /api/wifi/*  /api/kea/*  /api/networking/*         │  │
│  └──┬──────────┬──────────┬──────────┬──────────────────┘  │
│     │          │          │          │                       │
└─────┼──────────┼──────────┼──────────┼───────────────────────┘
      │          │          │          │
      ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│ FreeRADIUS│ │  Kea   │ │  DNS   │ │  nftables    │
│ Service   │ │Service │ │Service │ │  Service     │
│ :3010     │ │ :3011  │ │ :3012  │ │  :3013       │
└─────┬─────┘ └───┬────┘ └───┬────┘ └──────┬───────┘
      │           │          │              │
      ▼           ▼          ▼              ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│FreeRADIUS│ │  Kea   │ │dnsmasq │ │  nftables    │
│  daemon  │ │ DHCP4  │ │  DNS   │ │  kernel      │
│ systemd  │ │  unix  │ │  DNS   │ │  rules       │
└──────────┘ └────────┘ └────────┘ └──────────────┘
```

### Component Summary

| Component | Port | Runtime | Purpose |
|-----------|------|---------|---------|
| Next.js App | 3000 | Node.js | Main web application, API routes, Prisma ORM |
| FreeRADIUS Service | 3010 | Bun/Hono | RADIUS AAA, NAS clients, WiFi auth |
| Kea DHCP Service | 3011 | Bun/Hono | DHCP subnets, leases, reservations |
| DNS Service | 3012 | Bun/Hono | DNS zones, records, redirects, dnsmasq |
| nftables Service | 3013 | Bun/Hono | Firewall rules, bandwidth, MAC filtering |
| Availability Service | 3002 | Bun/Hono | Room availability checking |
| Realtime Service | 3003 | Bun/Socket.IO | WebSocket real-time updates |
| Caddy Gateway | 81 | Caddy | Reverse proxy, XTransformPort routing |

---

## 2. WiFi Menu Structure & Pages

### Navigation (8 Menu Items)

| Menu Item | ID | Component | Tabs |
|-----------|-----|-----------|------|
| WiFi Access | `wifi-access` | `wifi-access-page.tsx` | Sessions, Vouchers, Plans, Usage Logs, User Quotas |
| Gateway & RADIUS | `wifi-gateway-radius` | `gateway-radius-page.tsx` | Gateway Integration, AAA Config |
| Network | `wifi-network` | `network-page.tsx` | Interfaces, VLANs, Bridges, Bonds, Port Forward, Content Filter, Schedules, Backups |
| DHCP Server | `wifi-dhcp` | `dhcp-page.tsx` | Service Control, Subnets, Reservations, Leases, DHCP Options |
| DNS Server | `wifi-dns` | `dns-page.tsx` | Server, Zones, Records, Redirects, DHCP-DNS, Cache, Activity, Config |
| Captive Portal | `wifi-portal` | `portal-page.tsx` | Zones, Redirects, Portals, Designer, Mapping, Auth, Templates |
| Firewall & Bandwidth | `wifi-firewall` | `firewall-page.tsx` | Zones, Rules, MAC Filter, BW Policies, BW Monitor, Schedules, Content Filter |
| Reports | `wifi-reports` | `reports-page.tsx` | Bandwidth, User BW, Web Surfing, NAT Logs, Syslog, System Health |

### Additional Lazy-Loaded Components (not in main menu)

| ID | Component | Purpose |
|----|-----------|---------|
| `wifi-sessions` | `sessions.tsx` | Active WiFi session management |
| `wifi-vouchers` | `vouchers.tsx` | Voucher generation & management |
| `wifi-plans` | `plans.tsx` | WiFi plan CRUD |
| `wifi-logs` | `usage-logs.tsx` | Usage log viewer |
| `wifi-gateway` | `gateway-integration.tsx` | Gateway device management |
| `wifi-aaa` | `aaa-config.tsx` | AAA configuration |
| `wifi-quotas` | `user-quotas.tsx` | User data quotas |

---

## 3. Service Architecture

### 3.1 Next.js API Routes (Port 3000)

All API routes use Prisma ORM for database operations. Routes that interact with system services proxy to the appropriate mini-service.

**WiFi Routes:**
```
/api/wifi/users                    - WiFi user CRUD
/api/wifi/users/[id]               - Single user operations
/api/wifi/sessions                 - Session management
/api/wifi/vouchers                 - Voucher management
/api/wifi/plans                    - Plan management
/api/wifi/aaa                      - AAA configuration
/api/wifi/radius-server            - RADIUS server config
/api/wifi/nas                      - NAS client management (→ FreeRADIUS service)
/api/wifi/quotas                   - Data quota checking
/api/wifi/sync                     - RADIUS accounting sync
/api/wifi/freeradius               - FreeRADIUS service proxy
```

**Firewall Routes:**
```
/api/wifi/firewall/zones           - Firewall zone CRUD
/api/wifi/firewall/zones/[id]      - Single zone operations
/api/wifi/firewall/rules           - Firewall rule CRUD
/api/wifi/firewall/rules/[id]      - Single rule operations
/api/wifi/firewall/mac-filter      - MAC filter CRUD
/api/wifi/firewall/mac-filter/[id] - Single MAC filter operations
/api/wifi/firewall/bandwidth-policies    - BW policy CRUD
/api/wifi/firewall/bandwidth-policies/[id]
/api/wifi/firewall/bandwidth-pools       - BW pool CRUD
/api/wifi/firewall/bandwidth-pools/[id]
/api/wifi/firewall/bandwidth-usage       - BW usage metrics
/api/wifi/firewall/content-filter        - Content filter CRUD
/api/wifi/firewall/content-filter/[id]
/api/wifi/firewall/schedules             - Schedule CRUD
/api/wifi/firewall/schedules/[id]
/api/wifi/firewall/test                  - Test firewall rules (→ nftables service)
```

**Network Routes:**
```
/api/wifi/network/interfaces       - Interface CRUD
/api/wifi/network/interfaces/[id]
/api/wifi/network/vlans            - VLAN CRUD
/api/wifi/network/vlans/[id]
/api/wifi/network/bridges          - Bridge CRUD
/api/wifi/network/bridges/[id]
/api/wifi/network/bonds            - Bond CRUD
/api/wifi/network/bonds/[id]
/api/wifi/network/roles            - Interface roles
/api/wifi/network/backups          - Network config backups
/api/wifi/network/wan-failover     - WAN failover config
```

**Portal Routes:**
```
/api/wifi/portal/instances         - Captive portal CRUD
/api/wifi/portal/instances/[id]
/api/wifi/portal/templates         - Portal templates CRUD
/api/wifi/portal/templates/[id]
/api/wifi/portal/auth-methods      - Auth method CRUD
/api/wifi/portal/auth-methods/[id]
/api/wifi/portal/mappings          - SSID→Portal mapping CRUD
/api/wifi/portal/mappings/[id]
/api/wifi/portal/dns-zones         - DNS zone CRUD
/api/wifi/portal/dns-zones/[id]
/api/wifi/portal/dns-records       - DNS record CRUD
/api/wifi/portal/dns-records/[id]
/api/wifi/portal/dns-redirects     - DNS redirect CRUD
/api/wifi/portal/dns-redirects/[id]
```

**Report Routes:**
```
/api/wifi/reports/health           - System health
/api/wifi/reports/bandwidth        - Bandwidth reports
/api/wifi/reports/user-bandwidth   - Per-user bandwidth
/api/wifi/reports/web-surfing      - Web surfing logs
/api/wifi/reports/nat-logs         - NAT translation logs
/api/wifi/reports/syslog           - Syslog server management
/api/wifi/reports/syslog/[id]
```

### 3.2 Mini-Services

#### FreeRADIUS Service (Port 3010)
- **Runtime**: Bun + Hono
- **Database**: SQLite (`/opt/StaySuite/db/freeradius-service.db`)
- **Config Writes**: `/etc/freeradius/3.0/clients.conf` (StaySuite section)
- **System Commands**: `systemctl start/stop/restart/reload freeradius`
- **Auth**: Bearer token (`FREERADIUS_SERVICE_AUTH_SECRET` env var)

#### Kea DHCP Service (Port 3011)
- **Runtime**: Bun + Hono
- **Database**: Kea DHCP4 via unix socket + memfile leases
- **Config Writes**: Kea config file via `config-set` + `config-write` commands
- **System Commands**: `kea-dhcp4` process management

#### DNS Service (Port 3012)
- **Runtime**: Bun + Hono
- **Database**: SQLite (`/opt/StaySuite/db/dns-service.db`) + Prisma DB sync
- **Config Writes**: `/etc/dnsmasq.d/staysuite.conf`
- **System Commands**: `dnsmasq` start/stop/reload
- **Sync**: Auto-syncs from Prisma DB on startup, manual sync endpoints

#### nftables Service (Port 3013)
- **Runtime**: Bun + Hono
- **Database**: None (stateless - reads from nftables kernel)
- **Config Writes**: `/etc/nftables.d/staysuite.conf`
- **System Commands**: `nft` for all rule operations
- **Features**: Zones, rules, MAC filtering, bandwidth limiting, content filtering, config testing

---

## 4. Debian 13 System Requirements

### 4.1 Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB | 20 GB |
| Network | 1 NIC | 2+ NICs (WAN + LAN) |

### 4.2 Required Packages

```bash
# Core system
apt update && apt upgrade -y
apt install -y curl wget git build-essential

# Node.js 20+ and Bun
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
curl -fsSL https://bun.sh/install | bash

# PM2 process manager
npm install -g pm2

# nftables (default on Debian 13)
apt install -y nftables
systemctl enable nftables

# FreeRADIUS (for WiFi authentication)
apt install -y freeradius freeradius-sql freeradius-utils
systemctl enable freeradius

# Kea DHCP (for DHCP server)
apt install -y kea-dhcp4-server kea-ctrl-agent
systemctl enable kea-dhcp4-server

# dnsmasq (for DNS and DHCP-DNS integration)
apt install -y dnsmasq
# Note: Disable dnsmasq auto-start (StaySuite manages it)
systemctl disable dnsmasq
systemctl stop dnsmasq

# Caddy (for reverse proxy)
apt install -y caddy
```

### 4.3 Optional Packages

```bash
# For monitoring and diagnostics
apt install -y radtest          # RADIUS testing
apt install -y nmap             # Network scanning
apt install -y tcpdump          # Packet capture
apt install -y bridge-utils     # Bridge management
apt install -y vlan             # VLAN support
apt install -y ifenslave        # Bonding support
apt install -y ethtool          # NIC configuration
apt install -y conntrack        # Connection tracking
```

### 4.4 Kernel Modules

```bash
# Load required kernel modules
cat > /etc/modules-load.d/staysuite.conf << EOF
8021q          # VLAN support
bonding        # NIC bonding
bridge         # Bridge support
nf_conntrack   # Connection tracking
nf_nat         # NAT support
EOF

modprobe 8021q bonding bridge nf_conntrack nf_nat
```

### 4.5 Directory Structure

```
/opt/StaySuite/
├── app/                        # Next.js application
├── db/                         # SQLite databases
│   ├── custom.db               # Main Prisma database
│   ├── freeradius-service.db   # FreeRADIUS service database
│   └── dns-service.db          # DNS service database
├── mini-services/              # Bun microservices
│   ├── freeradius-service/
│   ├── kea-service/
│   ├── dns-service/
│   └── nftables-service/
├── prisma/                     # Prisma schema and seeds
├── freeradius-local/           # Local FreeRADIUS packages (offline install)
├── kea-local/                  # Local Kea packages (offline install)
├── dns-local/                  # DNS config files
├── deploy/                     # Deployment scripts
│   └── debian13/
├── ecosystem.config.js         # PM2 configuration
├── Caddyfile                   # Caddy reverse proxy config
└── .env                        # Environment variables
```

### 4.6 Environment Variables

```bash
# .env file
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://your-server:81"

# Mini-service auth (optional but recommended)
FREERADIUS_SERVICE_AUTH_SECRET="your-freeradius-secret"
NFTABLES_SERVICE_AUTH_SECRET="your-nftables-secret"

# Service URLs (defaults work for single-server)
FREERADIUS_SERVICE_URL="http://localhost:3010"
KEA_SERVICE_URL="http://localhost:3011"
DNS_SERVICE_URL="http://localhost:3012"
NFTABLES_SERVICE_URL="http://localhost:3013"
```

---

## 5. nftables Firewall Integration

### 5.1 Architecture

StaySuite uses **nftables** (NOT iptables) as the firewall backend on Debian 13. The nftables service translates database firewall rules into nftables rulesets.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  StaySuite   │     │  nftables    │     │   nftables   │
│  Firewall UI │────▶│  Service     │────▶│   kernel     │
│  (Next.js)   │     │  (port 3013) │     │   rules      │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│   Prisma DB  │     │  /etc/       │
│  (rules,     │     │  nftables.d/ │
│   zones,     │     │  staysuite   │
│   policies)  │     │  .conf       │
└──────────────┘     └──────────────┘
```

### 5.2 nftables Service API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/status` | GET | Check nftables installation and status |
| `/api/apply` | POST | Apply complete firewall config from DB |
| `/api/rules` | POST | Add single nftables rule |
| `/api/rules` | DELETE | Remove rule by handle |
| `/api/zones` | POST | Create zone table with chains |
| `/api/zones/:name` | DELETE | Delete zone table |
| `/api/mac-filter` | POST | Add MAC to whitelist/blacklist set |
| `/api/mac-filter` | DELETE | Remove MAC from set |
| `/api/bandwidth` | POST | Apply rate limiting rules |
| `/api/content-filter` | POST | DNS-based content filtering |
| `/api/test` | POST | Validate nftables config |
| `/api/flush` | POST | Flush all StaySuite rules |
| `/api/list` | GET | List current rules |
| `/api/config` | GET | Get staysuite.conf content |

### 5.3 Zone to nftables Mapping

```
StaySuite Zone (DB)               nftables Translation
─────────────────────             ─────────────────────
Zone: "guest_wifi"         →     table ip staysuite_zone_guest_wifi {
  inputPolicy: "drop"      →       chain input { type filter hook input priority 0; policy drop; }
  forwardPolicy: "accept"  →       chain forward { type filter hook forward priority 0; policy accept; }
  outputPolicy: "accept"   →       chain output { type filter hook output priority 0; policy accept; }
  interfaces: ["wlan0"]    →       # Applied via iifname "wlan0" in rules
}
```

### 5.4 Rule to nftables Mapping

```
StaySuite Rule (DB)               nftables Translation
─────────────────────             ─────────────────────
sourceIp: "10.0.1.0/24"    →     ip saddr 10.0.1.0/24
destIp: "0.0.0.0/0"        →     ip daddr 0.0.0.0/0
protocol: "tcp"             →     ip protocol tcp
sourcePort: 80              →     tcp sport 80
destPort: 443               →     tcp dport 443
action: "accept"            →     accept
action: "drop"              →     drop
action: "reject"            →     reject
action: "jump"              →     jump <jumpTarget>
```

### 5.5 MAC Filter to nftables Mapping

```
StaySuite MAC Filter (DB)         nftables Translation
───────────────────────           ─────────────────────
listType: "blacklist"       →    set mac_blacklist { type ether_addr; }
macAddress: "aa:bb:cc:..."  →    element = { aa:bb:cc:... }

Rule applied:
  ether saddr @mac_blacklist drop
```

### 5.6 Bandwidth Limiting with nftables

```
StaySuite BW Policy (DB)          nftables Translation
───────────────────────           ─────────────────────
downloadKbps: 1024          →    limit rate over 1024 kbytes/second drop
uploadKbps: 512             →    limit rate over 512 kbytes/second drop
subnet: "10.0.1.0/24"      →    ip saddr 10.0.1.0/24

Combined rule:
  ip saddr 10.0.1.0/24 limit rate over 1024 kbytes/second drop
```

### 5.7 Base nftables Template

The nftables service generates a base template with essential rules:

```nftables
#!/usr/sbin/nft -f

flush table ip staysuite

table ip staysuite {
  # Loopback - always allow
  chain input {
    type filter hook input priority 0; policy accept;
    iif "lo" accept
    ct state established,related accept
    ip protocol icmp accept
    # Guest rules here
  }

  chain forward {
    type filter hook forward priority 0; policy accept;
    ct state established,related accept
    # Forward rules here
  }

  chain output {
    type filter hook output priority 0; policy accept;
    # Output rules here
  }

  # MAC filter sets
  set mac_whitelist {
    type ether_addr
  }
  set mac_blacklist {
    type ether_addr
  }
}
```

### 5.8 Integration Flow

1. **User creates firewall zone** in StaySuite UI
2. **Next.js API** saves zone to Prisma DB
3. **Next.js API** calls `applyToNftables('/api/zones', 'POST', ...)` (non-blocking)
4. **nftables service** creates `table ip staysuite_zone_<name>` with chains
5. **nftables service** runs `nft -f <config>` to apply

For full regeneration (after rule changes):
1. **Next.js API** saves rule to Prisma DB
2. **Next.js API** calls `fullApplyToNftables(tenantId)` which:
   - Queries ALL zones, rules, MAC filters, BW policies, content filters from DB
   - Builds complete `FirewallConfig` object
   - Sends to `POST /api/apply` on nftables service
3. **nftables service** generates complete staysuite.conf
4. **nftables service** validates with `nft -c -f`
5. **nftables service** applies with `nft -f`

---

## 6. FreeRADIUS Configuration

### 6.1 StaySuite-Managed Section

StaySuite writes to FreeRADIUS config files using section markers:

```
# >>>>>> StaySuite managed NAS clients <<<<<<
client guest-ap {
    ipaddr = 10.0.1.1
    secret = <encrypted>
    shortname = guest-ap
    nas-type = other
}
# <<<<<< StaySuite managed NAS clients >>>>>>
```

### 6.2 RADIUS Authentication Flow

```
Guest Device → Access Point → FreeRADIUS → StaySuite API → Allow/Deny
                     │                          │
                     │   1. Access-Request      │
                     │   (username, password)   │
                     ├─────────────────────────►│
                     │                          │
                     │   2. radcheck lookup     │
                     │   (Cleartext-Password)   │
                     │                          │
                     │   3. radreply attributes │
                     │   (MikroTik-Rate-Limit,  │
                     │    WISPr-Bandwidth-*)    │
                     │                          │
                     │   4. Access-Accept/      │
                     │      Access-Reject       │
                     │◄─────────────────────────┤
                     │                          │
```

### 6.3 FreeRADIUS Service API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/status` | GET | FreeRADIUS service status |
| `/api/nas` | GET | List NAS clients |
| `/api/nas` | POST | Add NAS client |
| `/api/nas/:id` | PUT | Update NAS client |
| `/api/nas/:id` | DELETE | Delete NAS client |
| `/api/users` | GET | List RADIUS users |
| `/api/users` | POST | Add RADIUS user |
| `/api/users/:id` | PUT | Update RADIUS user |
| `/api/users/:id` | DELETE | Delete RADIUS user |
| `/api/groups` | GET | List RADIUS groups |
| `/api/groups` | POST | Add RADIUS group |
| `/api/test` | POST | Test RADIUS connectivity (radtest) |
| `/api/logs` | GET | Get FreeRADIUS logs |
| `/api/start` | POST | Start FreeRADIUS daemon |
| `/api/stop` | POST | Stop FreeRADIUS daemon |
| `/api/restart` | POST | Restart FreeRADIUS daemon |
| `/api/config/import` | POST | Import config |
| `/api/sync-users` | POST | Sync users from DB |
| `/api/sync-clients` | POST | Sync NAS clients from DB |

### 6.4 Data Persistence

FreeRADIUS service uses SQLite (`freeradius-service.db`) for persistent storage:
- `nas_clients` - NAS client definitions
- `radius_users` - RADIUS user credentials and attributes
- `radius_groups` - RADIUS group definitions

Data is also written to FreeRADIUS config files for the daemon to use.

---

## 7. Kea DHCP Server

### 7.1 Kea Communication

StaySuite communicates with Kea DHCP4 via unix socket using the Kea Control API:

```json
{
  "command": "config-get",
  "service": ["dhcp4"]
}
```

### 7.2 Kea Service API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/status` | GET | Kea service status and config |
| `/api/subnets` | GET | List DHCP subnets |
| `/api/subnets` | POST | Add subnet |
| `/api/subnets/:id` | PUT | Update subnet |
| `/api/subnets/:id` | DELETE | Delete subnet |
| `/api/reservations` | GET | List host reservations |
| `/api/reservations` | POST | Add reservation |
| `/api/reservations/:id` | PUT | Update reservation |
| `/api/reservations/:id` | DELETE | Delete reservation |
| `/api/leases` | GET | List active leases |
| `/api/interfaces` | GET | List network interfaces |
| `/api/interfaces` | POST | Update interface config |
| `/api/start` | POST | Start Kea DHCP4 |
| `/api/stop` | POST | Stop Kea DHCP4 |
| `/api/restart` | POST | Restart Kea DHCP4 |
| `/api/os/interfaces` | GET | OS-level interface data |
| `/api/os/system-info` | GET | System information |
| `/api/os/nat/forwards` | GET | NAT port forwards |

### 7.3 Dual-Path Data Strategy

Most WiFi pages use a "Kea first, DB fallback" pattern:
1. Try Kea service API first (real system data)
2. If Kea unavailable, fall back to Prisma DB
3. Writes go to both Kea and DB

---

## 8. DNS Server (dnsmasq)

### 8.1 DNS Service Architecture

```
StaySuite UI → Next.js API → DNS Service (port 3012) → dnsmasq daemon
                                   │
                                   ├── SQLite DB (own tables)
                                   └── Prisma DB sync (cross-database)
```

### 8.2 DNS Service API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/status` | GET | DNS service status |
| `/api/zones` | GET | List DNS zones |
| `/api/zones` | POST | Create zone |
| `/api/zones/:id` | PUT | Update zone |
| `/api/zones/:id` | DELETE | Delete zone |
| `/api/zones/bulk-delete` | POST | Bulk delete zones |
| `/api/records` | GET | List DNS records |
| `/api/records` | POST | Create record |
| `/api/records/:id` | PUT | Update record |
| `/api/records/:id` | DELETE | Delete record |
| `/api/records/bulk-delete` | POST | Bulk delete records |
| `/api/redirects` | GET | List DNS redirects |
| `/api/redirects` | POST | Create redirect |
| `/api/redirects/:id` | PUT | Update redirect |
| `/api/redirects/:id` | DELETE | Delete redirect |
| `/api/forwarders` | GET | List upstream DNS forwarders |
| `/api/forwarders` | POST | Add forwarder |
| `/api/forwarders/:id` | DELETE | Remove forwarder |
| `/api/dhcp-dns` | GET | DHCP-DNS lease list |
| `/api/cache/flush` | POST | Flush DNS cache |
| `/api/activity` | GET | Activity log |
| `/api/stats` | GET | DNS statistics |
| `/api/config` | GET | Get dnsmasq config |
| `/api/config` | POST | Update dnsmasq config (validated) |
| `/api/service/:action` | POST | Start/stop/restart/reload dnsmasq |
| `/api/sync` | POST | Sync from Prisma DB |
| `/api/sync-from-prisma` | POST | Full Prisma→DNS sync |
| `/api/sync-to-prisma` | POST | Full DNS→Prisma sync |

### 8.3 Config Validation

The DNS service validates dnsmasq config before applying:
- Only whitelisted dnsmasq directives allowed (50+ recognized)
- Shell metacharacters rejected (`;|&`$`)
- Command injection patterns blocked (`$()`, `${}`, `rm`, `sh`, `sudo`)
- Path traversal blocked (`../`, `/etc/passwd`)

### 8.4 Prisma DB Sync

On startup, DNS service auto-syncs from the Prisma database:
1. Opens Prisma DB (`custom.db`) in read-only mode
2. Reads `DnsZone`, `DnsRecord`, `DnsRedirectRule` tables
3. Maps fields (handles schema differences)
4. Upserts into DNS service's own SQLite tables
5. Regenerates dnsmasq config

Manual sync endpoints:
- `POST /api/sync-from-prisma` — Pull from Prisma
- `POST /api/sync-to-prisma` — Push to Prisma

---

## 9. Captive Portal

### 9.1 Portal Flow

```
1. Guest connects to WiFi SSID
2. DHCP assigns IP (Kea DHCP)
3. DNS redirects to captive portal (dnsmasq address= redirect)
4. Guest sees login page (StaySuite portal)
5. Guest authenticates (room number + name, voucher, social login)
6. StaySuite creates WiFi user in FreeRADIUS
7. FreeRADIUS allows device on network
8. nftables applies bandwidth/content rules
```

### 9.2 Portal Components

- **Portal Instances**: Configurable portal pages with custom branding
- **Auth Methods**: Room+Name, Voucher, Social Login, SMS OTP
- **Portal Mapping**: SSID → Portal mapping (which portal shows for which WiFi network)
- **DNS Zones**: DNS zones used for captive portal redirect
- **DNS Records**: DNS records for portal resolution
- **DNS Redirects**: Redirect rules to force traffic to portal
- **Templates**: Pre-built portal templates (Hotel Guest, Premium, Business)

---

## 10. Network Interfaces & VLANs

### 10.1 Interface Management

The Network page manages:
- **Physical Interfaces**: eth0, wlan0, etc.
- **VLANs**: eth0.100, eth0.200 for network segmentation
- **Bridges**: br0, br-guest for layer 2 connectivity
- **Bonds**: bond0 for link aggregation
- **Port Forwarding**: NAT port forward rules
- **WAN Failover**: Multi-WAN configuration

### 10.2 OS Integration

Network configuration is managed through:
1. **Kea Service** - Reads from `/sys/class/net/` for live interface data
2. **iproute2** - Interface configuration via `ip` commands
3. **/etc/network/interfaces** - Persistent configuration (Debian)

### 10.3 Recommended VLAN Layout

| VLAN ID | Name | Subnet | Purpose |
|---------|------|--------|---------|
| 100 | Management | 10.0.0.0/24 | Hotel management network |
| 200 | Guest WiFi | 10.0.1.0/24 | Guest internet access |
| 300 | Staff WiFi | 10.0.2.0/24 | Staff network |
| 400 | IoT Devices | 10.0.3.0/24 | Smart room devices |
| 500 | POS Systems | 10.0.4.0/24 | Restaurant POS |
| 600 | Surveillance | 10.0.5.0/24 | IP cameras |

---

## 11. WiFi Access & Voucher Flow

### 11.1 Complete Guest WiFi Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│                    Guest WiFi Onboarding Flow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Front Desk creates booking                                  │
│     └─► Booking created in StaySuite PMS                        │
│                                                                  │
│  2. Check-in generates WiFi access                              │
│     └─► WiFi user created in DB (radCheck/radReply)             │
│     └─► User synced to FreeRADIUS service                       │
│     └─► Voucher code generated (crypto.randomBytes)             │
│                                                                  │
│  3. Guest receives credentials                                  │
│     └─► Room card with WiFi info                                │
│     └─► SMS with voucher code                                   │
│     └─► Or scans QR code at room                                │
│                                                                  │
│  4. Guest connects to WiFi                                      │
│     └─► DHCP assigns IP (Kea)                                   │
│     └─► DNS redirects to portal (dnsmasq)                       │
│     └─► Captive portal shows login                              │
│                                                                  │
│  5. Guest authenticates                                         │
│     └─► Room number + voucher code                              │
│     └─► Or room number + guest name                             │
│     └─► FreeRADIUS verifies credentials                         │
│                                                                  │
│  6. Network access granted                                      │
│     └─► Bandwidth policy applied (nftables)                     │
│     └─► Content filter applied (dnsmasq + nftables)             │
│     └─► Session logged (radacct)                                │
│                                                                  │
│  7. Session monitoring                                          │
│     └─► Data usage tracked (sync route)                         │
│     └─► Quota enforcement (quotas route)                        │
│     └─► Session timeout (FreeRADIUS Session-Timeout)            │
│                                                                  │
│  8. Check-out                                                   │
│     └─► WiFi user disabled/expired                              │
│     └─► FreeRADIUS synced                                       │
│     └─► Session terminated (CoA disconnect)                     │
│     └─► Final usage logged for billing                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Voucher System

- **Code Generation**: `crypto.randomBytes(8).toString('hex').toUpperCase()` (cryptographically secure)
- **Batch Creation**: Create multiple vouchers at once
- **Plan Association**: Each voucher linked to a WiFi plan (speed/data limits)
- **One-Time Use**: Voucher consumed on first authentication
- **Expiry**: Vouchers have configurable validity period
- **Room Charge**: Optional folio charge for paid WiFi plans

### 11.3 WiFi Plans

| Field | Type | Description |
|-------|------|-------------|
| name | string | Plan name (e.g., "Basic 5Mbps") |
| downloadSpeed | number | Download speed in Kbps |
| uploadSpeed | number | Upload speed in Kbps |
| dataLimit | number | Data cap in MB (0 = unlimited) |
| maxSessions | number | Max concurrent devices |
| duration | number | Session duration in hours |
| price | number | Price for billing |
| isDefault | boolean | Default plan for new users |

---

## 12. Reports & Monitoring

### 12.1 Report Types

| Report | Source | Data |
|--------|--------|------|
| Bandwidth | `bandwidthUsageDaily` | Daily bandwidth by subnet |
| User Bandwidth | `bandwidthUsageSession` + `wiFiSession` | Per-user data usage |
| Web Surfing | `natLog` (destDomain) | Domain access logs |
| NAT Logs | `natLog` | NAT translation entries |
| Syslog | `syslogServer` + `syslogEntry` | System log entries |
| System Health | `systemNetworkHealth` | CPU, RAM, disk, network |

### 12.2 Real-time Monitoring

- **Bandwidth Monitor** (Firewall page): Live bandwidth usage with 5-second polling
- **Active Sessions** (WiFi Access page): Current WiFi sessions
- **DNS Cache** (DNS page): DNS cache hit/miss statistics
- **Activity Log** (DNS page): DNS configuration changes

### 12.3 CSV Export

All report tabs support CSV export with real data download.

---

## 13. End-to-End Data Flow

### 13.1 Creating a Firewall Rule (Complete Flow)

```
User Action: Click "Add Rule" in Firewall & Bandwidth page
     │
     ▼
Frontend (firewall-page.tsx):
  - Collects form data (sourceIp, destIp, protocol, ports, action, zoneId)
  - POST /api/wifi/firewall/rules
     │
     ▼
Next.js API Route (firewall/rules/route.ts):
  - Auth: requirePermission(request, 'wifi.manage')
  - Validate: sourceIp, destIp format, port ranges
  - Write: db.firewallRule.create({...})
  - After DB write: fullApplyToNftables(tenantId)
     │
     ├──▶ nftables-helper.ts:
     │      - Queries ALL zones, rules, MAC filters, BW policies, content filters
     │      - Builds complete FirewallConfig object
     │      - POST http://localhost:3013/api/apply
     │         │
     │         ▼
     │      nftables Service (port 3013):
     │        - Generates staysuite.conf from config
     │        - Validates: nft -c -f staysuite.conf
     │        - Applies: nft -f staysuite.conf
     │        - Returns: { success, rulesApplied }
     │
     ▼
Response to Frontend:
  - { success: true, rule: {...} }
  - UI refreshes rule list
```

### 13.2 WiFi User Authentication (Complete Flow)

```
Guest Device sends: Access-Request (username, password)
     │
     ▼
Access Point (NAS) forwards to FreeRADIUS
     │
     ▼
FreeRADIUS checks:
  1. radcheck table → Cleartext-Password := <password>
  2. radreply table → MikroTik-Rate-Limit, WISPr-Bandwidth-*
  3. radgroupcheck → Group membership
     │
     ├── Valid credentials → Access-Accept + CoA attributes
     │                         │
     │                         ▼
     │                    nftables applies bandwidth rules
     │                    Session starts (radacct Start record)
     │
     └── Invalid credentials → Access-Reject
```

### 13.3 DNS Query Flow

```
Guest Device: DNS query for "facebook.com"
     │
     ▼
dnsmasq (StaySuite managed):
  1. Check DNS redirects → facebook.com → 10.0.1.1 (portal IP)
  2. If no redirect, forward to upstream DNS (8.8.8.8)
  3. Cache result for future queries
     │
     ├── Redirected → Guest browser shows captive portal
     └── Not redirected → Normal DNS resolution
```

---

## 14. Deployment Steps

### 14.1 Initial Deployment

```bash
# 1. Clone the repository
cd /opt
git clone <repo-url> StaySuite
cd StaySuite

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Initialize database
npx prisma db push
npx tsx prisma/seed.ts

# 5. Install mini-service dependencies
cd mini-services/freeradius-service && bun install && cd ../..
cd mini-services/kea-service && bun install && cd ../..
cd mini-services/dns-service && bun install && cd ../..
cd mini-services/nftables-service && bun install && cd ../..
cd mini-services/availability-service && bun install && cd ../..
cd mini-services/realtime-service && bun install && cd ../..

# 6. Install system packages
apt install -y nftables freeradius freeradius-sql kea-dhcp4-server dnsmasq

# 7. Configure nftables directory
mkdir -p /etc/nftables.d

# 8. Build and start
npm run build
pm2 start ecosystem.config.js

# 9. Save PM2 configuration
pm2 save
pm2 startup
```

### 14.2 Caddy Configuration

The Caddyfile at `/opt/StaySuite/Caddyfile` should include:

```caddy
:81 {
    # Next.js app
    handle {
        reverse_proxy localhost:3000
    }
}
```

All mini-service API calls use `XTransformPort` query parameter:
- `?XTransformPort=3010` for FreeRADIUS
- `?XTransformPort=3011` for Kea
- `?XTransformPort=3012` for DNS
- `?XTransformPort=3013` for nftables

### 14.3 PM2 Configuration

The `ecosystem.config.js` includes all services:

```javascript
module.exports = {
  apps: [
    { name: 'staysuite', script: 'node .next/standalone/server.js', env: { PORT: 3000 } },
    { name: 'availability-service', script: 'mini-services/availability-service/server.ts', interpreter: 'bun' },
    { name: 'realtime-service', script: 'mini-services/realtime-service/index.ts', interpreter: 'bun' },
    { name: 'freeradius-service', script: 'mini-services/freeradius-service/index.ts', interpreter: 'bun' },
    { name: 'dns-service', script: 'mini-services/dns-service/index.ts', interpreter: 'bun' },
    { name: 'nftables-service', script: 'mini-services/nftables-service/index.ts', interpreter: 'bun' },
  ]
};
```

### 14.4 nftables Initial Setup

```bash
# Create nftables config directory
mkdir -p /etc/nftables.d

# Create main nftables.conf that includes StaySuite config
cat > /etc/nftables.conf << 'EOF'
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables.d/*.conf"
EOF

# Enable and start nftables
systemctl enable nftables
systemctl start nftables

# Verify nftables is running
nft list ruleset
```

### 14.5 FreeRADIUS Setup

```bash
# Enable and start FreeRADIUS
systemctl enable freeradius
systemctl start freeradius

# Verify FreeRADIUS is running
radtest test test localhost 0 testing123

# Configure FreeRADIUS to use SQL (optional for advanced setups)
# Edit /etc/freeradius/3.0/sites-available/default
# Uncomment sql in authorize, authenticate, accounting sections
```

### 14.6 dnsmasq Setup

```bash
# Install dnsmasq
apt install -y dnsmasq

# Stop and disable auto-start (StaySuite manages it)
systemctl stop dnsmasq
systemctl disable dnsmasq

# Create config directory
mkdir -p /etc/dnsmasq.d

# StaySuite will create and manage /etc/dnsmasq.d/staysuite.conf
```

---

## 15. Troubleshooting

### 15.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| DNS service not starting | Port 3012 in use | `fuser -k 3012/tcp` then restart |
| FreeRADIUS auth fails | radcheck/radreply missing | Sync users via `/api/freeradius` sync-users action |
| Firewall rules not applied | nftables not installed | `apt install nftables` |
| DHCP not assigning | Kea not configured | Check Kea config via `/api/kea/status` |
| Captive portal not showing | DNS redirect missing | Create redirect rule in DNS page |
| BW monitoring shows zeros | No actual traffic | Verify nftables rules and interface selection |

### 15.2 Service Health Check

```bash
# Check all services
pm2 list

# Check individual service health
curl http://localhost:3010/health   # FreeRADIUS
curl http://localhost:3012/health   # DNS
curl http://localhost:3013/health   # nftables

# Check nftables rules
nft list ruleset

# Check FreeRADIUS status
systemctl status freeradius

# Check dnsmasq status
ps aux | grep dnsmasq

# Check Kea status
systemctl status kea-dhcp4-server
```

### 15.3 Log Locations

| Service | Log Path |
|---------|----------|
| Next.js | `/home/z/.pm2/logs/staysuite-out.log` |
| FreeRADIUS | `/home/z/.pm2/logs/freeradius-service-out.log` |
| FreeRADIUS daemon | `/var/log/freeradius/radius.log` |
| DNS Service | `/home/z/.pm2/logs/dns-service-out.log` |
| nftables Service | `/home/z/.pm2/logs/nftables-service-out.log` |
| Kea DHCP | `/var/log/kea/kea-dhcp4.log` |
| System | `/var/log/syslog` |

---

## 16. Security Hardening

### 16.1 Mini-Service Authentication

All mini-services support Bearer token authentication:

```bash
# Set auth secrets in .env
FREERADIUS_SERVICE_AUTH_SECRET="your-strong-secret-here"
NFTABLES_SERVICE_AUTH_SECRET="your-strong-secret-here"
DNS_SERVICE_AUTH_SECRET="your-strong-secret-here"
```

When configured, all API calls must include:
```
Authorization: Bearer <secret>
```

### 16.2 nftables Security

```bash
# Ensure default deny policy on input chain
# StaySuite nftables template includes:
# chain input { type filter hook input priority 0; policy drop; }

# Allow only necessary ports
nft add rule ip staysuite input tcp dport { 80, 443, 1812, 1813 } accept
nft add rule ip staysuite input udp dport { 67, 68, 53, 1812, 1813 } accept
```

### 16.3 FreeRADIUS Security

```bash
# Use strong shared secrets for NAS clients
# Never use "testing123" in production

# Restrict FreeRADIUS to specific interfaces
# Edit /etc/freeradius/3.0/radiusd.conf
# listen { ipaddr = 10.0.0.1 }
```

### 16.4 DNS Security

- DNS config injection is validated (50+ whitelisted directives only)
- Shell metacharacters and command injection patterns blocked
- dnsmasq runs as non-root user

---

## 17. API Reference Summary

### WiFi API (Port 3000 via Next.js)

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/wifi/users` | GET, POST | wifi.view / wifi.manage |
| `/api/wifi/users/[id]` | GET, PATCH, DELETE | wifi.view / wifi.manage |
| `/api/wifi/sessions` | GET, POST, PUT, DELETE | wifi.view / wifi.manage |
| `/api/wifi/vouchers` | GET, POST, PUT, DELETE | wifi.view / wifi.manage |
| `/api/wifi/plans` | GET, POST, PUT, DELETE | wifi.view / wifi.manage |
| `/api/wifi/aaa` | GET, POST | wifi.manage |
| `/api/wifi/radius-server` | GET, POST, DELETE | wifi.manage |
| `/api/wifi/nas` | GET, POST, PUT, DELETE | wifi.manage |
| `/api/wifi/quotas` | GET, POST | wifi.view / wifi.manage |
| `/api/wifi/sync` | POST, GET | wifi.manage |
| `/api/wifi/freeradius` | GET, POST | wifi.manage |
| `/api/wifi/firewall/*` | GET, POST, PUT, DELETE | wifi.view / wifi.manage |
| `/api/wifi/network/*` | GET, POST, PUT, DELETE | wifi.view / wifi.manage |
| `/api/wifi/portal/*` | GET, POST, PUT, DELETE | wifi.manage / network.manage |
| `/api/wifi/reports/*` | GET | reports.view |

### Mini-Service Ports

| Service | Port | Access |
|---------|------|--------|
| FreeRADIUS Service | 3010 | Internal only (via XTransformPort) |
| Kea DHCP Service | 3011 | Internal only (via XTransformPort) |
| DNS Service | 3012 | Internal only (via XTransformPort) |
| nftables Service | 3013 | Internal only (via XTransformPort) |

### System Services

| Service | Default Port | Config Path |
|---------|-------------|-------------|
| FreeRADIUS | 1812/1813 (auth/acct) | `/etc/freeradius/3.0/` |
| Kea DHCP4 | 67 (DHCP) | `/etc/kea/kea-dhcp4.conf` |
| dnsmasq | 53 (DNS) | `/etc/dnsmasq.d/staysuite.conf` |
| nftables | N/A (kernel) | `/etc/nftables.d/staysuite.conf` |

---

## Bug Fixes Applied (Scan Results)

### Frontend Fixes

| File | Bug | Fix |
|------|-----|-----|
| firewall-page.tsx | `randomBetween()` fake data | Removed; real API calls instead |
| firewall-page.tsx | Fake "Test Rules" button | Real `POST /api/wifi/firewall/test` call |
| firewall-page.tsx | Fake BW Monitor data | Real bandwidth-usage API polling |
| firewall-page.tsx | Local `Globe` shadows import | Removed local, use lucide-react |
| reports-page.tsx | CSV/PDF export stubs | Real CSV download, print-based PDF |
| reports-page.tsx | Hardcoded property list | `usePropertyId()` hook |
| reports-page.tsx | Property filter not sent to API | Added propertyId parameter |
| portal-page.tsx | `propertyId: 'default'` hardcoded | Dynamic from `usePropertyId()` |
| network-page.tsx | `_osData` not in interface | Added `_osData?: any` |
| network-page.tsx | CIDR prefix as number | Converts to dotted-decimal mask |

### Backend API Fixes

| File | Bug | Fix |
|------|-----|-----|
| sync/route.ts | Empty where clause (no incremental sync) | Added `radacctid > lastRadAcctId` |
| sync/route.ts | `acctstatus` (wrong field) | Changed to `acctstatustype` |
| sync/route.ts | Only input octets counted | Added output octets |
| sync/route.ts | Creates new sync record every time | Upserts existing record |
| sync/route.ts | `where: { id: tenantId }` (wrong field) | Changed to `where: { tenantId }` |
| sync/route.ts | No tenant filter on batch ops | Added tenantId filter |
| vouchers/route.ts | Voucher consumed on provision fail | Only marks used after success |
| vouchers/route.ts | `Math.random()` for codes | `crypto.randomBytes()` |
| sessions/route.ts | PUT/DELETE use `wifi.view` | Changed to `wifi.manage` |
| users/[id]/route.ts | No permission check | Added `requirePermission` |
| users/[id]/route.ts | No tenantId in update where | Added via `updateMany` |
| nas/route.ts | No tenant filtering on GET/DELETE | Added tenantId |
| user-bandwidth/route.ts | 100% mock data | Real Prisma DB queries |
| web-surfing/route.ts | Search overwrites `not: null` filter | Proper `AND` merge |

### Mini-Service Fixes

| Service | Bug | Fix |
|---------|-----|-----|
| FreeRADIUS | All data in-memory (lost on restart) | SQLite persistence |
| FreeRADIUS | Config writes commented out | Enabled with section markers |
| FreeRADIUS | No authentication | Bearer token auth middleware |
| FreeRADIUS | Fake RADIUS test | Real `radtest` command |
| DNS | Separate DB from Prisma | Added sync-from/to-prisma endpoints |
| DNS | Auto-sync on startup | Reads Prisma DB on boot |
| DNS | Config injection vulnerability | Added dnsmasq directive validation |
| DNS | Fake random stats | Removed `Math.random()` from stats |

### New Services Created

| Service | Port | Purpose |
|---------|------|---------|
| nftables-service | 3013 | Real nftables firewall rule management |

### New Integration

| Feature | Description |
|---------|-------------|
| nftables integration | All firewall API routes now apply rules to nftables |
| `/api/wifi/firewall/test` | New endpoint to validate nftables config |
| `nftables-helper.ts` | Shared utility for nftables service communication |

---

*Document generated: April 2026*
*StaySuite HospitalityOS v1.0*
*Debian 13 + nftables deployment*
