# Accsium (24online) AAA Schema Analysis & StaySuite Mapping Guide

> **Source**: `accsium_rev05.gz` — PostgreSQL 18.0 pg_dump (73,005 lines, 400+ tables)
> **Owner**: `cryptsk` | **Schema**: `public`
> **Analysis Date**: 2025-07-19

---

## Executive Summary

Accsium is a **mature, enterprise-grade AAA (Authentication, Authorization, Accounting) + Billing platform** originally designed for ISP and hotel WiFi hotspot management. The schema reveals a deeply layered architecture with:

- **~400 tables** (including monthly partitioned variants for access logs, surfing details, and accounting)
- **Zero foreign key constraints** — all referential integrity enforced at application layer
- **Heavy use of monthly table partitioning** via PostgreSQL `INHERITS` (access logs, CoA sessions, history logs, surfing details, user acct details, auth messages)
- **A comprehensive policy engine** with 6+ policy types (time, bandwidth, data transfer, access, security, URL filter, RADIUS attributes)
- **Multi-tenant zone architecture** (POP → Zone → Pool → User hierarchy)
- **Rich hospitality PMS integration** (hotel rooms, guest billing, folio posting, PMS sync)

---

## 1. Core Entity Relationship Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ACCSIUM ENTITY HIERARCHY                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  tblpop (Point of Presence)                                            │
│    │                                                                    │
│    ├── tblzone (Zone / Location)                                       │
│    │     │                                                              │
│    │     ├── tblippool (IP Pool)                                        │
│    │     │     ├── bwpolicyid → tblbandwidthpolicy                     │
│    │     │     ├── selfregpolicy → tblselfregpolicy                    │
│    │     │     └── filterid → tblurlfiltering                         │
│    │     │                                                              │
│    │     ├── tblnetwork (Network/Subnet)                               │
│    │     │     └── poolid → tblippool                                  │
│    │     │                                                              │
│    │     └── tblroomdetails (Hotel Rooms)                              │
│    │           ├── roomtypeid → tblroomtype                            │
│    │           ├── vlanid → VLAN assignment                            │
│    │           └── roomlimit + roomlimitrel                            │
│    │                                                                    │
│    ├── tblnasclientconfig (NAS Clients / RADIUS Clients)              │
│    │     └── shared secret, NAS identifier                             │
│    │                                                                    │
│    ├── tblnaszonerel (NAS → Zone)                                      │
│    └── tblnaswisepoolzonerel (NAS → Pool → Zone)                      │
│                                                                         │
│  tblgateway (Internet Gateway)                                         │
│    ├── tblgatewaynetworkrel (GW → Network routes)                      │
│    ├── tblgatewaypriorityrel (GW → Priority)                           │
│    └── tblgatewayservice (GW Services with proportion)                 │
│                                                                         │
│  tblgroup (Plan / Package)                                             │
│    ├── policyid → tblpolicy (time/session policy)                      │
│    ├── bwpolicyid → tblbandwidthpolicy                                 │
│    ├── datatransferpolicyid → tbldatatransferpolicy                    │
│    ├── securitypolicyid → tblsecuritypolicy                            │
│    ├── accesspolicyid → tblaccesspolicy                                │
│    ├── urlfilterpolicyid → tblurlfiltering                             │
│    ├── poolid → tblippool                                              │
│    ├── radiuspolicyid → tblradiuspolicy (RADIUS attribute descriptors)│
│    ├── loginlimit + loginlimitrel (concurrent session control)         │
│    ├── gracedays + gracedaysrel (grace period settings)                │
│    └── price, cycletype, cyclemultiplier (billing)                     │
│                                                                         │
│  tbluser (User)                                                        │
│    ├── groupid → tblgroup                                              │
│    ├── zoneid → tblzone                                                │
│    ├── accountid → tbluseraccount                                      │
│    ├── bwpolicyid → tblbandwidthpolicy (per-user override)             │
│    ├── datatransferpolicyid → tbldatatransferpolicy (per-user override)│
│    ├── securitypolicyid → tblsecuritypolicy                            │
│    ├── accesspolicyid → tblaccesspolicy                                │
│    ├── urlfilterpolicyid → tblurlfiltering                             │
│    ├── hotelid → tblhotelid                                            │
│    ├── loginlimit + loginlimitrel (concurrent sessions)                │
│    ├── priorityid + priorityrel                                        │
│    ├── allotteduploaddatatransfer / allotteddownloaddatatransfer       │
│    ├── bindtomac + macaddress                                          │
│    ├── tbluseriprel → Static IP mapping                                │
│    ├── tbluserpoolrel → Dynamic IP pool                                │
│    ├── tblusernetworkrel → Network assignment                          │
│    ├── tbluserpolicyrel → Policy overrides                             │
│    ├── tbluserdetails → Address/contact info                           │
│    ├── tbluserstatus → Current status                                  │
│    ├── tbluserstatushistory → Status audit trail                       │
│    ├── tblroomuser → Hotel room flag                                   │
│    └── tbluserrelationtype → Owner/sub-user type                       │
│                                                                         │
│  tblliveuser (Active Session — PK: acctsessionid)                     │
│    ├── userid → tbluser                                                │
│    ├── username (UNIQUE — one live session per user)                   │
│    ├── bandwidthpolicyid, securitypolicyid, accesspolicyid             │
│    ├── networksecuritypolicyid                                          │
│    ├── maxinputoctets, maxoutputoctets, maxtotaloctets                 │
│    ├── sessiontimeout, idletimeout                                     │
│    ├── roomno, hotelid (hospitality context)                           │
│    ├── urlfilterpolicy                                                 │
│    ├── bandwidth (varchar(100) — human-readable BW string)             │
│    └── qos (varchar(1000) — QoS attribute string)                     │
│                                                                         │
│  tblliveuserdetail (Session Detail)                                    │
│    ├── acctsessionid → tblliveuser (CASCADE delete)                    │
│    ├── framedip (UNIQUE with nasipaddress)                             │
│    ├── macaddress, nasipaddress, nasidentifier                         │
│    ├── curinternetupdatatransfer / curinternetdowndatatransfer        │
│    ├── devicetype, operatingsystem, manufacturer                       │
│    └── accumulatedownload / accumulateupload                            │
│                                                                         │
│  tblliveuseraccounting (Real-time App Accounting)                     │
│    ├── acctsessionid → tblliveuserdetail (CASCADE delete)              │
│    ├── appid → per-app counters                                        │
│    ├── curinternetupdatatransfer / curinternetdowndatatransfer        │
│    └── decreasedbw + switchoverbwapplicable (FAP support)              │
│                                                                         │
│  tblsessionuseraccounting (Per-Session Accounting Snapshot)           │
│    ├── PK: (userid, nasacctsessionid)                                  │
│    ├── total/curr session time, upload, download                       │
│    ├── total/curr effective (billable) counters                        │
│    └── CoA change tracking (oldchangeid, newchangeid, coareqtype)      │
│                                                                         │
│  tblcoawiseusersession (CoA Audit — monthly partitioned)              │
│    ├── coatype, policyname, bwpercent                                  │
│    ├── actual/effective session time and data counters                 │
│    └── coachangetime (partitioned by YYYYMM)                           │
│                                                                         │
│  tblcustomeraccounting (Hotel Guest Billing)                           │
│    ├── checkintime / checkouttime                                      │
│    ├── netamt, taxamt, totalamt (3 tiers!)                             │
│    ├── roomno, pmsid, discount                                         │
│    └── specialcodeid, popid                                            │
│                                                                         │
│  tblguestbillinfo (Guest Bill Line Items)                              │
│    ├── folionumber, roomno, guestreservno                              │
│    ├── billdescription, billitemamount, deptcode                       │
│    └── billdatetime                                                    │
│                                                                         │
│  tblhotelid (PMS Integration Config)                                   │
│    ├── hotelname, hotelidentification                                  │
│    ├── serverip, port, protocolname (e.g., "Fidelio")                  │
│    ├── commtype, serialid, password, cryptkey                          │
│    └── pmsstatus, sendhitopms, dbsyncrunning                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Policy Engine Architecture

