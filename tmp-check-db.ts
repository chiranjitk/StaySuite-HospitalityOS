import Database from 'bun:sqlite';

const db = new Database('/home/z/my-project/upload/custom.db', { readonly: true });

// List all tables
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== ALL TABLES ===');
tables.forEach((t: any) => console.log(t.name));

console.log('\n=== TABLE ROW COUNTS ===');
tables.forEach((t: any) => {
  try {
    const count = db.query('SELECT COUNT(*) as cnt FROM "' + t.name + '"').get() as any;
    console.log(t.name + ': ' + count.cnt + ' rows');
  } catch(e: any) {
    console.log(t.name + ': ERROR - ' + e.message);
  }
});

// Check RadCheck data
console.log('\n=== RadCheck TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadCheck').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 5).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check RadReply data
console.log('\n=== RadReply TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadReply').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 5).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check RadUserGroup
console.log('\n=== RadUserGroup TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadUserGroup').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 5).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check WiFiUser
console.log('\n=== WiFiUser TABLE ===');
try {
  const rows = db.query('SELECT * FROM WiFiUser').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check RadGroupCheck
console.log('\n=== RadGroupCheck TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadGroupCheck').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 10).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check RadGroupReply
console.log('\n=== RadGroupReply TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadGroupReply').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 10).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check RadAcct
console.log('\n=== RadAcct TABLE ===');
try {
  const rows = db.query('SELECT * FROM RadAcct').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  if (rows.length > 0) {
    rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
  }
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check AuthLog
console.log('\n=== AuthLog TABLE ===');
try {
  const rows = db.query('SELECT * FROM AuthLog').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  if (rows.length > 0) {
    rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
  }
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check nas_clients
console.log('\n=== nas_clients TABLE ===');
try {
  const rows = db.query('SELECT * FROM nas_clients').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check WiFiPlan
console.log('\n=== WiFiPlan TABLE ===');
try {
  const rows = db.query('SELECT * FROM WiFiPlan').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check WiFiVoucher
console.log('\n=== WiFiVoucher TABLE ===');
try {
  const rows = db.query('SELECT * FROM WiFiVoucher').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  rows.slice(0, 5).forEach((r: any) => console.log(JSON.stringify(r)));
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check WiFiSession
console.log('\n=== WiFiSession TABLE ===');
try {
  const rows = db.query('SELECT * FROM WiFiSession').all();
  console.log('Columns:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : '(empty)');
  if (rows.length > 0) {
    rows.slice(0, 5).forEach((r: any) => console.log(JSON.stringify(r)));
  }
  console.log('Total:', rows.length);
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check mac_auth_entries or similar
console.log('\n=== MAC Auth Related Tables ===');
try {
  const macTables = tables.filter((t: any) => t.name.toLowerCase().includes('mac'));
  macTables.forEach((t: any) => {
    const rows = db.query('SELECT * FROM "' + t.name + '"').all();
    console.log(t.name + ': ' + rows.length + ' rows');
    if (rows.length > 0) {
      console.log('Columns:', Object.keys(rows[0]).join(', '));
      rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
    }
  });
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check content filter related
console.log('\n=== Content Filter Related Tables ===');
try {
  const cfTables = tables.filter((t: any) => t.name.toLowerCase().includes('content') || t.name.toLowerCase().includes('filter'));
  cfTables.forEach((t: any) => {
    const rows = db.query('SELECT * FROM "' + t.name + '"').all();
    console.log(t.name + ': ' + rows.length + ' rows');
    if (rows.length > 0) {
      console.log('Columns:', Object.keys(rows[0]).join(', '));
      rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
    }
  });
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check portal whitelist related
console.log('\n=== Portal Whitelist Related Tables ===');
try {
  const pwTables = tables.filter((t: any) => t.name.toLowerCase().includes('portal') || t.name.toLowerCase().includes('whitelist'));
  pwTables.forEach((t: any) => {
    const rows = db.query('SELECT * FROM "' + t.name + '"').all();
    console.log(t.name + ': ' + rows.length + ' rows');
    if (rows.length > 0) {
      console.log('Columns:', Object.keys(rows[0]).join(', '));
      rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
    }
  });
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check event related
console.log('\n=== Event WiFi Related Tables ===');
try {
  const evTables = tables.filter((t: any) => t.name.toLowerCase().includes('event'));
  evTables.forEach((t: any) => {
    const rows = db.query('SELECT * FROM "' + t.name + '"').all();
    console.log(t.name + ': ' + rows.length + ' rows');
    if (rows.length > 0) {
      console.log('Columns:', Object.keys(rows[0]).join(', '));
      rows.slice(0, 3).forEach((r: any) => console.log(JSON.stringify(r)));
    }
  });
} catch(e: any) {
  console.log('ERROR:', e.message);
}

// Check Guest table
console.log('\n=== Guest TABLE ===');
try {
  const rows = db.query('SELECT id, firstName, lastName, status, roomId FROM Guest LIMIT 5').all();
  console.log('Total:', db.query('SELECT COUNT(*) as cnt FROM Guest').get() as any);
  rows.forEach((r: any) => console.log(JSON.stringify(r)));
} catch(e: any) {
  console.log('ERROR:', e.message);
}

db.close();
console.log('\n=== DONE ===');
