-- ============================================================================
-- StaySuite-HospitalityOS — FreeRADIUS Native Tables Seed
-- ============================================================================
-- This seeds the 7 FreeRADIUS tables that the application reads from via views.
-- These tables are NOT managed by Prisma — they are FreeRADIUS's own tables.
--
-- Tables seeded:
--   1. radcheck        (10 rows)  — User authentication credentials
--   2. radgroupcheck   (6 rows)   — Group-level Simultaneous-Use limits
--   3. radgroupreply   (24 rows)  — Group-level bandwidth & timeout attributes
--   4. radusergroup    (10 rows)  — User-to-group mappings
--   5. nas             (5 rows)   — Network Access Server registry (MikroTik APs)
--   6. radpostauth     (19 rows)  — Authentication log samples
--   7. radacct         (3 rows)   — Active accounting sessions
--
-- Run AFTER: 01-freeradius-schema.sql
-- Idempotent: Uses ON CONFLICT DO NOTHING for safe re-runs.
-- ============================================================================

-- Client encoding and timezone
SET client_encoding = 'UTF8';
SET timezone = 'UTC';

BEGIN;

-- ============================================================
-- radcheck: User authentication credentials
-- 10 users with Cleartext-Password entries
-- ============================================================
INSERT INTO radcheck (id, username, attribute, op, value) VALUES
  (1, 'guest.amit.mukherjee', 'Cleartext-Password', ':=', 'Welcome@123'),
  (2, 'guest.sneha.gupta',    'Cleartext-Password', ':=', 'Secure@456'),
  (3, 'guest.rahul.banerjee', 'Cleartext-Password', ':=', 'Pass@789'),
  (4, 'guest.vikram.singh',   'Cleartext-Password', ':=', 'Hotel@321'),
  (5, 'staff.priya.das',      'Cleartext-Password', ':=', 'Staff@654'),
  (6, 'guest.anita.sharma',   'Cleartext-Password', ':=', 'Guest@111'),
  (7, 'guest.deepak.patel',   'Cleartext-Password', ':=', 'Guest@222'),
  (8, 'event.user001',        'Cleartext-Password', ':=', 'Event@2025'),
  (9, 'event.user002',        'Cleartext-Password', ':=', 'Event@2025'),
  (10,'test.admin',           'Cleartext-Password', ':=', 'Admin@999')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- radgroupcheck: Group-level Simultaneous-Use limits
-- 6 groups: wifi-free, wifi-basic, wifi-standard, wifi-premium, wifi-vip, wifi-staff
-- ============================================================
INSERT INTO radgroupcheck (id, groupname, attribute, op, value) VALUES
  (1, 'wifi-free',     'Simultaneous-Use', ':=', '1'),
  (2, 'wifi-basic',    'Simultaneous-Use', ':=', '2'),
  (3, 'wifi-standard', 'Simultaneous-Use', ':=', '3'),
  (4, 'wifi-premium',  'Simultaneous-Use', ':=', '5'),
  (5, 'wifi-vip',      'Simultaneous-Use', ':=', '10'),
  (6, 'wifi-staff',    'Simultaneous-Use', ':=', '3')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- radgroupreply: Group-level bandwidth & timeout attributes
-- 6 groups × 4 attributes each = 24 rows
-- Attributes per group: Mikrotik-Rate-Limit, Session-Timeout,
--   WISPr-Bandwidth-Max-Down, WISPr-Bandwidth-Max-Up
-- ============================================================
INSERT INTO radgroupreply (id, groupname, attribute, op, value) VALUES
  -- wifi-free: 2M/1M, 1hr session
  (1,  'wifi-free',     'Mikrotik-Rate-Limit',      ':=', '2M/1M'),
  (2,  'wifi-free',     'Session-Timeout',          ':=', '3600'),
  (3,  'wifi-free',     'WISPr-Bandwidth-Max-Down', ':=', '2000'),
  (4,  'wifi-free',     'WISPr-Bandwidth-Max-Up',   ':=', '1000'),
  -- wifi-basic: 5M/2M, 4hr session
  (5,  'wifi-basic',    'Mikrotik-Rate-Limit',      ':=', '5M/2M'),
  (6,  'wifi-basic',    'Session-Timeout',          ':=', '14400'),
  (7,  'wifi-basic',    'WISPr-Bandwidth-Max-Down', ':=', '5000'),
  (8,  'wifi-basic',    'WISPr-Bandwidth-Max-Up',   ':=', '2000'),
  -- wifi-standard: 10M/5M, 24hr session
  (9,  'wifi-standard', 'Mikrotik-Rate-Limit',      ':=', '10M/5M'),
  (10, 'wifi-standard', 'Session-Timeout',          ':=', '86400'),
  (11, 'wifi-standard', 'WISPr-Bandwidth-Max-Down', ':=', '10000'),
  (12, 'wifi-standard', 'WISPr-Bandwidth-Max-Up',   ':=', '5000'),
  -- wifi-premium: 25M/10M, 24hr session
  (13, 'wifi-premium',  'Mikrotik-Rate-Limit',      ':=', '25M/10M'),
  (14, 'wifi-premium',  'Session-Timeout',          ':=', '86400'),
  (15, 'wifi-premium',  'WISPr-Bandwidth-Max-Down', ':=', '25000'),
  (16, 'wifi-premium',  'WISPr-Bandwidth-Max-Up',   ':=', '10000'),
  -- wifi-vip: 50M/25M, 24hr session
  (17, 'wifi-vip',      'Mikrotik-Rate-Limit',      ':=', '50M/25M'),
  (18, 'wifi-vip',      'Session-Timeout',          ':=', '86400'),
  (19, 'wifi-vip',      'WISPr-Bandwidth-Max-Down', ':=', '50000'),
  (20, 'wifi-vip',      'WISPr-Bandwidth-Max-Up',   ':=', '25000'),
  -- wifi-staff: 100M/50M, 12hr session
  (21, 'wifi-staff',    'Mikrotik-Rate-Limit',      ':=', '100M/50M'),
  (22, 'wifi-staff',    'Session-Timeout',          ':=', '43200'),
  (23, 'wifi-staff',    'WISPr-Bandwidth-Max-Down', ':=', '100000'),
  (24, 'wifi-staff',    'WISPr-Bandwidth-Max-Up',   ':=', '50000')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- radusergroup: User-to-group mappings