Accsium has a **6-layer policy system** where each layer can be set at both Group (plan) and User level, with user-level overriding group-level:

```
┌──────────────────────────────────────────────────────────────┐
│                    POLICY LAYER STACK                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: tblpolicy (Time/Session Policy)                   │
│    ├── allotedminutes, expiredays                            │
│    ├── isperiodic, periodallowedminutes, cycle               │
│    ├── sessionpulse, policytype, allottedunit               │
│    └── tblpolicyrate → Tiered pricing (used minutes → rate) │
│                                                              │
│  Layer 2: tblbandwidthpolicy (Bandwidth Policy)             │
│    ├── restrictiontype, multiplier, contentionratio         │
│    ├── scheduletype → scheduled BW changes                  │
│    └── tblbandwidthpolicydetail:                            │
│          ├── bandwidth, uploadlimit, downloadlimit          │
│          ├── guarntdbandwidth, guarntdupload/downloadlimit │
│          ├── bursttime, burstthreshold (up+down)            │
│          ├── scheduleid → tblschedule (time-based BW)       │
│          └── datatransferid → linked data cap               │
│                                                              │
│  Layer 3: tbldatatransferpolicy (Data Transfer Policy)      │
│    ├── uploaddata, downloaddata, totaldata                  │
│    ├── scheme (billing), restriction                        │
│    ├── datatransfercycletype, cycle caps                    │
│    └── tbldatatransferrate → Tiered data pricing           │
│                                                              │
│  Layer 4: tblaccesspolicy (Access Policy — Time-based)     │
│    ├── isallow (allow/deny default)                         │
│    └── tblaccesspolicydetail:                               │
│          ├── weekday, allowstarttime, allowstoptime         │
│          ├── discount %, accesstype                         │
│          └── PER-DAY scheduling with discount support       │
│                                                              │
│  Layer 5: tblsecuritypolicy (Security/Firewall Policy)     │
│    ├── isopen, isdefault                                    │
│    ├── tblsecuritypolicydetail: service, site, port, sched │
│    └── tblsecpolicywebcategoryrel: webcat allow/block      │
│                                                              │
│  Layer 6: tblurlfiltering (URL/Content Filter Policy)      │
│    ├── blockcategory, customcategory                        │
│    └── tblwebcategory → master web category list            │
│                                                              │
│  Layer 7: tblradiuspolicy (RADIUS Attribute Descriptors)   │
│    └── descriptors (varchar 4000 — raw RADIUS attributes)  │
│                                                              │
│  Scheduling: tblschedule + tblscheduledetail                │
│    ├── schedulename, description                            │
│    └── Weekday + starttime + stoptime                       │
│                                                              │
│  Assignment: Policies assigned via:                          │
│    ├── tblgroup.policyid/bwpolicyid/etc. (plan-level)      │
│    ├── tbluser.policyid/bwpolicyid/etc. (user-level)       │
│    ├── tbluserpolicyrel (additional policy overrides)       │
│    ├── tblgrouppolicyrel (group-level policy type mapping)  │
│    └── tblgroupzonewisepolicy (zone-specific policy)       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Concurrent Session Control

```sql
-- In tbluser:
loginlimit      integer DEFAULT '-1'    -- Max concurrent sessions (-1 = unlimited)
loginlimitrel   character(1) DEFAULT 'G' -- Scope: 'G'=Group default, 'S'=Self override

