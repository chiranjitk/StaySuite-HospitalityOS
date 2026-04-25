import { Database } from 'bun:sqlite';

const sqlite = new Database('./db/custom.db');

console.log('Creating SQLite views with datetime formatting...');

sqlite.exec('DROP VIEW IF EXISTS v_session_history');
sqlite.exec('DROP VIEW IF EXISTS v_active_sessions');
sqlite.exec('DROP VIEW IF EXISTS v_user_usage');
sqlite.exec('DROP VIEW IF EXISTS v_wifi_users');

// In SQLite, DateTime values are stored as Unix epoch milliseconds (integers).
// We need to format them as ISO strings for the API queries that compare with date strings.

sqlite.exec(`
CREATE VIEW v_session_history AS
SELECT
  s.id as session_id,
  s.id as radacctid,
  s.id as acctsessionid,
  s.tenantId,
  s.planId,
  s.guestId,
  s.bookingId,
  s.macAddress as callingstationid,
  s.macAddress as wifi_mac,
  s.ipAddress,
  s.ipAddress as framedipaddress,
  s.deviceName,
  s.deviceType,
  datetime(s.startTime / 1000, 'unixepoch') as acctstarttime,
  datetime(s.startTime / 1000, 'unixepoch') as acctupdatetime,
  CASE WHEN s.endTime IS NOT NULL THEN datetime(s.endTime / 1000, 'unixepoch') ELSE NULL END as acctstoptime,
  s.dataUsed as total_data_used,
  s.duration as acctsessiontime,
  s.dataUsed as acctinputoctets,
  0 as acctoutputoctets,
  s.authMethod,
  s.status as session_status,
  s.status as wifi_user_status,
  s.status,
  CASE WHEN s.status = 'active' THEN 'User-Request' ELSE 'NAS-Request' END as acctterminatecause,
  datetime(s.createdAt / 1000, 'unixepoch') as createdAt,
  datetime(s.updatedAt / 1000, 'unixepoch') as updatedAt,
  COALESCE(u.username, '') as username,
  COALESCE(g.firstName, '') as guest_first_name,
  COALESCE(g.lastName, '') as guest_last_name,
  COALESCE(g.email, '') as guest_email,
  COALESCE(g.phone, '') as guest_phone,
  COALESCE(g.loyaltyTier, '') as guest_loyalty_tier,
  CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
  COALESCE(r.number, '') as room_number,
  COALESCE(r.name, '') as room_name,
  COALESCE(r.floor, 0) as room_floor,
  COALESCE(p.name, '') as property_name,
  COALESCE(wp.name, '') as plan_name,
  wp.downloadSpeed as downloadSpeed,
  wp.downloadSpeed as plan_download_speed,
  wp.uploadSpeed as uploadSpeed,
  wp.uploadSpeed as plan_upload_speed,
  wp.dataLimit as dataLimit,
  wp.dataLimit as plan_data_limit,
  COALESCE(b.confirmationCode, '') as booking_code,
  COALESCE(b.status, '') as booking_status,
  s.id as acctuniqueid,
  NULL as framedipv6address,
  '0.0.0.0' as nasipaddress,
  '' as nasidentifier,
  NULL as nasportid,
  'Wireless-802.11' as nasporttype,
  '' as calledstationid,
  NULL as connectinfo_start,
  NULL as connectinfo_stop
FROM WiFiSession s
LEFT JOIN WiFiUser u ON s.guestId = u.guestId
LEFT JOIN Guest g ON s.guestId = g.id
LEFT JOIN Booking b ON s.bookingId = b.id
LEFT JOIN Room r ON b.roomId = r.id
LEFT JOIN Property p ON b.propertyId = p.id
LEFT JOIN WiFiPlan wp ON s.planId = wp.id
`);
console.log('✓ v_session_history view created');

sqlite.exec(`
CREATE VIEW v_active_sessions AS
SELECT
  s.id as session_id,
  s.id as radacctid,
  s.id as acctsessionid,
  s.tenantId,
  s.planId,
  s.guestId,
  s.bookingId,
  s.macAddress as callingstationid,
  s.macAddress as wifi_mac,
  s.ipAddress,
  s.ipAddress as framedipaddress,
  s.deviceName,
  s.deviceType,
  datetime(s.startTime / 1000, 'unixepoch') as acctstarttime,
  datetime(s.startTime / 1000, 'unixepoch') as acctupdatetime,
  CASE WHEN s.endTime IS NOT NULL THEN datetime(s.endTime / 1000, 'unixepoch') ELSE NULL END as acctstoptime,
  s.dataUsed as total_data_used,
  s.duration as acctsessiontime,
  s.dataUsed as acctinputoctets,
  0 as acctoutputoctets,
  s.authMethod,
  s.status as session_status,
  s.status as wifi_user_status,
  s.status,
  CASE WHEN s.status = 'active' THEN 'User-Request' ELSE 'NAS-Request' END as acctterminatecause,
  datetime(s.createdAt / 1000, 'unixepoch') as createdAt,
  datetime(s.updatedAt / 1000, 'unixepoch') as updatedAt,
  COALESCE(u.username, '') as username,
  COALESCE(g.firstName, '') as guest_first_name,
  COALESCE(g.lastName, '') as guest_last_name,
  COALESCE(g.email, '') as guest_email,
  COALESCE(g.loyaltyTier, '') as guest_loyalty_tier,
  CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
  COALESCE(r.number, '') as room_number,
  COALESCE(r.name, '') as room_name,
  COALESCE(r.floor, 0) as room_floor,
  COALESCE(p.name, '') as property_name,
  COALESCE(wp.name, '') as plan_name,
  wp.downloadSpeed as downloadSpeed,
  wp.downloadSpeed as plan_download_speed,
  wp.uploadSpeed as uploadSpeed,
  wp.uploadSpeed as plan_upload_speed,
  wp.dataLimit as dataLimit,
  wp.dataLimit as plan_data_limit,
  COALESCE(b.confirmationCode, '') as booking_code,
  COALESCE(b.status, '') as booking_status,
  s.id as acctuniqueid,
  NULL as framedipv6address,
  '0.0.0.0' as nasipaddress,
  '' as nasidentifier,
  NULL as nasportid,
  'Wireless-802.11' as nasporttype,
  '' as calledstationid,
  NULL as connectinfo_start,
  NULL as connectinfo_stop
FROM WiFiSession s
LEFT JOIN WiFiUser u ON s.guestId = u.guestId
LEFT JOIN Guest g ON s.guestId = g.id
LEFT JOIN Booking b ON s.bookingId = b.id
LEFT JOIN Room r ON b.roomId = r.id
LEFT JOIN Property p ON b.propertyId = p.id
LEFT JOIN WiFiPlan wp ON s.planId = wp.id
WHERE s.status = 'active'
`);
console.log('✓ v_active_sessions view created');

