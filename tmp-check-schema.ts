import Database from 'bun:sqlite';

const db = new Database('/home/z/my-project/upload/custom.db', { readonly: true });

// Check schemas for all WiFi/RADIUS related tables
const tables = [
  'RadCheck', 'RadReply', 'RadUserGroup', 'RadGroupCheck', 'RadGroupReply',
  'RadAcct', 'WiFiUser', 'WiFiPlan', 'WiFiVoucher', 'WiFiSession',
  'RadiusAuthLog', 'RadiusCoaLog', 'RadiusEventUser', 'RadiusMacAuth',
  'RadiusNAS', 'RadiusProvisioningLog', 'RadiusServerConfig',
  'Guest', 'Booking', 'ContentFilter', 'PortalWhitelist',
  'LiveSession', 'CoaSessionDetail', 'MacFilter',
  'BandwidthPolicy', 'BandwidthPolicyDetail', 'BandwidthUsageDaily', 'BandwidthUsageSession',
  'FairAccessPolicy', 'NasHealthLog', 'WiFiUserStatusHistory',
  'WebCategory', 'WebCategorySchedule', 'ScheduleAccess',
  'WiFiAAAConfig', 'WiFiAccountingSync', 'WiFiGateway',
  'CaptivePortal', 'DhcpLease', 'DhcpReservation', 'DhcpSubnet',
  'DnsRecord', 'DnsRedirectRule', 'DnsZone',
  'FirewallRule', 'FirewallSchedule', 'FirewallZone',
  'InterfaceAlias', 'InterfaceConfig', 'InterfaceRole',
  'MultiWanConfig', 'MultiWanMember', 'NatLog',
  'NetworkInterface', 'PortForwardRule', 'StaticRoute',
  'VlanConfig', 'WanFailover', 'SystemNetworkHealth'
];

console.log('=== TABLE SCHEMAS ===\n');

tables.forEach(tableName => {
  try {
    const info = db.query("PRAGMA table_info(\"" + tableName + "\")").all() as any[];
    if (info.length > 0) {
      console.log('--- ' + tableName + ' (' + info.length + ' columns) ---');
      info.forEach(col => {
        const pk = col.pk ? ' [PK]' : '';
        const nn = col.notnull ? ' NOT NULL' : '';
        const def = col.dflt_value !== null ? ' DEFAULT ' + col.dflt_value : '';
        console.log('  ' + col.name + ' (' + col.type + ')' + pk + nn + def);
      });
      console.log('');
    }
  } catch(e: any) {
    // Table doesn't exist - skip
  }
});

// Check some seed data
console.log('\n=== BOOKING DATA ===');
try {
  const bookings = db.query('SELECT id, guestId, roomId, checkInDate, checkOutDate, status FROM Booking').all() as any[];
  bookings.forEach(b => console.log(JSON.stringify(b)));
} catch(e: any) { console.log('ERROR:', e.message); }

console.log('\n=== GUEST DATA ===');
try {
  const guests = db.query('SELECT id, firstName, lastName, email, phone FROM Guest LIMIT 5').all() as any[];
  guests.forEach(g => console.log(JSON.stringify(g)));
} catch(e: any) { console.log('ERROR:', e.message); }

console.log('\n=== PROPERTY DATA ===');
try {
  const props = db.query('SELECT id, name FROM Property').all() as any[];
  props.forEach(p => console.log(JSON.stringify(p)));
} catch(e: any) { console.log('ERROR:', e.message); }

console.log('\n=== ROOM DATA (first 3) ===');
try {
  const rooms = db.query('SELECT id, roomNumber, roomTypeId, propertyId, status FROM Room LIMIT 3').all() as any[];
  rooms.forEach(r => console.log(JSON.stringify(r)));
} catch(e: any) { console.log('ERROR:', e.message); }

db.close();
console.log('\n=== DONE ===');