-- In tblgroup:
loginlimit      integer DEFAULT '-1'    -- Plan-level max concurrent sessions
```

**How it works:**
- `loginlimit = -1` means unlimited concurrent sessions
- `loginlimitrel = 'G'` means user inherits the group/plan's login limit
- `loginlimitrel = 'S'` means user has their own specific limit
- Enforced by the RADIUS server: on new auth request, count active `tblliveuser` entries for the username; if count >= loginlimit, reject

---

## 4. Scheduled Bandwidth (Time-Based BW Changes)

```sql
-- tblbandwidthpolicy.scheduletype → determines if schedule applies
-- tblbandwidthpolicydetail.scheduleid → links to specific schedule
-- tblschedule + tblscheduledetail → actual time slots

-- Example: A policy with scheduletype != -11 and scheduleid set
-- will apply different bandwidth at different times of day/week
-- tblbandwidthpolicydetail also has:
--   guarntdbandwidth / guarntduploadlimit / guarntddownloadlimit
--   bursttime / burstthreshold (for burst profiles)
```

**CoA-based enforcement** (from `tblcoawiseusersession`):
- When schedule triggers a BW change, Accsium sends a **CoA (Change of Authorization)** to the NAS
- `coatype` records the type of change
- `bwpercent` records the percentage of bandwidth applied
- `tblcoahistory` tracks old/new IDs and success/failure status

---

## 5. FAP (Fair Access Policy) — Data Cap with BW Throttle

```sql
-- tblfapdetails:
fapid, fapname,
cycletype,           -- 1=daily, 2=weekly, 3=monthly
limittype,           -- 1=MB, 2=GB, 3=TB
datatransferlimit,   -- the cap value
switchoverbwpolicyid,-- BW policy to apply when cap exceeded
hours/minutes/seconds,-- cycle reset time (e.g., 23:59:59 for daily)
multiplier,          -- cycle multiplier
applicableon,        -- 1=upload, 2=download, 3=total
datatransfertype     -- same
```

**How it works:**
1. User hits data cap → `tblliveuseraccounting.decreasedbw` set to 1
2. `switchoverbwpolicyid` bandwidth policy is applied via CoA
3. `switchoverbwapplicable` flag controls if this feature is active
4. User can purchase topups via `tblfapbandwidthtopup`

---

## 6. Content Filtering Architecture

```
tblurlfiltering (Filter Policy)
├── policyname, blockcategory, customcategory
│
├── tblwebcategory (Master Web Category List)
│   ├── webcategoryname, webcategorydesc
│   ├── isuploadrestriction, categorytype
│   ├── implementationon, attributeid
│   └── tblwebcategoryfiletyperel, tblwebcategorykeyworddetail
│
├── tblsecpolicywebcategoryrel (Policy ↔ Category)
│   ├── securitypolicyid, webcategoryid
│   ├── scheduleid (time-based allow/block)
│   ├── orderindex, isallow
│
└── tblcustomcategory (User-defined categories)
    ├── categoryname, description
    └── Referenced by tblurlfiltering.customcategory
