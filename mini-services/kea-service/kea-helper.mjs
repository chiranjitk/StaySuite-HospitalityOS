// Kea Unix Socket Helper - Uses Node.js net module for reliable unix socket communication
// This is called as a subprocess by the kea-service because Bun's net module has issues with unix sockets

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');

// Detect if Kea is system-installed
const SYSTEM_KEA = (() => {
  try {
    execSync('which kea-dhcp4 2>/dev/null', { encoding: 'utf-8' });
    return true;
  } catch { return false; }
})();

const KEA_CONFIG_PATH = SYSTEM_KEA
  ? (process.env.KEA_CONFIG_PATH || '/etc/kea/kea-dhcp4.conf')
  : (process.env.KEA_CONFIG_PATH || path.join(PROJECT_ROOT, 'kea-local', 'kea-dhcp4-writable.conf'));

/**
 * Dynamically resolve the Kea control socket path.
 * Tries (in order):
 *   1. KEA_SOCKET_PATH env var
 *   2. Extract from Kea config file (Control-agent socket-name)
 *   3. Extract from Kea config file (Dhcp4 control-socket socket-name)
 *   4. Common filesystem locations
 *   5. Fallback defaults
 */
function resolveSocketPath() {
  // 1. Environment override
  if (process.env.KEA_SOCKET_PATH) return process.env.KEA_SOCKET_PATH;

  // Try to read socket path from Kea config files
  const configPaths = [
    '/etc/kea/kea-ctrl-agent.conf',
    '/etc/kea/kea-dhcp4.conf',
    KEA_CONFIG_PATH,
  ];

  for (const cfgPath of configPaths) {
    try {
      const content = fs.readFileSync(cfgPath, 'utf-8');
      // Match: "socket-name": "/path/to/socket"
      const match = content.match(/"socket-name"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        console.error(`[kea-helper] Found socket in ${cfgPath}: ${match[1]}`);
        return match[1];
      }
    } catch { /* file doesn't exist or not readable */ }
  }

  // Scan common socket locations
  const commonSocketPaths = [
    '/run/kea/kea4-ctrl-socket',
    '/tmp/kea/kea4-ctrl-socket',
    '/var/run/kea/kea4-ctrl-socket',
    '/run/kea-dhcp4/kea4-ctrl-socket',
    '/run/kea/kea-ctrl-agent-socket',
  ];
  for (const sockPath of commonSocketPaths) {
    try {
      fs.accessSync(sockPath, fs.constants.R_OK | fs.constants.W_OK);
      console.error(`[kea-helper] Found socket at ${sockPath}`);
      return sockPath;
    } catch { /* not accessible */ }
  }

  // Also try find command
  try {
    const found = execSync('find /run /tmp /var/run -name "*kea*ctrl*socket*" -type S 2>/dev/null | head -1', { encoding: 'utf-8' }).trim();
    if (found) {
      console.error(`[kea-helper] Discovered socket via find: ${found}`);
      return found;
    }
  } catch {}

  // Fallback defaults
  const fallback = SYSTEM_KEA ? '/run/kea/kea4-ctrl-socket' : '/tmp/kea/kea4-ctrl-socket';
  console.error(`[kea-helper] Using fallback socket path: ${fallback}`);
  return fallback;
}

/**
 * Dynamically resolve the Kea leases file path.
 */
function resolveLeasesPath() {
  if (process.env.KEA_LEASES_FILE) return process.env.KEA_LEASES_FILE;

  const leasePaths = SYSTEM_KEA
    ? ['/var/lib/kea/kea-leases4.csv', '/var/lib/kea/kea-leases4.csv.4', '/tmp/lib/kea/kea-leases4.csv']
    : ['/tmp/lib/kea/kea-leases4.csv'];

  for (const lp of leasePaths) {
    try {
      fs.accessSync(lp, fs.constants.R_OK);
      return lp;
    } catch {}
  }

  // Check config for lease file path
  for (const cfgPath of ['/etc/kea/kea-dhcp4.conf', KEA_CONFIG_PATH]) {
    try {
      const content = fs.readFileSync(cfgPath, 'utf-8');
      const match = content.match(/"lease-file"\s*:\s*"([^"]+)"/);
      if (match && match[1]) return match[1];
    } catch {}
  }

  return SYSTEM_KEA ? '/var/lib/kea/kea-leases4.csv' : '/tmp/lib/kea/kea-leases4.csv';
}

const KEA_SOCKET_PATH = resolveSocketPath();
const KEA_LEASES_FILE = resolveLeasesPath();
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
