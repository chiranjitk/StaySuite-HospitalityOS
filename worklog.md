# StaySuite HospitalityOS — Worklog

---
Task ID: 1
Agent: Main Agent
Task: Install PostgreSQL 17 from source, initialize cluster, create staysuite database

Work Log:
- Cleaned stale worklog entries from previous sessions
- Built PostgreSQL 17.9 from source at `/home/z/pgsql-17/`
- Initialized data cluster, tuned config, started on localhost:5432
- Created `staysuite` database

Stage Summary:
- PostgreSQL 17.9 running on localhost:5432 (user: z, trust auth)
- Connection string: `postgresql://z@localhost:5432/staysuite`

---
Task ID: 2
Agent: Main Agent
Task: Import FreeRADIUS PostgreSQL schema, create views, configure FreeRADIUS with PostgreSQL, seed data, fix API routes

Work Log:
- Imported FreeRADIUS official PostgreSQL schema (10 tables): radacct, radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, radpostauth, nas, nasreload, data_usage_by_period
- StaySuite application tables already existed (230+ tables via Prisma push)
- Created 5 PostgreSQL views: v_wifi_users, v_session_history, v_active_sessions, v_user_usage, v_auth_logs
  - Views join FreeRADIUS raw tables with StaySuite app tables (Guest, Booking, Room, Property, WiFiPlan, WiFiSession)
  - Replaced SQLite-specific `datetime()` calls with PostgreSQL timestamp handling
  - Used correct PostgreSQL lowercase column names (not mixed-case as in SQLite)
- Seeded test data:
  - 6 RADIUS groups (wifi-free, wifi-basic, wifi-standard, wifi-premium, wifi-vip, wifi-staff) with bandwidth attributes
  - 10 RADIUS user credentials in radcheck
  - 10 user-to-group mappings in radusergroup
  - 6 Simultaneous-Use limits in radgroupcheck
  - 5 NAS definitions (MikroTik APs on 192.168.1.x)
  - 15 post-auth log entries (accepts and rejects)
  - 11 radacct entries (4 active + 7 completed sessions)
  - 8 WiFiSession records (4 active + 4 completed)
  - Updated WiFiUser bandwidth stats
- Fixed FreeRADIUS SQL module config (already set to PostgreSQL)
- Enabled SQL module in sites-available/default and inner-tunnel
- Disabled sqlippool (not compiled) to prevent startup errors
- Started FreeRADIUS v3.2.6 with PostgreSQL backend — listening on 1812/1813
- Verified RADIUS authentication works: radtest returns Access-Accept with group attributes
- Verified authentication rejection logging to radpostauth
- Fixed API routes for PostgreSQL: converted `?` parameter placeholders to `$1, $2, ...` in:
  - src/app/api/wifi/radius/route.ts (13 replacements across 6 case blocks)
  - src/app/api/wifi/session-history/route.ts (7 replacements in 3 sections)
- Regenerated Prisma client for PostgreSQL provider
- Restarted dev server — app now connects to PostgreSQL

Stage Summary:
- FreeRADIUS v3.2.6 running on ports 1812/1813 with PostgreSQL backend
- 10 FreeRADIUS tables + 10 StaySuite app tables + 5 views in staysuite database
- All WiFi GUI tabs should now show real data from PostgreSQL views
- RADIUS auth tested and confirmed working (Accept/Reject both logged to radpostauth)
- Test data: 10 users, 5 groups, 5 NAS, 11 accounting sessions, 15 auth logs
