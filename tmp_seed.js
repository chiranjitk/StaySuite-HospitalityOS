import Database from 'bun:sqlite';
const db = new Database('/home/z/my-project/db/custom.db');
db.run('DELETE FROM radpostauth'); db.run('DELETE FROM radacct');

const cols = 'acctsessionid,acctuniqueid,username,realm,nasipaddress,nasportid,nasporttype,acctstarttime,acctupdatetime,acctstoptime,acctinterval,acctsessiontime,acctauthentic,connectinfo_start,connectinfo_stop,acctinputoctets,acctoutputoctets,acctinputgigawords,acctoutputgigawords,calledstationid,callingstationid,acctterminatecause,servicetype,framedprotocol,framedipaddress,framedipv6address,framedipv6prefix,framedinterfaceid,delegatedipv6prefix,class,acctinputpackets,acctoutputpackets,acctstatus,createdAt,updatedAt';
const stmt = db.prepare('INSERT INTO radacct (' + cols + ') VALUES (' + cols.split(',').map(() => '?').join(',') + ')');

const N = '';
const h0 = '2026-04-25 18:00:00';
const h1 = '2026-04-25 19:00:00';
const h2 = '2026-04-25 19:30:00';
const h3 = '2026-04-25 20:00:00';
const rows = [
  // [acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype, acctstarttime, acctupdatetime, acctstoptime, acctinterval, acctsessiontime, acctauthentic, connectinfo_start, connectinfo_stop, acctinputoctets, acctoutputoctets, acctinputgigawords, acctoutputgigawords, calledstationid, callingstationid, acctterminatecause, servicetype, framedprotocol, framedipaddress, framedipv6address, framedipv6prefix, framedinterfaceid, delegatedipv6prefix, class, acctinputpackets, acctoutputpackets, acctstatus, createdAt, updatedAt]
  ['sess_101_a', 'uuid-1', 'room_101_abcd', N, '10.0.1.1', '0', 'Wireless', h2, h3, null, null, 3600, null, null, null, 209715200, 524288000, 0, 0, 'AP-Floor1', 'AA:BB:CC:11:22:33', N, N, '10.10.0.55', N, N, N, N, N, 0, 0, 'start', h2, h3],
  ['sess_205_a', 'uuid-2', 'room_205_efgh', N, '10.0.1.1', '1', 'Wireless', h3, h3, null, null, 1800, null, null, null, 104857600, 262144000, 0, 0, 'AP-Floor2', 'AA:BB:CC:44:55:66', N, N, '10.10.1.50', N, N, N, N, N, 0, 0, 'start', h3, h3],
  ['sess_402_a', 'uuid-3', 'room_402_mnop', N, '10.0.2.1', '2', 'Wireless', h3, h3, null, null, 900, null, null, null, 52428800, 157286400, 0, 0, 'AP-Floor4', 'DD:EE:FF:11:22:33', N, N, '10.10.2.100', N, N, N, N, N, 0, 0, 'start', h3, h3],
  ['sess_505_a', 'uuid-4', 'room_505_qrst', N, '10.0.1.1', '3', 'Wireless', h3, h3, null, null, 600, null, null, null, 31457280, 104857600, 0, 0, 'AP-Floor5', 'DD:EE:FF:44:55:66', N, N, '10.10.3.10', N, N, N, N, N, 0, 0, 'start', h3, h3],
  ['sess_101_d', 'uuid-5', 'room_101_abcd', N, '10.0.1.1', '0', 'Wireless', h0, h1, h1, null, 7200, null, null, null, 1073741824, 3221225472, 0, 0, 'AP-Floor1', 'AA:BB:CC:11:22:33', 'User-Request', N, '10.10.0.55', N, N, N, N, N, 0, 0, 'stop', h0, h1],
  ['sess_310_d', 'uuid-6', 'room_310_ijkl', N, '10.0.2.1', '1', 'Wireless', h1, h2, h2, null, 5400, null, null, null, 838860800, 2147483648, 0, 0, 'AP-Floor3', 'AA:BB:CC:77:88:99', 'User-Request', N, '10.10.0.60', N, N, N, N, N, 0, 0, 'stop', h1, h2],
  ['sess_205_d', 'uuid-7', 'room_205_efgh', N, '10.0.1.1', '1', 'Wireless', h0, h1, h1, null, 10800, null, null, null, 2684354560, 5368709120, 0, 0, 'AP-Floor2', 'AA:BB:CC:44:55:66', 'User-Request', N, '10.10.1.50', N, N, N, N, N, 0, 0, 'stop', h0, h1],
];

for (const r of rows) stmt.run(...r);

const authStmt = db.prepare('INSERT INTO radpostauth (username, reply, authdate) VALUES (?, ?, ?)');
const auths = [
  ['room_101_abcd', 'Access-Accept', h2],
  ['room_101_abcd', 'Access-Accept', h3],
  ['room_101_abcd', 'Access-Reject', h3],
  ['room_205_efgh', 'Access-Accept', h3],
  ['room_310_ijkl', 'Access-Accept', h1],
  ['room_402_mnop', 'Access-Accept', h3],
  ['room_505_qrst', 'Access-Accept', h3],
  ['unknown_user', 'Access-Reject', h2],
];
for (const a of auths) authStmt.run(...a);

console.log('radacct:', db.query('SELECT COUNT(*) as c FROM radacct').get().c, 'active:', db.query('SELECT COUNT(*) as c FROM radacct WHERE acctstoptime IS NULL').get().c, 'auth:', db.query('SELECT COUNT(*) as c FROM radpostauth').get().c);
db.close();
