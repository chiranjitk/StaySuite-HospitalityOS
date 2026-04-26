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

---
Task ID: 3
Agent: Main Agent
Task: Fix login — regenerate Prisma client for PostgreSQL, fix PM2 DATABASE_URL, verify all accounts can log in

Work Log:
- Diagnosed login failure: Prisma Client was generated for SQLite but schema.prisma had PostgreSQL provider
- Root cause: PM2 had old `DATABASE_URL=file:/home/z/my-project/db/custom.db` (SQLite) baked into environment
- Regenerated Prisma client: `npx prisma generate` with correct DATABASE_URL
- Created wrapper script `/tmp/start-dev.sh` that exports `DATABASE_URL=postgresql://z@localhost:5432/staysuite`
- Started Next.js via PM2 using wrapper script to ensure correct env
- Verified password hashes in DB are correct bcrypt hashes (admin123, staff123)
- Tested all 3 login accounts successfully:
  - admin@royalstay.in / admin123 → SUCCESS (Rajesh Sharma, admin role)
  - frontdesk@royalstay.in / staff123 → SUCCESS (Priya Das, front_desk role)
  - platform@staysuite.com / admin123 → SUCCESS (Platform Admin, isPlatformAdmin=true)
- PM2 process stable: 0 restarts, running on port 3000

Stage Summary:
- Login fully working on PostgreSQL
- PM2 managing staysuite-nextjs with correct DATABASE_URL via wrapper script
- All seed user accounts verified working
- Server stable under PM2 (0 crashes)

---
Task ID: 3-b
Agent: Fix Agent
Task: Fix session-history route for PostgreSQL timestamptz casting

Work Log:
- Fixed `buildSqlConditions` function (lines 164-167): added `::timestamptz` cast to date comparison parameters
- `acctstarttime >= $N` → `acctstarttime >= $N::timestamptz`
- `acctstarttime <= $N` → `acctstarttime <= $N::timestamptz`
- This resolves `operator does not exist: timestamp with time zone >= text` error

Stage Summary:
- session-history route now correctly casts text date parameters to timestamptz for PostgreSQL comparisons

---
Task ID: 3-c
Agent: Fix Agent
Task: Fix radius route for PostgreSQL column quoting, COALESCE, and timestamptz casting

Work Log:
- Quoted all mixed-case column names in `users` query (v_wifi_users view):
  - WHERE: `"propertyId"` (was unquoted, caused `column "tenantid" does not exist`)
  - SELECT: `"tenantId"`, `"propertyId"`, `"guestId"`, `"bookingId"`, `"planId"`, `"authMethod"`, `"macAddress"`, `"validFrom"`, `"validUntil"`, `"totalBytesIn"`, `"totalBytesOut"`, `"sessionCount"`, `"lastSeenAt"`, `"createdAt"`, `"updatedAt"`
  - ORDER BY: `"createdAt"`
- Quoted mixed-case columns in `live-sessions-list` query (v_active_sessions view):
  - SELECT: `"downloadSpeed"`, `"uploadSpeed"`
- Added COALESCE for nullable bigint columns in `live-sessions-stats` query:
  - `COALESCE(acctoutputoctets, 0) as acctoutputoctets`
  - `COALESCE(acctinputoctets, 0) as acctinputoctets`
- Fixed TypeScript BigInt arithmetic in `live-sessions-stats` aggregation loop:
  - `r.acctoutputoctets || 0` → `Number(r.acctoutputoctets)` (safe for bigint/number/null)
  - `r.acctinputoctets || 0` → `Number(r.acctinputoctets)`
- Added `::timestamptz` casts to all acctstarttime date comparisons across 4 case blocks:
  - auth-logs (lines 295-296)
  - auth-logs-stats (lines 371-372, 393-394, 398-399)
  - user-usage-detail (lines 999-1000)

Stage Summary:
- radius route now works with PostgreSQL: column names properly quoted for mixed-case identifiers, null bigints handled with COALESCE, and all timestamp comparisons use explicit timestamptz casting

---
Task ID: 4
Agent: Main Agent
Task: Run radtest, verify FreeRADIUS auto-population, fix all broken WiFi GUI API routes

Work Log:
- Ran radtest: `radtest -x "guest.amit.mukherjee" "Welcome@123" localhost 1812 testing123` → Access-Accept with bandwidth attributes
- Confirmed radacct auto-populated with new session row from radtest
- Confirmed radpostauth logging both Accept and Reject events (19 total entries)
- Audited ALL 24 WiFi API routes — found 3 failing routes:
  1. /api/wifi/users — SQLite `?` placeholders + UUID cast issue
  2. /api/wifi/session-history — timestamptz cast missing for date comparisons
  3. /api/wifi/radius — PostgreSQL column quoting (case sensitivity), GROUP BY violation, COALESCE for bigint, timestamptz casts
- Fixed all 3 routes for PostgreSQL compatibility
- Final audit: ALL 15 WiFi tabs return ✅ with real data

Stage Summary:
- radtest confirmed working: RADIUS auth → radpostauth + radacct auto-populate
- All 15 WiFi GUI API routes verified working:
  WiFi Users (8), Session History (20), Auth Logs (30), Live Sessions (18),
  Plans (6), Vouchers (10), NAS (2), Portal (2), DHCP Subnets (4), Bandwidth (7),
  Health dashboard, Live session stats (12 active), Content Filter (0)
- Key PostgreSQL fixes: `?` → `$N` params, `::uuid` casts, `::timestamptz` casts,
  column quoting for case sensitivity, COALESCE for nullable bigints, GROUP BY strict mode