```

**Key difference from StaySuite:** Accsium uses **category-based blocking** (block all sites in category "Social Media") while StaySuite currently uses **domain-based blocking** (block specific domains). Accsium's approach is far more scalable.

---

## 7. Hotel/PMS Integration Architecture

```
tblhotelid (Master Hotel Config)
├── hotelname, hotelidentification
├── PMS Connection: serverip, port, protocolname, commtype
├── Auth: serialid, password, cryptkey
├── Sync: pmsstatus, sendhitopms, dbsyncrunning
│
├── tblhoteladminconfig → Admin ↔ Hotel mapping
├── tblhotelloggedinuser → Currently logged-in hotel users
├── tblhotelsalesoutlet → Sales outlets per hotel
└── tblhoteluserattributeconfig → Hotel-specific user attributes

tblroomdetails (Room Inventory)
├── roomno (PK), roomtypeid, vlanid
├── popid, roomlimit, roomlimitrel
│
├── tblroomuser → Room ↔ User flag
├── tblroomactivationstatus → Occupancy tracking
├── tblpinstoroom → PIN → Room mapping
└── tblroomwisepindetails → Per-room PIN assignments

tblcustomeraccounting (Guest Billing)
├── checkintime / checkouttime
├── netamt, taxamt, totalamt (3 tiers for multi-service billing)
├── roomno, pmsid, discount, specialcodeid
│
├── tblguestbillinfo → Line items (folio, dept code, description)
└── tblguestbilltotal → Total per guest (for PMS posting)

tblchangeroomdetail → Room change tracking
tblguestmsg → Guest messaging
tblguestbillinfo → Folio line items for PMS posting
```

---

## 8. Accsium vs StaySuite Schema Mapping

### 8.1 User Management

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tbluser` (50+ columns) | `WiFiUser` (simpler) | StaySuite needs: `loginlimit`, `loginlimitrel`, `priorityid`, `creditlimit`, `bindtomac`, `hotelid` |
| `tbluseraccount` | Part of `Guest` model | Accsium separates account (custname, custtype) from user — cleaner for multi-user accounts |
| `tbluserstatus` | `WiFiUser.status` | Accsium adds `logincounter` and `statuschangeddt` |
| `tbluserstatushistory` | Missing | **GAP**: StaySuite has no user status change audit trail |
| `tbluserdetails` | `Guest` addresses | Similar structure |
| `tbluseriprel` | Missing | **GAP**: No static IP assignment per user |
| `tbluserpoolrel` | `WiFiUser.wifiPoolId` | ✅ Covered |
| `tbluserrelationtype` | Missing | **GAP**: No owner/sub-user hierarchy |
| `tbluserbatchrel` | Missing | **GAP**: No bulk creation batch tracking |