-- 10 users mapped to their respective WiFi plan groups
-- ============================================================
INSERT INTO radusergroup (id, username, groupname, priority) VALUES
  (1,  'guest.amit.mukherjee', 'wifi-premium',  1),
  (2,  'guest.sneha.gupta',    'wifi-standard', 1),
  (3,  'guest.rahul.banerjee', 'wifi-free',     1),
  (4,  'guest.vikram.singh',   'wifi-vip',      1),
  (5,  'staff.priya.das',      'wifi-staff',    1),
  (6,  'guest.anita.sharma',   'wifi-basic',    1),
  (7,  'guest.deepak.patel',   'wifi-standard', 1),
  (8,  'event.user001',        'wifi-free',     1),
  (9,  'event.user002',        'wifi-free',     1),
  (10, 'test.admin',           'wifi-vip',      1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- nas: Network Access Server registry
-- 5 MikroTik access points across the hotel property
-- ============================================================
INSERT INTO nas (id, nasname, shortname, type, ports, secret, server, community, description) VALUES
  (1, '192.168.1.1', 'mikrotik-lobby',      'other', 3779, 'StaysuiteSecret2025', '', '', 'MikroTik hAP ac3 - Lobby AP'),
  (2, '192.168.1.2', 'mikrotik-pool',       'other', 3779, 'StaysuiteSecret2025', '', '', 'MikroTik hAP ac3 - Pool Area AP'),
  (3, '192.168.1.3', 'mikrotik-restaurant', 'other', 3779, 'StaysuiteSecret2025', '', '', 'MikroTik hAP ac3 - Restaurant AP'),
  (4, '192.168.1.4', 'mikrotik-floor1',     'other', 3779, 'StaysuiteSecret2025', '', '', 'MikroTik cAP ac - Floor 1'),
  (5, '192.168.1.5', 'mikrotik-floor2',     'other', 3779, 'StaysuiteSecret2025', '', '', 'MikroTik cAP ac - Floor 2')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- radpostauth: Authentication log samples
-- 19 rows including successful auths, rejected attempts, and re-logins
-- ============================================================
INSERT INTO radpostauth (id, username, pass, reply, calledstationid, callingstationid, authdate, class) VALUES
  (1,  'guest.amit.mukherjee', 'Welcome@123', 'Access-Accept', '00:11:22:33:44:55', 'AA:BB:CC:DD:EE:01', '2026-04-25 21:29:07+00', ''),
  (2,  'guest.sneha.gupta',    'Secure@456',   'Access-Accept', '00:11:22:33:44:55', 'AA:BB:CC:DD:EE:02', '2026-04-25 20:29:07+00', ''),
  (3,  'guest.rahul.banerjee', 'WrongPass',    'Access-Reject', '00:11:22:33:44:56', 'AA:BB:CC:DD:EE:03', '2026-04-25 19:29:07+00', ''),
  (4,  'guest.rahul.banerjee', 'Pass@789',     'Access-Accept', '00:11:22:33:44:56', 'AA:BB:CC:DD:EE:03', '2026-04-25 19:30:07+00', ''),
  (5,  'guest.vikram.singh',   'Hotel@321',    'Access-Accept', '00:11:22:33:44:57', 'AA:BB:CC:DD:EE:04', '2026-04-25 22:29:07+00', ''),
  (6,  'staff.priya.das',      'Staff@654',    'Access-Accept', '00:11:22:33:44:58', 'AA:BB:CC:DD:EE:05', '2026-04-25 18:29:07+00', ''),
  (7,  'guest.anita.sharma',   'Guest@111',    'Access-Accept', '00:11:22:33:44:59', 'AA:BB:CC:DD:EE:06', '2026-04-25 21:15:07+00', ''),
  (8,  'guest.deepak.patel',   'Guest@222',    'Access-Accept', '00:11:22:33:44:60', 'AA:BB:CC:DD:EE:07', '2026-04-25 22:44:07+00', ''),
  (9,  'event.user001',        'Event@2025',   'Access-Accept', '00:11:22:33:44:61', 'AA:BB:CC:DD:EE:08', '2026-04-25 20:00:07+00', ''),
  (10, 'event.user002',        'Event@2025',   'Access-Accept', '00:11:22:33:44:62', 'AA:BB:CC:DD:EE:09', '2026-04-25 20:05:07+00', ''),
  (11, 'test.admin',           'Admin@999',    'Access-Accept', '00:11:22:33:44:63', 'AA:BB:CC:DD:EE:10', '2026-04-25 17:00:07+00', ''),
  (12, 'guest.amit.mukherjee', 'Welcome@123', 'Access-Accept', '00:11:22:33:44:55', 'AA:BB:CC:DD:EE:01', '2026-04-25 18:00:07+00', ''),
  (13, 'guest.sneha.gupta',    'Secure@456',   'Access-Accept', '00:11:22:33:44:55', 'AA:BB:CC:DD:EE:02', '2026-04-25 16:00:07+00', ''),
  (14, 'guest.vikram.singh',   'Hotel@321',    'Access-Accept', '00:11:22:33:44:57', 'AA:BB:CC:DD:EE:04', '2026-04-25 15:00:07+00', ''),
  (15, 'guest.rahul.banerjee', 'WrongPass',    'Access-Reject', '00:11:22:33:44:56', 'AA:BB:CC:DD:EE:03', '2026-04-25 14:00:07+00', ''),
  (16, 'guest.rahul.banerjee', 'WrongPass2',   'Access-Reject', '00:11:22:33:44:56', 'AA:BB:CC:DD:EE:03', '2026-04-25 13:55:07+00', ''),
  (17, 'staff.priya.das',      'Staff@654',    'Access-Accept', '00:11:22:33:44:58', 'AA:BB:CC:DD:EE:05', '2026-04-25 10:00:07+00', ''),
  (18, 'guest.anita.sharma',   'Guest@111',    'Access-Accept', '00:11:22:33:44:59', 'AA:BB:CC:DD:EE:06', '2026-04-25 09:00:07+00', ''),
  (19, 'guest.deepak.patel',   'Guest@222',    'Access-Accept', '00:11:22:33:44:60', 'AA:BB:CC:DD:EE:07', '2026-04-25 21:00:07+00', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- radacct: Accounting session samples
-- 3 active sessions (no acctstoptime) for dashboard testing
-- Includes cumulative traffic counters (acctinputoctets, acctoutputoctets)
-- ============================================================
INSERT INTO radacct (radacctid, acctsessionid, acctuniqueid, username, realm,
    nasipaddress, nasportid, nasporttype,
    acctstarttime, acctupdatetime, acctstoptime, acctinterval,
    acctsessiontime, acctauthentic, connectinfo_start, connectinfo_stop,
    acctinputoctets, acctoutputoctets,
    calledstationid, callingstationid, acctterminatecause,
    servicetype, framedprotocol, framedipaddress, framedipv6address,
    framedipv6prefix, framedinterfaceid, delegatedipv6prefix, class
) VALUES
  (1, 'sess-amit-001',   'acct-amit-active-001',   'guest.amit.mukherjee', '',
   '192.168.1.1', NULL, 'Wireless-802.11',
   '2026-04-25 21:29:20+00', '2026-04-25 23:28:50+00', NULL, NULL,
   7200, 'RADIUS', '', '',
   52428800, 209715200,
   '00:11:22:33:44:55', 'AA:BB:CC:DD:EE:01', '',
   '', '', '10.0.1.101', '', '', '', '', ''),
  (2, 'sess-vikram-001', 'acct-vikram-active-001', 'guest.vikram.singh',   '',
   '192.168.1.2', NULL, 'Wireless-802.11',
   '2026-04-25 22:29:20+00', '2026-04-25 23:29:05+00', NULL, NULL,
   3600, 'RADIUS', '', '',
   10485760, 52428800,
   '00:11:22:33:44:57', 'AA:BB:CC:DD:EE:04', '',
   '', '', '10.0.2.55', '', '', '', '', ''),
  (3, 'sess-deepak-001', 'acct-deepak-active-001', 'guest.deepak.patel',   '',
   '192.168.1.3', NULL, 'Wireless-802.11',
   '2026-04-25 22:44:20+00', '2026-04-25 23:29:10+00', NULL, NULL,
   2700, 'RADIUS', '', '',
   3145728, 15728640,
   '00:11:22:33:44:56', 'AA:BB:CC:DD:EE:07', '',
   '', '', '10.0.3.22', '', '', '', '', '')
ON CONFLICT DO NOTHING;

COMMIT;
