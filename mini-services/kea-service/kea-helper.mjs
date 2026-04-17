// Kea Unix Socket Helper - Uses Node.js net module for reliable unix socket communication
// This is called as a subprocess by the kea-service because Bun's net module has issues with unix sockets

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/home/z/my-project';

// Detect if Kea is system-installed
const SYSTEM_KEA = (() => {
  try {
    execSync('which kea-dhcp4 2>/dev/null', { encoding: 'utf-8' });
    return true;
  } catch { return false; }
})();

const KEA_SOCKET_PATH = process.env.KEA_SOCKET_PATH || (SYSTEM_KEA ? '/run/kea/kea4-ctrl-socket' : '/tmp/kea/kea4-ctrl-socket');
const KEA_LEASES_FILE = process.env.KEA_LEASES_FILE || (SYSTEM_KEA ? '/var/lib/kea/kea-leases4.csv' : '/tmp/lib/kea/kea-leases4.csv');
const KEA_CONFIG_PATH = SYSTEM_KEA
  ? (process.env.KEA_CONFIG_PATH || '/etc/kea/kea-dhcp4.conf')
  : (process.env.KEA_CONFIG_PATH || path.join(PROJECT_ROOT, 'kea-local', 'kea-dhcp4-writable.conf'));
const COMMAND_TIMEOUT = 5000;

function sendKeaCommand(command) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      ...command,
      service: command.service || ['dhcp4'],
    });

    const client = net.createConnection(KEA_SOCKET_PATH, () => {
      client.write(payload + '\n');
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      try {
        const response = JSON.parse(data);
        resolve(Array.isArray(response) ? response : [response]);
      } catch (e) {
        reject(new Error(`Failed to parse Kea response: ${data.substring(0, 200)}`));
      }
    });

    client.on('error', (err) => {
      reject(new Error(`Kea socket error: ${err.message}`));
    });

    client.setTimeout(COMMAND_TIMEOUT, () => {
      client.destroy();
      reject(new Error('Kea command timeout'));
    });
  });
}

function readLeasesFile() {
  try {
    const content = fs.readFileSync(KEA_LEASES_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return [];
    const leases = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(',');
      if (fields.length < 10) continue;
      leases.push({
        address: fields[0] || '',
        hwaddr: fields[1] || '',
        clientId: fields[2] || '',
        validLifetime: parseInt(fields[3]) || 3600,
        expire: parseInt(fields[4]) || 0,
        subnetId: parseInt(fields[5]) || 0,
        fqdnFwd: fields[6] === '1',
        fqdnRev: fields[7] === '1',
        hostname: fields[8] || '',
        state: parseInt(fields[9]) || 0,
        userContext: fields[10] || '',
        poolId: parseInt(fields[11]) || 0,
      });
    }
    return leases;
  } catch {
    return [];
  }
}

// Main - read command from stdin, output result as JSON
const command = process.argv[2];

async function run() {
  try {
    if (command === 'leases') {
      const leases = readLeasesFile();
      console.log(JSON.stringify({ success: true, data: leases }));
      return;
    }

    if (command === 'command') {
      const keaCmd = JSON.parse(process.argv[3] || '{}');
      const result = await sendKeaCommand(keaCmd);
      console.log(JSON.stringify({ success: true, data: result }));
      return;
    }

    if (command === 'ping') {
      const result = await sendKeaCommand({ command: 'status-get' });
      console.log(JSON.stringify({ success: true, reachable: result[0]?.result === 0 }));
      return;
    }

    console.log(JSON.stringify({ success: false, error: `Unknown command: ${command}` }));
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: String(error) }));
  }
}

run();