### 8.2 Plan/Group Management

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblgroup` (35+ columns) | `WiFiPlan` | Accsium has `loginlimit`, `gracedays`, `gracedaysrel`, `expireby`, `expiretime`, `quotaamountbasedon`, `bindtomac`, `radiuspolicyid` |
| `tblgrouppolicyrel` | Missing | **GAP**: No separate policy-type mapping table |
| `tblgroupzonewisepolicy` | Missing | **GAP**: No zone-specific plan overrides |

### 8.3 Bandwidth Policy

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblbandwidthpolicy` | Part of `WiFiPlan` | Accsium separates BW policy as reusable entity |
| `tblbandwidthpolicydetail` | Missing | **GAP**: No guaranteed BW, burst settings, or per-detail schedule linking |
| `tblbandwidthpolicy.scheduletype` | `ScheduleAccess` | StaySuite's `ScheduleAccess` is closer to Accsium's `tblschedule` |
| `tblfapdetails` | Missing | **GAP**: No Fair Access Policy (data cap → BW throttle) |

### 8.4 Session/Accounting

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblliveuser` | Sessions parsed from radacct | Accsium maintains a dedicated live sessions table — faster queries |
| `tblliveuserdetail` | Part of session data | Accsium tracks `devicetype`, `operatingsystem`, `manufacturer`, `realmname` |
| `tblliveuseraccounting` | Missing | **GAP**: No per-app real-time accounting |
| `tblsessionuseraccounting` | Missing | **GAP**: No total/current/CoA change tracking per session |
| `tblcoawiseusersession` | Missing | **GAP**: No CoA audit trail |
| `tblcoahistory` | Missing | **GAP**: No CoA request/response audit |
| `tbluseraccounting` | `WiFiUser` used/download counters | Accsium tracks `balance`, `firstlogintime`, `lastlogouttime` |
| `tblacctsessionid` | Missing | **GAP**: No internal → external session ID mapping |

### 8.5 Content Filtering

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblurlfiltering` | `ContentFilter` | Accsium uses category IDs; StaySuite uses domain strings |
| `tblwebcategory` | Missing | **GAP**: No category master list |
| `tblsecpolicywebcategoryrel` | Missing | **GAP**: No time-based category allow/block |
| `tblcustomcategory` | Missing | **GAP**: No custom category support |

