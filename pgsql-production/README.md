# StaySuite-HospitalityOS — Production PostgreSQL Schema & Seed

Production-ready database artifacts for StaySuite-HospitalityOS PMS + WiFi provisioning + RADIUS integration.

## Folder Structure

```
pgsql-production/
├── README.md                    ← This file
├── schema.prisma                ← Prisma schema (PostgreSQL provider, 226 models)
├── 01-freeradius-schema.sql     ← FreeRADIUS v3 standard tables (7 tables + indexes)
├── 02-staysuite-views.sql       ← 5 custom reporting views + helper table
├── 03-radius-seed.sql           ← FreeRADIUS native table seed data
└── deploy.sh                     ← Automated deployment script
```

## Deployment Order

Execute files in this exact order:

1. `npx prisma db push --schema pgsql-production/schema.prisma`  — Creates all 226 Prisma tables
2. `psql -d staysuite -f pgsql-production/01-freeradius-schema.sql`  — Creates 7 FreeRADIUS tables
3. `psql -d staysuite -f pgsql-production/02-staysuite-views.sql`   — Creates helper table + 5 views
4. `bun run prisma/seed.ts`                                        — Seeds app data via Prisma
5. `bun run prisma/wifi-seed.ts`                                    — Seeds WiFi module data via Prisma
6. `psql -d staysuite -f pgsql-production/03-radius-seed.sql`       — Seeds FreeRADIUS native tables

Or use the one-click deploy script:

```bash
bash pgsql-production/deploy.sh
```

## Important Notes

### Dual Credential Store
The system has TWO credential stores for RADIUS:
- **Prisma-managed tables** (`RadCheck`, `RadReply`, `RadUserGroup`): Used by the app to manage credentials
- **Native FreeRADIUS tables** (`radcheck`, `radgroupcheck`, `radgroupreply`, `radusergroup`): Used by FreeRADIUS server directly

The `v_wifi_users` view bridges both stores by reading password from native `radcheck` and group from native `radusergroup`.

### Login Credentials (from seed.ts)
| Email | Password | Role |
|-------|----------|------|
| admin@royalstay.in | admin123 | Administrator (Tenant 1) |
| frontdesk@royalstay.in | staff123 | Front Desk (Tenant 1) |
| platform@staysuite.com | admin123 | Platform Admin |

### RADIUS WiFi Test Credentials (from 03-radius-seed.sql)
| Username | Password | Group | Plan |
|----------|----------|-------|------|
| guest.amit.mukherjee | Welcome@123 | wifi-premium | 25/10 Mbps |
| guest.sneha.gupta | Secure@456 | wifi-standard | 10/5 Mbps |
| guest.rahul.banerjee | Pass@789 | wifi-free | 2/1 Mbps |
| guest.vikram.singh | Hotel@321 | wifi-vip | 50/25 Mbps |
| guest.anita.sharma | Guest@111 | wifi-basic | 5/2 Mbps |
| guest.deepak.patel | Guest@222 | wifi-standard | 10/5 Mbps |
| staff.priya.das | Staff@654 | wifi-staff | 100/50 Mbps |
| event.user001 | Event@2025 | wifi-free | 2/1 Mbps |
| event.user002 | Event@2025 | wifi-free | 2/1 Mbps |
| test.admin | Admin@999 | wifi-vip | 50/25 Mbps |

### WiFi Plan Groups & Bandwidth
| Group | Download / Upload | Session Timeout | Simultaneous Use |
|-------|-------------------|-----------------|------------------|
| wifi-free | 2M / 1M | 1 hour | 1 |
| wifi-basic | 5M / 2M | 4 hours | 2 |
| wifi-standard | 10M / 5M | 24 hours | 3 |
| wifi-premium | 25M / 10M | 24 hours | 5 |
| wifi-vip | 50M / 25M | 24 hours | 10 |
| wifi-staff | 100M / 50M | 12 hours | 3 |

### NAS (Access Point) Inventory
| ID | IP Address | Short Name | Hardware | Location |
|----|-----------|------------|----------|----------|
| 1 | 192.168.1.1 | mikrotik-lobby | MikroTik hAP ac3 | Lobby |
| 2 | 192.168.1.2 | mikrotik-pool | MikroTik hAP ac3 | Pool Area |
| 3 | 192.168.1.3 | mikrotik-restaurant | MikroTik hAP ac3 | Restaurant |
| 4 | 192.168.1.4 | mikrotik-floor1 | MikroTik cAP ac | Floor 1 |
| 5 | 192.168.1.5 | mikrotik-floor2 | MikroTik cAP ac | Floor 2 |

> **RADIUS Shared Secret**: `StaysuiteSecret2025` (configured for all NAS entries)

### Views (GUI Data Layer)
All GUI tabs read from these views — never from raw FreeRADIUS tables directly:

| View | Purpose | Dashboard Tab |
|------|---------|---------------|
| `v_active_sessions` | Currently online sessions | Active Users, Stats Widgets |
| `v_session_history` | All sessions (active + completed) | Session History, Auth Logs |
| `v_auth_logs` | Authentication attempts (from radpostauth) | Auth Logs |
| `v_user_usage` | Per-user bandwidth & session aggregation | User Usage Dashboard |
| `v_wifi_users` | Complete user profiles with RADIUS bridging | Users Management, RADIUS Sync |

### Helper Table
| Table | Purpose |
|-------|---------|
| `data_usage_by_period` | Stores aggregated data usage per user per time period for bandwidth charts |

### Seed Data Summary
| Source | Tables | Rows |
|--------|--------|------|
| `seed.ts` | Prisma app tables | Tenants, Users, Properties, Rooms, Bookings, Guests |
| `wifi-seed.ts` | Prisma WiFi tables | WiFiPlans, WiFiUsers, WiFiSessions |
| `03-radius-seed.sql` | FreeRADIUS native tables | radcheck (10), radgroupcheck (6), radgroupreply (24), radusergroup (10), nas (5), radpostauth (19), radacct (3) |

### SQLite Dev (Preserved)
The original SQLite development artifacts are preserved in the project root:
- `prisma/schema.prisma` — Currently points to PostgreSQL (was SQLite)
- `db/custom.db` — SQLite database for dev
- `seed.ts` — Legacy SQLite seed (uses string IDs)

These should NOT be used in production.