// v_wifi_users and v_user_usage don't need datetime since they don't have date filters
sqlite.exec(`
CREATE VIEW v_wifi_users AS
SELECT
  u.id,
  u.tenantId,
  u.propertyId,
  u.guestId,
  u.bookingId,
  u.username,
  u.planId,
  u.status,
  NULL as authMethod,
  NULL as macAddress,
  u.validFrom,
  u.validUntil,
  u.totalBytesIn,
  u.totalBytesOut,
  u.sessionCount,
  u.lastAccountingAt as lastSeenAt,
  u.createdAt,
  u.updatedAt,
  (SELECT rc.value FROM radcheck rc WHERE rc.username = u.username AND rc.attribute = 'Cleartext-Password' LIMIT 1) as radius_password,
  (SELECT rg.groupname FROM radusergroup rg WHERE rg.username = u.username LIMIT 1) as radius_group,
  g.firstName as guest_first_name,
  g.lastName as guest_last_name,
  g.email as guest_email,
  g.phone as guest_phone,
  g.loyaltyTier as guest_loyalty_tier,
  CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
  r.number as room_number,
  r.name as room_name,
  r.floor as room_floor,
  p.name as property_name,
  wp.name as plan_name,
  wp.downloadSpeed as plan_download_speed,
  wp.uploadSpeed as plan_upload_speed,
  wp.dataLimit as plan_data_limit,
  b.confirmationCode as booking_code,
  b.status as booking_status,
  b.checkIn as booking_check_in,
  b.checkOut as booking_check_out
FROM WiFiUser u
LEFT JOIN Guest g ON u.guestId = g.id
LEFT JOIN Booking b ON u.bookingId = b.id
LEFT JOIN Room r ON b.roomId = r.id
LEFT JOIN Property p ON u.propertyId = p.id
LEFT JOIN WiFiPlan wp ON u.planId = wp.id
`);
console.log('✓ v_wifi_users view created');

sqlite.exec(`
CREATE VIEW v_user_usage AS
SELECT
  u.id as user_id,
  u.tenantId,
  u.propertyId,
  u.guestId,
  u.bookingId,
  u.username,
  u.planId,
  u.status,
  u.totalBytesIn,
  u.totalBytesOut,
  u.totalBytesIn + u.totalBytesOut as total_data_used,
  u.sessionCount,
  u.lastAccountingAt as lastSeenAt,
  u.createdAt,
  u.updatedAt,
  COALESCE(g.firstName, '') as guest_first_name,
  COALESCE(g.lastName, '') as guest_last_name,
  COALESCE(g.email, '') as guest_email,
  COALESCE(g.loyaltyTier, '') as guest_loyalty_tier,
  CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
  COALESCE(r.number, '') as room_number,
  COALESCE(r.name, '') as room_name,
  COALESCE(p.name, '') as property_name,
  COALESCE(wp.name, '') as plan_name,
  wp.downloadSpeed as plan_download_speed,
  wp.uploadSpeed as plan_upload_speed,
  wp.dataLimit as plan_data_limit,
  COALESCE(b.confirmationCode, '') as booking_code,
  COALESCE(b.status, '') as booking_status
FROM WiFiUser u
LEFT JOIN Guest g ON u.guestId = g.id
LEFT JOIN Booking b ON u.bookingId = b.id
LEFT JOIN Room r ON b.roomId = r.id
LEFT JOIN Property p ON u.propertyId = p.id
LEFT JOIN WiFiPlan wp ON u.planId = wp.id
`);
console.log('✓ v_user_usage view created');

// Verify
const t1 = sqlite.query("SELECT acctstarttime, typeof(acctstarttime) FROM v_session_history LIMIT 1").get() as any;
console.log(`\nDate format now: "${t1.acctstarttime}" (type: ${t1.t})`);

const t2 = sqlite.query("SELECT COUNT(*) as c FROM v_session_history").get() as any;
const t3 = sqlite.query("SELECT COUNT(*) as c FROM v_session_history WHERE acctstarttime >= date('now', '-7 days')").get() as any;
console.log(`Total sessions: ${t2.c}, Last 7 days: ${t3.c}`);

console.log('\n✅ All views created with datetime formatting!');
sqlite.close();
process.exit(0);