### 8.6 Network/NAS

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblnasclientconfig` | `NasClient` (SQLite) | Similar — shared secret, NAS identifier |
| `tblnasconfig` | Missing | **GAP**: No NAS-level rejection messages |
| `tblnasconnectivity` | Missing | **GAP**: No NAS health monitoring (last interaction, live user count) |
| `tblnaszonerel` | `NasClient.zoneId` | Similar |
| `tblgateway` + rels | Missing | **GAP**: No multi-gateway with load balancing/failover |
| `tblroomdetails` | `Room` | Similar |
| `tblhotelid` | Missing | **GAP**: No PMS server connection config |

### 8.7 Scheduling

| Accsium | StaySuite | Gap Analysis |
|---------|-----------|-------------|
| `tblschedule` + `tblscheduledetail` | `ScheduleAccess` | Accsium: `weekday` (int) + `starttime`/`stoptime` (varchar). StaySuite: `daysOfWeek` (string) + `startTime`/`endTime` (HH:MM) — conceptually identical |
| `tblaccesspolicydetail` | Missing | **GAP**: No time-based access control with discount % |

---

## 9. Key Architecture Patterns Worth Adopting

### Pattern 1: Separated Policy Engine
Accsium separates each policy type into its own table, making them **reusable entities** that can be shared across plans and overridden per-user. StaySuite should consider:
- `BandwidthPolicy` as standalone entity (not embedded in WiFiPlan)
- `DataTransferPolicy` as standalone entity
- `RadiusPolicy` for raw RADIUS attribute descriptors

### Pattern 2: Live Session Table
Instead of parsing `radacct` detail files (slow, file I/O), Accsium maintains:
- `tblliveuser` — PK is `acctsessionid`, UNIQUE on `username`
- `tblliveuserdetail` — UNIQUE on `(framedip, nasipaddress)`
- `tblliveuseraccounting` — FK to `tblliveuserdetail` with CASCADE delete

This gives **O(1) session lookup** by username or IP. StaySuite should create equivalent tables in SQLite.

### Pattern 3: Monthly Table Partitioning
For high-volume data (access logs, surfing details, CoA sessions), Accsium creates monthly child tables:
- `tblaccesslog20260227` INHERITS `tblaccesslog`
- `tblcoawiseusersession202408` INHERITS `tblcoawiseusersession`
- Automatic partition creation via triggers

For StaySuite (SQLite), use **date-sharded tables** or **SQLite ATTACH** for similar effect.

### Pattern 4: CoA Audit Trail
Every CoA request is logged with:
- `tblcoahistory` — request ID, action type, old/new IDs, status
- `tblcoawiseusersession` — per-session CoA details with before/after counters

StaySuite's CoA implementation should add equivalent audit logging.

### Pattern 5: Multi-Tier Guest Billing
`tblcustomeraccounting` has 3 tiers of pricing:
- `netamt/taxamt` + `netamt2/taxamt2` + `netamt3/taxamt3`
- `discount/discount2/discount3`
- `pmsid` for PMS folio posting

This supports multi-service billing (internet + phone + laundry) in a single record.

### Pattern 6: Zero Foreign Keys
Accsium has **zero FK constraints** — all relationships are implicit via naming conventions and enforced at the application layer. This avoids:
- Lock contention on high-volume inserts
- Cascading delete issues during bulk operations
- Migration complexity

For StaySuite (Prisma), we keep FKs but should consider making them **optional/on-delete-set-null** for operational tables.

---

## 10. Critical Tables to Implement in StaySuite

### HIGH PRIORITY (直接影响功能完整性)

| # | Table | Reason | StaySuite Equivalent |
|---|-------|--------|---------------------|
| 1 | `tblliveuser` | O(1) session lookup by username | Create in SQLite via freeradius-service |
| 2 | `tblliveuserdetail` | Session details with device detection | Create in SQLite |
| 3 | `tblcoahistory` | CoA audit trail | Add to freeradius-service |
| 4 | `tbluserstatushistory` | User status change audit | Add Prisma model |
| 5 | `tblbandwidthpolicy` + detail | Reusable BW policies with guaranteed/burst | Enhance WiFiPlan or create standalone |
| 6 | `tblfapdetails` | Data cap → BW throttle | New Prisma model + enforcer |
| 7 | `tblwebcategory` | Category-based content filtering | Enhance ContentFilter model |

### MEDIUM PRIORITY (提升运营效率)

| # | Table | Reason |
|---|-------|--------|
| 8 | `tblnasconnectivity` | NAS health monitoring |
| 9 | `tbluseraccounting` | Per-user balance and session tracking |
| 10 | `tblsessionuseraccounting` | CoA-aware session counters |
| 11 | `tblaccesspolicy` + detail | Time-based access control |
| 12 | `tblgateway` + rels | Multi-gateway load balancing |
| 13 | `tblroomactivationstatus` | Room occupancy ↔ WiFi sync |

### LOW PRIORITY (锦上添花)

| # | Table | Reason |
|---|-------|--------|
| 14 | `tbluserbatchrel` | Bulk user creation tracking |
| 15 | `tbluserrelationtype` | Owner/sub-user hierarchy |
| 16 | `tblguestbillinfo` | PMS folio line items |
| 17 | `tblcrosszoneacct` | Roaming accounting |
| 18 | `tblappwiseuseraccounting` | Per-app data tracking |

---

## 11. Data Type Patterns

| Accsium Pattern | Description | StaySuite Equivalent |
|-----------------|-------------|---------------------|
| `character(1) DEFAULT 'Y'/'N'` | Boolean flags | `Boolean @default(true)` |
| `integer DEFAULT '-11'` | "Not set" sentinel | `Int? @default(null)` |
| `character varying(50)` | Standard string | `String @db.VarChar(50)` |
| `numeric(9,2)` | Money amounts | `Decimal @db.Decimal(9,2)` |
| `double precision` | Bandwidth/data in bytes | `Float` or `BigInt` |
| `bigint` | Data transfer counters | `BigInt @db.BigInteger` |
| `timestamp without time zone` | +5:30 hardcoded in `from_unixtime()` | `DateTime @db.DateTime` |
| `integer` for weekday | 1=Sunday, 2=Monday... | `Int` (0=Mon, 6=Sun in StaySuite) |

**⚠️ Important**: Accsium uses `from_unixtime()` with hardcoded `+05:30` IST offset — all timestamps are stored as UTC but displayed in IST. StaySuite uses proper timezone-aware `DateTime`.

---

## 12. Table Naming Convention

| Accsium | Convention | StaySuite |
|---------|-----------|-----------|
| `tbluser` | `tbl` + singular noun | PascalCase singular |
| `tbluserstatus` | `tbl` + compound noun | PascalCase compound |
| `tbluseriprel` | `tbl` + entity + relationship | PascalCase + `Rel` suffix or junction |
| `tbl202307` suffix | Monthly partition | Not used (future: date-sharded) |
| `_seq` suffix | Sequence name | Auto-increment via Prisma |

---

*End of Analysis — Generated by StaySuite Architecture Team*
