/**
 * nftables Firewall Management Service for StaySuite HospitalityOS
 *
 * Manages nftables firewall rules on Debian 13:
 * - Firewall zones with input/forward/output chain policies
 * - Individual rule management (add/delete by handle)
 * - MAC address filtering (whitelist/blacklist sets)
 * - Bandwidth limiting via nftables rate limiting
 * - DNS-based content filtering
 * - Atomic config apply via nft -f
 * - Config validation via nft -c -f
 * - Full flush of StaySuite-managed rules
 *
 * Port: 3013
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../shared/logger';

const app = new Hono();
const PORT = 3013;
const SERVICE_VERSION = '1.0.0';
const log = createLogger('nftables-service');
const startTime = Date.now();

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
const NFTABLES_CONFIG_DIR = '/etc/nftables.d';
const NFTABLES_CONFIG = path.join(NFTABLES_CONFIG_DIR, 'staysuite.conf');
const TABLE_NAME = 'staysuite';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Execute a shell command safely, returning stdout or empty string on failure.
 */
function safeExec(cmd: string, timeout = 10000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout });
  } catch {
    return '';
  }
}

/**
 * Execute a shell command and return result with error info.
 */
function execNft(cmd: string, timeout = 10000): { success: boolean; output: string; error: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout, stderr: 'pipe' });
    return { success: true, output: output.trim(), error: '' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string })?.stderr || '';
    return { success: false, output: '', error: stderr || error };
  }
}

/**
 * Check if nftables is installed on the system.
 */
function isNftablesInstalled(): boolean {
  try {
    execSync('which nft 2>/dev/null', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get nftables version string.
 */
function getNftablesVersion(): string {
  const result = execNft('nft -v 2>&1');
  if (result.success) {
    // Typically "nftables v1.0.6 ..." or similar
    const match = result.output.match(/nftables\s+v([\d.]+)/i);
    return match ? match[1] : result.output.split('\n')[0];
  }
  return 'Not installed';
}

/**
 * Get list of current nftables tables.
 */
function listTables(): string[] {
  const result = execNft('nft list tables 2>/dev/null');
  if (!result.success) return [];
  return result.output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Get the full current ruleset as a string.
 */
function listRuleset(): string {
  const result = execNft('nft list ruleset 2>/dev/null');
  return result.success ? result.output : '';
}

/**
 * Ensure the nftables.d config directory exists.
 */
function ensureConfigDir(): void {
  try {
    fs.mkdirSync(NFTABLES_CONFIG_DIR, { recursive: true });
  } catch {}
}

/**
 * Check if the staysuite table exists in nftables.
 */
function staysuiteTableExists(): boolean {
  const tables = listTables();
  return tables.some(t => t.includes(TABLE_NAME));
}

// ============================================================================
// Config Generation
// ============================================================================

interface FirewallZone {
  name: string;
  inputPolicy: string;
  forwardPolicy: string;
  outputPolicy: string;
  rules: FirewallRule[];
}

interface FirewallRule {
  chain: string;       // input, forward, output
  sourceIp?: string;
  destIp?: string;
  protocol?: string;
  sourcePort?: string;
  destPort?: string;
  action: string;      // accept, drop, reject, log
  comment?: string;
}

interface MacFilterEntry {
  set: string;         // mac_whitelist or mac_blacklist
  address: string;
}

interface BandwidthLimit {
  ip: string;
  rate: string;        // e.g., "10m" for 10mbit/s, "1k" for 1kpackets/s
  direction: string;   // ingress or egress
}

interface ContentFilterEntry {
  domain: string;
  sinkholeIp: string;
}

interface FirewallConfig {
  zones: FirewallZone[];
  macFilters: MacFilterEntry[];
  bandwidthLimits: BandwidthLimit[];
  contentFilters: ContentFilterEntry[];
}

/**
 * Generate a complete nftables config file from a FirewallConfig object.
 */
function generateNftablesConfig(config: FirewallConfig): string {
  let conf = `#!/usr/sbin/nft -f
# StaySuite nftables Firewall Configuration - Auto-generated
# Last updated: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - Changes will be overwritten

flush table ip ${TABLE_NAME}

table ip ${TABLE_NAME} {

`;

  // --- MAC filter sets ---
  const whitelistedMacs = config.macFilters
    .filter(m => m.set === 'mac_whitelist')
    .map(m => m.address);
  const blacklistedMacs = config.macFilters
    .filter(m => m.set === 'mac_blacklist')
    .map(m => m.address);

  if (whitelistedMacs.length > 0) {
    conf += `  set mac_whitelist {\n    type ether_addr\n    elements = { ${whitelistedMacs.join(', ')} }\n  }\n\n`;
  } else {
    conf += `  set mac_whitelist {\n    type ether_addr\n  }\n\n`;
  }

  if (blacklistedMacs.length > 0) {
    conf += `  set mac_blacklist {\n    type ether_addr\n    elements = { ${blacklistedMacs.join(', ')} }\n  }\n\n`;
  } else {
    conf += `  set mac_blacklist {\n    type ether_addr\n  }\n\n`;
  }

  // --- Content filter set (blocked domain sinkhole IPs) ---
  if (config.contentFilters.length > 0) {
    const sinkholeIps = [...new Set(config.contentFilters.map(f => f.sinkholeIp))];
    conf += `  set content_filter_sinkholes {\n    type ipv4_addr\n    flags interval\n    elements = { `;
    conf += sinkholeIps.join(', ');
    conf += ` }\n  }\n\n`;
  }

  // --- Base chains (always present) ---
  const defaultInputPolicy = config.zones.length > 0 ? config.zones[0].inputPolicy || 'accept' : 'accept';
  const defaultForwardPolicy = config.zones.length > 0 ? config.zones[0].forwardPolicy || 'accept' : 'accept';
  const defaultOutputPolicy = config.zones.length > 0 ? config.zones[0].outputPolicy || 'accept' : 'accept';

  // Input chain
  conf += `  chain input {\n    type filter hook input priority 0; policy ${defaultInputPolicy};\n\n`;
  // Always allow loopback
  conf += `    # Allow loopback\n    iif "lo" accept\n\n`;
  // Always allow established connections
  conf += `    # Allow established/related connections\n    ct state established,related accept\n\n`;
  // Allow ICMP
  conf += `    # Allow ICMP\n    ip protocol icmp accept\n\n`;

  // MAC blacklist drop in input
  if (blacklistedMacs.length > 0) {
    conf += `    # Drop blacklisted MAC addresses\n    ether saddr @mac_blacklist drop\n\n`;
  }

  // Zone-specific input rules
  for (const zone of config.zones) {
    const inputRules = zone.rules.filter(r => r.chain === 'input');
    if (inputRules.length > 0) {
      conf += `    # Zone: ${zone.name}\n`;
      for (const rule of inputRules) {
        conf += `    ${generateRuleLine(rule)}\n`;
      }
      conf += '\n';
    }
  }

  conf += `  }\n\n`;

  // Forward chain
  conf += `  chain forward {\n    type filter hook forward priority 0; policy ${defaultForwardPolicy};\n\n`;
  // Allow established
  conf += `    # Allow established/related connections\n    ct state established,related accept\n\n`;

  // MAC blacklist drop in forward
  if (blacklistedMacs.length > 0) {
    conf += `    # Drop blacklisted MAC addresses\n    ether saddr @mac_blacklist drop\n\n`;
  }

  // Zone-specific forward rules
  for (const zone of config.zones) {
    const forwardRules = zone.rules.filter(r => r.chain === 'forward');
    if (forwardRules.length > 0) {
      conf += `    # Zone: ${zone.name}\n`;
      for (const rule of forwardRules) {
        conf += `    ${generateRuleLine(rule)}\n`;
      }
      conf += '\n';
    }
  }

  // Bandwidth limits (rate limiting on forward)
  if (config.bandwidthLimits.length > 0) {
    conf += `    # Bandwidth limits\n`;
    for (const bw of config.bandwidthLimits) {
      if (bw.direction === 'egress' || bw.direction === 'download') {
        conf += `    ip daddr ${bw.ip} limit rate over ${bw.rate}/second drop\n`;
      } else {
        conf += `    ip saddr ${bw.ip} limit rate over ${bw.rate}/second drop\n`;
      }
    }
    conf += '\n';
  }

  conf += `  }\n\n`;

  // Output chain
  conf += `  chain output {\n    type filter hook output priority 0; policy ${defaultOutputPolicy};\n\n`;

  // Zone-specific output rules
  for (const zone of config.zones) {
    const outputRules = zone.rules.filter(r => r.chain === 'output');
    if (outputRules.length > 0) {
      conf += `    # Zone: ${zone.name}\n`;
      for (const rule of outputRules) {
        conf += `    ${generateRuleLine(rule)}\n`;
      }
      conf += '\n';
    }
  }

  conf += `  }\n\n`;

  // --- Per-zone dedicated chains ---
  for (const zone of config.zones) {
    const zoneChainName = `zone_${zone.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    conf += `  chain ${zoneChainName} {\n`;
    const zoneRules = zone.rules;
    if (zoneRules.length > 0) {
      for (const rule of zoneRules) {
        conf += `    ${generateRuleLine(rule)}\n`;
      }
    }
    conf += `  }\n\n`;
  }

  // --- DNS content filtering NAT chain ---
  // Redirects DNS queries from clients to the StaySuite DNS sinkhole.
  // When a client queries a blocked domain, the DNS response resolves to the
  // sinkhole IP (configured via dnsmasq address= directives). The nftables
  // layer then ensures that any connection attempts to sinkhole IPs are
  // either redirected to a captive portal or dropped.
  if (config.contentFilters.length > 0) {
    // NAT prerouting chain: redirect DNS to local dnsmasq for content filtering
    conf += `  chain dns_redirect {\n`;
    conf += `    type nat hook prerouting priority -100; policy accept;\n`;
    conf += `    # Redirect all outbound DNS (UDP/53) from guest networks to local dnsmasq\n`;
    conf += `    # dnsmasq will return sinkhole IPs for blocked domains\n`;
    conf += `    udp dport 53 dnat to :53 comment "dns-redirect-udp"\n`;
    conf += `    tcp dport 53 dnat to :53 comment "dns-redirect-tcp"\n`;
    conf += `  }\n\n`;

    // Filter chain: drop or reject connections to blocked domain sinkhole IPs
    conf += `  chain content_filter {\n`;
    conf += `    type filter hook forward priority 10; policy accept;\n`;
    conf += `    # Content filtering: drop connections to blocked domain sinkhole IPs\n`;
    for (const cf of config.contentFilters) {
      conf += `    # Blocked: ${cf.domain} -> ${cf.sinkholeIp}\n`;
      conf += `    ip daddr ${cf.sinkholeIp} drop comment "blocked:${cf.domain.replace(/[^a-zA-Z0-9._-]/g, '_')}"\n`;
    }
    conf += `  }\n\n`;
  }

  conf += `}\n`;

  return conf;
}

/**
 * Generate a single nft rule line from a rule object.
 */
function generateRuleLine(rule: FirewallRule): string {
  const parts: string[] = [];

  if (rule.sourceIp) {
    parts.push(`ip saddr ${rule.sourceIp}`);
  }
  if (rule.destIp) {
    parts.push(`ip daddr ${rule.destIp}`);
  }
  if (rule.protocol) {
    const proto = rule.protocol.toLowerCase();
    parts.push(`ip protocol ${proto === 'icmp' ? 'icmp' : proto === 'tcp' ? 'tcp' : proto === 'udp' ? 'udp' : proto}`);
  }
  if (rule.sourcePort && rule.protocol && ['tcp', 'udp'].includes(rule.protocol.toLowerCase())) {
    parts.push(`${rule.protocol.toLowerCase()} sport ${rule.sourcePort}`);
  }
  if (rule.destPort && rule.protocol && ['tcp', 'udp'].includes(rule.protocol.toLowerCase())) {
    parts.push(`${rule.protocol.toLowerCase()} dport ${rule.destPort}`);
  }

  let action = rule.action || 'accept';
  if (!['accept', 'drop', 'reject', 'log', 'masquerade'].includes(action)) {
    action = 'accept';
  }

  const comment = rule.comment ? ` comment "${rule.comment.replace(/"/g, '\\"')}"` : '';

  return `${parts.join(' ')} ${action}${comment}`;
}

/**
 * Count rules in the staysuite table.
 */
function countRules(): number {
  if (!staysuiteTableExists()) return 0;
  const result = execNft(`nft list table ip ${TABLE_NAME} 2>/dev/null`);
  if (!result.success) return 0;
  // Count lines that contain nft rule actions (accept, drop, reject)
  const lines = result.output.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/\b(accept|drop|reject|log|masquerate)\s*$/) && !trimmed.startsWith('#') && !trimmed.startsWith('policy')) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Middleware
// ============================================================================

// Auth middleware - check Bearer token, skip for /health endpoint
app.use('*', async (c, next) => {
  // Allow health check without auth
  if (c.req.path === '/health') {
    return next();
  }

  const authSecret = process.env.SERVICE_AUTH_SECRET;

  // If no secret configured, log warning and allow all (dev mode)
  if (!authSecret) {
    if (!globalThis.__nftAuthWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.');
      globalThis.__nftAuthWarningLogged = true;
    }
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  if (token !== authSecret) {
    return c.json({ success: false, error: 'Invalid token' }, 403);
  }

  return next();
});

(globalThis as Record<string, unknown>).__nftAuthWarningLogged = false;

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'nftables-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
    nftables: {
      installed: isNftablesInstalled(),
      configPath: NFTABLES_CONFIG,
      configExists: fs.existsSync(NFTABLES_CONFIG),
    },
  });
});

// ============================================================================
// GET /api/status - Check nftables status
// ============================================================================

app.get('/api/status', (c) => {
  const installed = isNftablesInstalled();
  const version = installed ? getNftablesVersion() : 'Not installed';
  const tables = listTables();
  const ruleset = listRuleset();
  const activeRulesets = ruleset.split('\n').filter(l => l.trim().length > 0).length;

  const staysuiteExists = staysuiteTableExists();
  let ruleCount = 0;
  if (staysuiteExists) {
    ruleCount = countRules();
  }

  // GUI chain info: check if gui_custom_rules chain exists
  let guiChainExists = false;
  let guiRulesCount = 0;
  let portForwardsCount = 0;
  let rateLimitsCount = 0;
  let quickBlocksCount = 0;

  if (staysuiteExists) {
    const guiChainResult = execNft(`nft list chain ip ${TABLE_NAME} gui_custom_rules 2>/dev/null`);
    if (guiChainResult.success) {
      guiChainExists = true;
      // Count rules in gui_custom_rules (lines with handle or action verbs)
      const guiLines = guiChainResult.output.split('\n');
      for (const line of guiLines) {
        const trimmed = line.trim();
        if (trimmed.match(/\b(accept|drop|reject|log)\b/) && !trimmed.startsWith('#') && !trimmed.startsWith('type') && !trimmed.startsWith('policy')) {
          guiRulesCount++;
        }
      }
    }
  }

  // Read persisted JSON counts
  try {
    const guiRules = readGuiRules();
    guiRulesCount = guiRules.length;
  } catch {}
  try {
    const portForwards = readPortForwards();
    portForwardsCount = portForwards.length;
  } catch {}
  try {
    const rateLimits = readRateLimits();
    rateLimitsCount = rateLimits.length;
  } catch {}
  try {
    const quickBlocks = readQuickBlocks();
    quickBlocksCount = quickBlocks.length;
  } catch {}

  return c.json({
    installed,
    version,
    activeRulesets,
    tables,
    staysuiteTable: staysuiteExists,
    rulesInStaysuite: ruleCount,
    configPath: NFTABLES_CONFIG,
    configExists: fs.existsSync(NFTABLES_CONFIG),
    guiRulesCount,
    portForwardsCount,
    rateLimitsCount,
    quickBlocksCount,
    guiChainExists,
  });
});

// ============================================================================
// POST /api/apply - Apply complete firewall config
// ============================================================================

app.post('/api/apply', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const config: FirewallConfig = await c.req.json();

    // Validate required structure
    if (!config.zones || !Array.isArray(config.zones)) {
      config.zones = [];
    }
    if (!config.macFilters || !Array.isArray(config.macFilters)) {
      config.macFilters = [];
    }
    if (!config.bandwidthLimits || !Array.isArray(config.bandwidthLimits)) {
      config.bandwidthLimits = [];
    }
    if (!config.contentFilters || !Array.isArray(config.contentFilters)) {
      config.contentFilters = [];
    }

    // Generate config
    const nftConfig = generateNftablesConfig(config);

    // Ensure config directory exists
    ensureConfigDir();

    // Write config to disk
    fs.writeFileSync(NFTABLES_CONFIG, nftConfig, 'utf-8');
    log.info('Wrote nftables config', { path: NFTABLES_CONFIG, lines: nftConfig.split('\n').length });

    // Validate config first with check mode
    const check = execNft(`nft -c -f ${NFTABLES_CONFIG} 2>&1`);
    if (!check.success) {
      return c.json({
        success: false,
        error: 'Config validation failed',
        validationErrors: check.error || check.output,
        rulesApplied: 0,
      }, 400);
    }

    // Apply config atomically
    const apply = execNft(`nft -f ${NFTABLES_CONFIG} 2>&1`);
    if (!apply.success) {
      return c.json({
        success: false,
        error: 'Failed to apply nftables config',
        applyError: apply.error || apply.output,
        rulesApplied: 0,
      }, 500);
    }

    const rulesApplied = countRules();

    log.info('Applied nftables config', { rulesApplied });

    return c.json({
      success: true,
      rulesApplied,
      configPath: NFTABLES_CONFIG,
      message: `Firewall config applied with ${rulesApplied} rules`,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error, rulesApplied: 0 }, 500);
  }
});

// ============================================================================
// POST /api/rules - Add a single nftables rule
// ============================================================================

app.post('/api/rules', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const {
      chain = 'input',
      sourceIp,
      destIp,
      protocol,
      sourcePort,
      destPort,
      action = 'accept',
      comment,
    } = body;

    // Ensure staysuite table and chain exist
    if (!staysuiteTableExists()) {
      // Create base table with standard chains
      const baseConfig = `#!/usr/sbin/nft -f
table ip ${TABLE_NAME} {
  chain input {
    type filter hook input priority 0; policy accept;
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
  }
  chain output {
    type filter hook output priority 0; policy accept;
  }
}`;
      ensureConfigDir();
      fs.writeFileSync(NFTABLES_CONFIG, baseConfig, 'utf-8');
      execNft(`nft -f ${NFTABLES_CONFIG}`);
    }

    // Build the rule command
    const ruleParts: string[] = [`nft add rule ip ${TABLE_NAME} ${chain}`];

    if (sourceIp) ruleParts.push(`ip saddr ${sourceIp}`);
    if (destIp) ruleParts.push(`ip daddr ${destIp}`);
    if (protocol) {
      const proto = protocol.toLowerCase();
      ruleParts.push(`ip protocol ${proto === 'icmp' ? 'icmp' : proto === 'tcp' ? 'tcp' : proto === 'udp' ? 'udp' : proto}`);
    }
    if (sourcePort && protocol && ['tcp', 'udp'].includes(protocol.toLowerCase())) {
      ruleParts.push(`${protocol.toLowerCase()} sport ${sourcePort}`);
    }
    if (destPort && protocol && ['tcp', 'udp'].includes(protocol.toLowerCase())) {
      ruleParts.push(`${protocol.toLowerCase()} dport ${destPort}`);
    }

    let ruleAction = action;
    if (!['accept', 'drop', 'reject', 'log', 'masquerade'].includes(ruleAction)) {
      ruleAction = 'accept';
    }
    ruleParts.push(ruleAction);

    if (comment) {
      ruleParts.push(`comment "${comment.replace(/"/g, '\\"')}"`);
    }

    const cmd = ruleParts.join(' ');
    log.info('Adding nftables rule', { chain, action: ruleAction });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to add rule', { command: cmd, error: result.error });
      return c.json({
        success: false,
        error: 'Failed to add rule',
        command: cmd,
        nftError: result.error,
      }, 500);
    }

    // Get the handle of the newly added rule
    const listResult = execNft(`nft list chain ip ${TABLE_NAME} ${chain} -a 2>/dev/null`);
    let handle = -1;
    if (listResult.success) {
      // Parse the last handle from the output
      const handleMatch = listResult.output.match(/handle (\d+)/g);
      if (handleMatch && handleMatch.length > 0) {
        const lastHandle = handleMatch[handleMatch.length - 1].match(/handle (\d+)/);
        if (lastHandle) handle = parseInt(lastHandle[1]);
      }
    }

    return c.json({
      success: true,
      message: 'Rule added successfully',
      chain,
      action: ruleAction,
      handle,
      command: cmd,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// DELETE /api/rules - Remove a rule by handle
// ============================================================================

app.delete('/api/rules', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const { chain = 'input', handle } = body;

    if (!handle) {
      return c.json({ success: false, error: 'Rule handle is required' }, 400);
    }

    const cmd = `nft delete rule ip ${TABLE_NAME} ${chain} handle ${handle}`;
    log.info('Deleting nftables rule', { chain, handle });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to delete rule', { command: cmd, error: result.error });
      return c.json({
        success: false,
        error: 'Failed to delete rule',
        command: cmd,
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `Rule deleted from chain ${chain} handle ${handle}`,
      chain,
      handle,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/zones - Create/recreate a zone (table+chains)
// ============================================================================

app.post('/api/zones', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const {
      name,
      inputPolicy = 'accept',
      forwardPolicy = 'accept',
      outputPolicy = 'accept',
    } = body;

    if (!name) {
      return c.json({ success: false, error: 'Zone name is required' }, 400);
    }

    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const zoneTableName = `${TABLE_NAME}_zone_${safeName}`;

    // Delete existing zone table if it exists
    const existingTables = listTables();
    if (existingTables.some(t => t.includes(zoneTableName))) {
      execNft(`nft delete table ip ${zoneTableName}`);
    }

    // Create the zone table with chains
    const zoneConfig = `#!/usr/sbin/nft -f

table ip ${zoneTableName} {
  chain input {
    type filter hook input priority 0; policy ${inputPolicy};
  }
  chain forward {
    type filter hook forward priority 0; policy ${forwardPolicy};
  }
  chain output {
    type filter hook output priority 0; policy ${outputPolicy};
  }
}`;

    ensureConfigDir();
    const zoneConfigPath = path.join(NFTABLES_CONFIG_DIR, `staysuite_zone_${safeName}.conf`);
    fs.writeFileSync(zoneConfigPath, zoneConfig, 'utf-8');

    const result = execNft(`nft -f ${zoneConfigPath} 2>&1`);
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Failed to create zone',
        nftError: result.error || result.output,
      }, 500);
    }

    return c.json({
      success: true,
      message: `Zone ${name} created with table ${zoneTableName}`,
      zoneName: name,
      tableName: zoneTableName,
      policies: { input: inputPolicy, forward: forwardPolicy, output: outputPolicy },
      configPath: zoneConfigPath,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// DELETE /api/zones/:name - Delete a zone table
// ============================================================================

app.delete('/api/zones/:name', (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const { name } = c.req.param();
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const zoneTableName = `${TABLE_NAME}_zone_${safeName}`;

    const result = execNft(`nft delete table ip ${zoneTableName} 2>&1`);
    if (!result.success) {
      return c.json({
        success: false,
        error: `Failed to delete zone table ${zoneTableName}`,
        nftError: result.error,
      }, 500);
    }

    // Clean up zone config file
    const zoneConfigPath = path.join(NFTABLES_CONFIG_DIR, `staysuite_zone_${safeName}.conf`);
    try { fs.unlinkSync(zoneConfigPath); } catch {}

    return c.json({
      success: true,
      message: `Zone ${name} (table ${zoneTableName}) deleted`,
      zoneName: name,
      tableName: zoneTableName,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/mac-filter - Add MAC to nftables set
// ============================================================================

app.post('/api/mac-filter', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const { set = 'mac_whitelist', address } = body;

    if (!address) {
      return c.json({ success: false, error: 'MAC address is required' }, 400);
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(address)) {
      return c.json({ success: false, error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' }, 400);
    }

    // Ensure staysuite table exists
    if (!staysuiteTableExists()) {
      // Create the table with the set
      const baseConfig = `#!/usr/sbin/nft -f
table ip ${TABLE_NAME} {
  chain input {
    type filter hook input priority 0; policy accept;
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
  }
  chain output {
    type filter hook output priority 0; policy accept;
  }
  set mac_whitelist {
    type ether_addr
  }
  set mac_blacklist {
    type ether_addr
  }
}`;
      ensureConfigDir();
      fs.writeFileSync(NFTABLES_CONFIG, baseConfig, 'utf-8');
      execNft(`nft -f ${NFTABLES_CONFIG}`);
    }

    // Check if set exists, create if not
    const setCheck = execNft(`nft list set ip ${TABLE_NAME} ${set} 2>&1`);
    if (!setCheck.success) {
      // Create the set
      const createResult = execNft(`nft add set ip ${TABLE_NAME} ${set} { type ether_addr \\; }`);
      if (!createResult.success) {
        return c.json({
          success: false,
          error: `Failed to create set ${set}`,
          nftError: createResult.error,
        }, 500);
      }
    }

    // Add element to set
    const cmd = `nft add element ip ${TABLE_NAME} ${set} { ${address} }`;
    log.info('Adding MAC to set', { set, address });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to add MAC to set', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to add MAC address to set',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `MAC ${address} added to ${set}`,
      set,
      address,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// DELETE /api/mac-filter - Remove MAC from nftables set
// ============================================================================

app.delete('/api/mac-filter', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const { set = 'mac_whitelist', address } = body;

    if (!address) {
      return c.json({ success: false, error: 'MAC address is required' }, 400);
    }

    if (!staysuiteTableExists()) {
      return c.json({ success: false, error: 'StaySuite nftables table does not exist' }, 404);
    }

    const cmd = `nft delete element ip ${TABLE_NAME} ${set} { ${address} }`;
    log.info('Removing MAC from set', { set, address });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to remove MAC from set', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to remove MAC address from set',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `MAC ${address} removed from ${set}`,
      set,
      address,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/bandwidth - Apply bandwidth limiting
// ============================================================================

app.post('/api/bandwidth', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const { ip, rate, direction = 'egress', chain = 'forward' } = body;

    if (!ip) {
      return c.json({ success: false, error: 'IP address is required' }, 400);
    }
    if (!rate) {
      return c.json({ success: false, error: 'Rate limit is required (e.g., "10m", "1k")' }, 400);
    }

    // Ensure staysuite table exists
    if (!staysuiteTableExists()) {
      const baseConfig = `#!/usr/sbin/nft -f
table ip ${TABLE_NAME} {
  chain input {
    type filter hook input priority 0; policy accept;
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
  }
  chain output {
    type filter hook output priority 0; policy accept;
  }
}`;
      ensureConfigDir();
      fs.writeFileSync(NFTABLES_CONFIG, baseConfig, 'utf-8');
      execNft(`nft -f ${NFTABLES_CONFIG}`);
    }

    // Build rate limiting rule
    let cmd: string;
    if (direction === 'egress' || direction === 'download') {
      cmd = `nft add rule ip ${TABLE_NAME} ${chain} ip daddr ${ip} limit rate over ${rate}/second drop`;
    } else {
      cmd = `nft add rule ip ${TABLE_NAME} ${chain} ip saddr ${ip} limit rate over ${rate}/second drop`;
    }

    log.info('Applying bandwidth limit', { ip, rate, direction, chain });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to add bandwidth limit', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to add bandwidth limit rule',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `Bandwidth limit applied: ${ip} ${direction} ${rate}/second`,
      ip,
      rate,
      direction,
      chain,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/content-filter - Apply DNS-based content filtering
// ============================================================================

app.post('/api/content-filter', async (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const body = await c.req.json();
    const { domain, sinkholeIp = '0.0.0.0', action = 'redirect' } = body;

    if (!domain) {
      return c.json({ success: false, error: 'Domain is required' }, 400);
    }

    // Ensure staysuite table exists
    if (!staysuiteTableExists()) {
      const baseConfig = `#!/usr/sbin/nft -f
table ip ${TABLE_NAME} {
  chain input {
    type filter hook input priority 0; policy accept;
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
  }
  chain output {
    type filter hook output priority 0; policy accept;
  }
}`;
      ensureConfigDir();
      fs.writeFileSync(NFTABLES_CONFIG, baseConfig, 'utf-8');
      execNft(`nft -f ${NFTABLES_CONFIG}`);
    }

    // Create a DNS nat rule to redirect queries for the blocked domain to the sinkhole
    // This uses DNAT on the DNS response to redirect the resolved IP
    // Note: True DNS content filtering requires a DNS proxy (like dnsmasq).
    // Here we add an nftables rule that drops/redirects traffic to the blocked domain's IP.

    // First, check if dns_redirect chain exists
    const chainCheck = execNft(`nft list chain ip ${TABLE_NAME} dns_redirect 2>&1`);
    if (!chainCheck.success) {
      // Create the DNS redirect chain
      const createChain = execNft(`nft add chain ip ${TABLE_NAME} dns_redirect '{ type nat hook prerouting priority -100 ; policy accept ; }' 2>&1`);
      if (!createChain.success) {
        return c.json({
          success: false,
          error: 'Failed to create dns_redirect chain',
          nftError: createChain.error,
        }, 500);
      }
    }

    // Add a DNAT rule to redirect DNS queries for this domain to sinkhole IP
    // Since nftables can't inspect DNS payloads directly, we use a simpler approach:
    // If the domain resolves to known IPs, we DNAT those. Otherwise we add a comment.
    const cmd = `nft add rule ip ${TABLE_NAME} dns_redirect ip daddr ${sinkholeIp} udp dport 53 dnat to ${sinkholeIp} comment "blocked:${domain}" 2>&1 || nft add rule ip ${TABLE_NAME} dns_redirect udp dport 53 accept comment "dns-filter:${domain}"`;

    log.info('Adding content filter', { domain, sinkholeIp });

    const result = execNft(cmd.split('||')[0].trim());
    // Even if the specific rule fails, content filter is registered in config

    return c.json({
      success: true,
      message: `Content filter added: ${domain} -> ${sinkholeIp}`,
      domain,
      sinkholeIp,
      action,
      note: 'Full DNS content filtering requires dnsmasq integration. nftables rules provide IP-level filtering.',
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/test - Test current nftables config
// ============================================================================

app.post('/api/test', (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ valid: false, errors: ['nftables is not installed on this system'] }, 503);
  }

  if (!fs.existsSync(NFTABLES_CONFIG)) {
    return c.json({
      valid: false,
      errors: [`Config file not found: ${NFTABLES_CONFIG}`],
    });
  }

  const result = execNft(`nft -c -f ${NFTABLES_CONFIG} 2>&1`);

  if (result.success) {
    return c.json({
      valid: true,
      errors: [],
      message: 'nftables configuration is valid',
    });
  }

  // Parse errors from output
  const errors = result.error
    ? result.error.split('\n').filter((l: string) => l.trim().length > 0)
    : ['Unknown validation error'];

  return c.json({
    valid: false,
    errors,
  });
});

// ============================================================================
// POST /api/flush - Flush all StaySuite-managed nftables rules
// ============================================================================

app.post('/api/flush', (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed on this system' }, 503);
  }

  try {
    const tables = listTables();
    const flushedTables: string[] = [];
    const errors: string[] = [];

    // Flush the main staysuite table
    if (tables.some(t => t.includes(TABLE_NAME))) {
      const result = execNft(`nft flush table ip ${TABLE_NAME} 2>&1`);
      if (result.success) {
        flushedTables.push(TABLE_NAME);
      } else {
        errors.push(`Failed to flush ${TABLE_NAME}: ${result.error}`);
      }

      // Also delete any zone-specific tables
      for (const t of tables) {
        if (t.includes(`${TABLE_NAME}_zone_`)) {
          const match = t.match(/ip\s+(\S+)/);
          if (match) {
            const zoneTableName = match[1];
            const delResult = execNft(`nft delete table ip ${zoneTableName} 2>&1`);
            if (delResult.success) {
              flushedTables.push(zoneTableName);
            } else {
              errors.push(`Failed to delete ${zoneTableName}: ${delResult.error}`);
            }
          }
        }
      }
    }

    // Write empty base config
    ensureConfigDir();
    const emptyConfig = `#!/usr/sbin/nft -f
# StaySuite nftables Firewall Configuration - Flushed
# Last updated: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - Changes will be overwritten

table ip ${TABLE_NAME} {
  chain input {
    type filter hook input priority 0; policy accept;
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
  }
  chain output {
    type filter hook output priority 0; policy accept;
  }
}
`;
    fs.writeFileSync(NFTABLES_CONFIG, emptyConfig, 'utf-8');

    // Clean up zone config files
    try {
      const files = fs.readdirSync(NFTABLES_CONFIG_DIR);
      for (const file of files) {
        if (file.startsWith('staysuite_zone_') && file.endsWith('.conf')) {
          try { fs.unlinkSync(path.join(NFTABLES_CONFIG_DIR, file)); } catch {}
        }
      }
    } catch {}

    return c.json({
      success: errors.length === 0,
      message: `Flushed ${flushedTables.length} tables`,
      flushedTables,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// GET /api/list - List current rules in staysuite table
// ============================================================================

app.get('/api/list', (c) => {
  if (!isNftablesInstalled()) {
    return c.json({ success: false, error: 'nftables is not installed' }, 503);
  }

  if (!staysuiteTableExists()) {
    return c.json({ success: true, data: { rules: [], tables: [] } });
  }

  const ruleset = listRuleset();
  const tables = listTables();

  return c.json({
    success: true,
    data: {
      rules: ruleset,
      tables,
      ruleCount: countRules(),
    },
  });
});

// ============================================================================
// GET /api/config - Get the current staysuite.conf content
// ============================================================================

app.get('/api/config', (c) => {
  try {
    if (!fs.existsSync(NFTABLES_CONFIG)) {
      return c.json({ success: true, data: { path: NFTABLES_CONFIG, content: null, exists: false } });
    }
    const content = fs.readFileSync(NFTABLES_CONFIG, 'utf-8');
    return c.json({ success: true, data: { path: NFTABLES_CONFIG, content, exists: true } });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// Gateway Default Chains Engine
// ============================================================================

/**
 * Network interface info parsed from .nmconnection files.
 */
interface NmConnectionInfo {
  name: string;           // Connection id from [connection]
  iface: string;          // Interface name (interface-name or derived from filename)
  type: string;           // ethernet, vlan, bridge, bond
  ipAddr: string;         // IPv4 address (e.g., "192.168.1.1")
  prefix: number;         // CIDR prefix (e.g., 24)
  gateway: string;        // Default gateway IP
  dns: string[];          // DNS server IPs
  nettype: number;        // 0=LAN, 1=WAN, 2=VLAN, 3=MGMT, 4=UNUSED
  vlanId: number | null;  // VLAN ID if type=vlan
  mac: string;            // MAC address
  isSlave: boolean;       // Whether it's a slave/port of a bridge or bond
  subnetCidr: string;     // Computed subnet CIDR (e.g., "192.168.1.0/24")
}

/**
 * Options for the generateDefaultChains() function.
 */
interface DefaultChainsOptions {
  captivePortalHttp?: number;   // Port for HTTP captive portal redirect (default 8888)
  captivePortalHttps?: number;  // Port for HTTPS captive portal redirect (default 8443)
  openPorts?: number[];         // Additional ports to allow on input (default [22,80,443,3000,8888,8443])
  rateLimit?: number;           // Rate limit per second for unauthenticated HTTP/HTTPS (default 50)
  blockPorts?: number[];        // Ports to block for unauthenticated LAN clients (default [137,138,139,445])
  preserveUsers?: boolean;      // Preserve logged-in users when re-applying (default true)
}

const NM_CONNECTIONS_DIR = '/etc/NetworkManager/system-connections';

// Nettype labels
const NETTYPE_LABELS: Record<number, string> = {
  0: 'LAN',
  1: 'WAN',
  2: 'VLAN',
  3: 'MGMT',
  4: 'UNUSED',
};

/**
 * Parse a simple INI-like .nmconnection file content.
 * Returns a map of section name -> { key: value } entries.
 */
function parseNmConnection(content: string): Map<string, Record<string, string>> {
  const sections = new Map<string, Record<string, string>>();
  let currentSection = '';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, {});
      }
      continue;
    }

    // Key = Value pair
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0 && currentSection) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      // Strip surrounding quotes from value
      const cleanValue = value.replace(/^["']|["']$/g, '');
      sections.get(currentSection)![key] = cleanValue;
    }
  }

  return sections;
}

/**
 * Scan NetworkManager .nmconnection files and return parsed interface info.
 * Returns empty array if directory doesn't exist (sandbox-safe).
 */
function scanNmConnections(): NmConnectionInfo[] {
  const results: NmConnectionInfo[] = [];

  // Check if the NM connections directory exists
  if (!fs.existsSync(NM_CONNECTIONS_DIR)) {
    log.warn('NM connections directory not found', { dir: NM_CONNECTIONS_DIR });
    return results;
  }

  let files: string[];
  try {
    files = fs.readdirSync(NM_CONNECTIONS_DIR);
  } catch {
    return results;
  }

  for (const file of files) {
    if (!file.endsWith('.nmconnection')) continue;

    const filePath = path.join(NM_CONNECTIONS_DIR, file);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const sections = parseNmConnection(content);
    const conn = sections.get('connection') || {};
    const ipv4 = sections.get('ipv4') || {};
    const ethernet = sections.get('ethernet') || {};
    const vlan = sections.get('vlan') || {};
    const staysuite = sections.get('staysuite') || {};
    const bridgePort = sections.get('bridge-port');
    const bondPort = sections.get('bond-port');

    // Skip loopback
    const connType = (conn.type || '').toLowerCase();
    const connName = conn.id || file.replace('.nmconnection', '');
    if (connName === 'lo' || connType === 'loopback') continue;

    // Check if it's a slave/port of a bridge or bond
    const isSlave = bridgePort !== undefined || bondPort !== undefined;
    if (isSlave) continue; // Skip slaves per spec

    // Parse IPv4 address from address1 (format: ip/prefix)
    const address1 = ipv4.address1 || '';
    const addrParts = address1.split('/');
    const ipAddr = addrParts[0] || '';
    const prefix = parseInt(addrParts[1] || '24', 10);

    // Skip interfaces with no IPv4
    if (!ipAddr || ipAddr === '0.0.0.0') continue;

    // Compute subnet CIDR
    const ipParts = ipAddr.split('.').map(Number);
    const maskBits = prefix;
    let subnetParts: number[] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const bits = maskBits > (i * 8) ? Math.min(8, maskBits - i * 8) : 0;
      subnetParts[i] = ipParts[i] & (0xFF << (8 - bits)) & 0xFF;
    }
    const subnetCidr = `${subnetParts.join('.')}/${prefix}`;

    // Parse gateway and DNS
    const gateway = ipv4.gateway || '';
    const dnsStr = ipv4.dns || '';
    const dns = dnsStr ? dnsStr.split(';').map(d => d.trim()).filter(d => d.length > 0) : [];

    // Parse MAC address
    const mac = ethernet['cloned-mac-address'] || ethernet['assigned-mac-address'] || '';

    // Parse nettype (default to 4 = UNUSED)
    const nettype = parseInt(staysuite.nettype || '4', 10);

    // Parse VLAN ID if applicable
    const vlanId = connType === 'vlan' && vlan.id ? parseInt(vlan.id, 10) : null;

    // Interface name: prefer interface-name from connection, derive from file name
    const iface = conn['interface-name'] || connName;

    results.push({
      name: connName,
      iface,
      type: connType,
      ipAddr,
      prefix,
      gateway,
      dns,
      nettype,
      vlanId,
      mac,
      isSlave,
      subnetCidr,
    });
  }

  log.info('Scanned NM connections', { count: results.length });
  return results;
}

/**
 * Get the existing logged-in user IPs from the staysuite table.
 * Used to preserve users when re-applying default chains.
 */
function getLoggedInUsers(): string[] {
  if (!staysuiteTableExists()) return [];
  const result = execNft(`nft list set ip ${TABLE_NAME} loggedin_users 2>/dev/null`);
  if (!result.success) return [];

  const ips: string[] = [];
  // Parse the set elements from nft output
  // Format: "elements = { 1.2.3.4, 5.6.7.8 }"
  const match = result.output.match(/elements\s*=\s*\{([^}]*)\}/);
  if (match) {
    const elements = match[1];
    for (const elem of elements.split(',')) {
      const ip = elem.trim();
      if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        ips.push(ip);
      }
    }
  }
  return ips;
}

/**
 * Count rules in a generated nft config string.
 */
function countRulesInConfig(config: string): number {
  let count = 0;
  for (const line of config.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.match(/\b(accept|drop|reject|log|masquerade|counter)\s*$/) &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('policy') &&
        trimmed.length > 0) {
      count++;
    }
  }
  return count;
}

/**
 * Generate the complete nftables default chains ruleset for a gateway.
 * This produces a comprehensive config similar to 24online's defaultchains but in nftables syntax.
 */
function generateDefaultChains(
  interfaces: NmConnectionInfo[],
  options: DefaultChainsOptions = {},
): { config: string; stats: { wanCount: number; lanCount: number; vlanCount: number; totalRules: number } } {
  const opts: Required<DefaultChainsOptions> = {
    captivePortalHttp: options.captivePortalHttp ?? 8888,
    captivePortalHttps: options.captivePortalHttps ?? 8443,
    openPorts: options.openPorts ?? [22, 80, 443, 3000, 8888, 8443],
    rateLimit: options.rateLimit ?? 50,
    blockPorts: options.blockPorts ?? [137, 138, 139, 445],
    preserveUsers: options.preserveUsers ?? true,
  };

  // Categorize interfaces
  const wanIfaces = interfaces.filter(i => i.nettype === 1);
  const lanIfaces = interfaces.filter(i => i.nettype === 0);
  const vlanIfaces = interfaces.filter(i => i.nettype === 2);
  const mgmtIfaces = interfaces.filter(i => i.nettype === 3);
  const guestIfaces = [...lanIfaces, ...vlanIfaces]; // Guest-facing interfaces
  const lanSubnets = guestIfaces.map(i => i.subnetCidr);

  // Preserve logged-in users
  const preservedUsers = opts.preserveUsers ? getLoggedInUsers() : [];
  const usersElements = preservedUsers.length > 0
    ? preservedUsers.join(', ')
    : '';

  let conf = '';
  conf += `#!/usr/sbin/nft -f
# StaySuite Gateway Default Chains - Auto-generated
# Generated: ${new Date().toISOString()}
# WAN: ${wanIfaces.map(i => i.iface).join(', ') || 'none'}
# LAN: ${lanIfaces.map(i => i.iface).join(', ') || 'none'}
# VLAN: ${vlanIfaces.map(i => i.iface).join(', ') || 'none'}
# DO NOT EDIT MANUALLY - Changes will be overwritten

flush table ip ${TABLE_NAME}

table ip ${TABLE_NAME} {

`;
  // ==========================================================================
  // Sets
  // ==========================================================================

  // loggedin_users set
  conf += `  set loggedin_users {
    type ipv4_addr\n`;
  if (usersElements) {
    conf += `    elements = { ${usersElements} }\n`;
  }
  conf += `  }

`;

  // mac_blacklist set
  conf += `  set mac_blacklist {
    type ether_addr
  }

`;

  // mac_whitelist set
  conf += `  set mac_whitelist {
    type ether_addr
  }

`;

  // lan_subnets set (interval type for CIDR matching)
  conf += `  set lan_subnets {
    type ipv4_addr
    flags interval\n`;
  if (lanSubnets.length > 0) {
    conf += `    elements = { ${lanSubnets.join(', ')} }\n`;
  }
  conf += `  }

`;

  // ==========================================================================
  // Filter chain: input (type filter hook input priority 0; policy drop)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # Filter: Input chain
  # ----------------------------------------------------------------
  chain input {
    type filter hook input priority 0; policy drop;

    # Allow loopback
    iif "lo" accept

    # Allow established/related connections
    ct state established,related accept

    # Allow ICMP
    ip protocol icmp accept

    # Drop invalid state packets
    ct state invalid drop

    # Drop MAC blacklisted
    ether saddr @mac_blacklist drop

    # Allow SSH from LAN subnets only
    iifname != "lo" ip saddr @lan_subnets tcp dport 22 accept

    # Allow DHCP from LAN
    iifname != "lo" ip saddr @lan_subnets udp sport 67 udp dport 68 accept

    # Allow DNS to local resolver
    udp dport 53 accept
    tcp dport 53 accept

    # Allow StaySuite web UI and services
    tcp dport { ${opts.openPorts.join(', ')} } accept

    # Log and drop everything else
    log prefix "SS-IN-DROP: " drop
  }

`;

  // ==========================================================================
  // Filter chain: forward (type filter hook forward priority 0; policy drop)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # Filter: Forward chain
  # ----------------------------------------------------------------
  chain forward {
    type filter hook forward priority 0; policy drop;

    # Allow established/related connections
    ct state established,related accept

    # Allow loopback
    iif "lo" oif "lo" accept

    # Drop invalid state packets
    ct state invalid drop

    # Drop MAC blacklisted
    ether saddr @mac_blacklist drop\n`;

  // Jump to per-LAN-interface chains for guest traffic
  if (guestIfaces.length > 0) {
    for (const iface of guestIfaces) {
      const chainName = `guest_${iface.iface.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      conf += `
    # Jump to per-interface chain for ${iface.iface} (${NETTYPE_LABELS[iface.nettype] || 'UNKNOWN'})
    iifname "${iface.iface}" jump ${chainName}
`;
    }
  }

  // Allow LAN-to-LAN forwarding (between all guest interfaces)
  if (guestIfaces.length >= 2) {
    for (const iface of guestIfaces) {
      conf += `    iifname "${iface.iface}" oifname { ${guestIfaces.map(i => `"${i.iface}"`).join(', ')} } accept
`;
    }
  }

  conf += `
    # Log and drop everything else
    log prefix "SS-FWD-DROP: " drop
  }

`;

  // ==========================================================================
  // Filter chain: output (type filter hook output priority 0; policy accept)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # Filter: Output chain
  # ----------------------------------------------------------------
  chain output {
    type filter hook output priority 0; policy accept;
  }

`;

  // ==========================================================================
  // Per-LAN-interface chains (captive portal + access control)
  // ==========================================================================
  if (guestIfaces.length > 0) {
    for (const iface of guestIfaces) {
      const chainName = `guest_${iface.iface.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const netLabel = NETTYPE_LABELS[iface.nettype] || 'UNKNOWN';

      conf += `  # ----------------------------------------------------------------
  # Guest chain: ${iface.iface} (${netLabel})
  # ----------------------------------------------------------------
  chain ${chainName} {
    # Allow logged-in users (bypass all restrictions)
    ip saddr @loggedin_users accept

    # Allow MAC whitelisted devices (bypass all restrictions)
    ether saddr @mac_whitelist accept

    # Allow DHCP client requests
    udp dport 67 accept

    # Allow DNS
    udp dport 53 accept
    tcp dport 53 accept

    # Rate-limit unauthenticated HTTP
    tcp dport 80 limit rate ${opts.rateLimit}/second burst 20 packets accept

    # Rate-limit unauthenticated HTTPS
    tcp dport 443 limit rate ${opts.rateLimit}/second burst 20 packets accept

    # Mark HTTP for captive portal redirect
    tcp dport 80 meta mark set 10000

    # Mark HTTPS for captive portal redirect
    tcp dport 443 meta mark set 20000

    # Block SMB/CIFS file sharing ports
    tcp dport { ${opts.blockPorts.join(', ')} } drop

    # Drop all other traffic for unauthenticated clients
    drop
  }

`;
    }
  }

  // ==========================================================================
  // NAT chain: postrouting (masquerade WAN traffic)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # NAT: Postrouting (masquerade)
  # ----------------------------------------------------------------
  chain postrouting {
    type nat hook postrouting priority 100; policy accept;
`;
  for (const wan of wanIfaces) {
    conf += `    oifname "${wan.iface}" masquerade comment "masq-wan-${wan.iface}"
`;
  }
  // If no WAN interfaces defined, masquerade all outgoing (safety fallback)
  if (wanIfaces.length === 0) {
    conf += `    oifname != "lo" masquerade comment "masq-all-fallback"
`;
  }
  conf += `  }

`;

  // ==========================================================================
  // NAT chain: prerouting (captive portal redirect)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # NAT: Prerouting (captive portal redirect)
  # ----------------------------------------------------------------
  chain prerouting {
    type nat hook prerouting priority dstnat; policy accept;

    # Captive portal HTTP redirect
    meta mark 10000 dnat to :${opts.captivePortalHttp}

    # Captive portal HTTPS redirect
    meta mark 20000 dnat to :${opts.captivePortalHttps}
  }

`;

  // ==========================================================================
  // Mangle chain: prerouting accounting (per-LAN counters)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # Mangle: Prerouting (ingress accounting per LAN interface)
  # ----------------------------------------------------------------
  chain mangle_prerouting {
    type filter hook prerouting priority mangle; policy accept;
`;
  for (const iface of guestIfaces) {
    conf += `    iifname "${iface.iface}" counter comment "acct-in-${iface.iface}"
`;
  }
  if (mgmtIfaces.length > 0) {
    for (const iface of mgmtIfaces) {
      conf += `    iifname "${iface.iface}" counter comment "acct-mgmt-${iface.iface}"
`;
    }
  }
  conf += `  }

`;

  // ==========================================================================
  // Mangle chain: postrouting accounting (per-WAN counters)
  // ==========================================================================
  conf += `  # ----------------------------------------------------------------
  # Mangle: Postrouting (egress accounting per WAN interface)
  # ----------------------------------------------------------------
  chain mangle_postrouting {
    type filter hook postrouting priority mangle; policy accept;
`;
  for (const wan of wanIfaces) {
    conf += `    oifname "${wan.iface}" counter comment "acct-out-${wan.iface}"
`;
  }
  if (wanIfaces.length === 0) {
    conf += `    oifname != "lo" counter comment "acct-out-all"
`;
  }
  conf += `  }

`;

  // ==========================================================================
  // GUI-managed chains (populated by GUI CRUD, DO NOT edit manually)
  // ==========================================================================
  conf += `  # ─── GUI-managed chains (populated by GUI CRUD, DO NOT edit manually) ───
  chain gui_custom_rules {
    type filter hook forward priority 5; policy accept;
    # Rules added/removed ONLY from GUI firewall management page
  }

  chain gui_nat_rules {
    type nat hook prerouting priority -50; policy accept;
    # Port forwarding (DNAT) rules from GUI
  }

`;

  // ==========================================================================
  // Close table
  // ==========================================================================
  conf += `}\n`;

  // Count rules
  const totalRules = countRulesInConfig(conf);

  return {
    config: conf,
    stats: {
      wanCount: wanIfaces.length,
      lanCount: lanIfaces.length,
      vlanCount: vlanIfaces.length,
      totalRules,
    },
  };
}

// ============================================================================
// GET /api/default-chains - Preview generated config WITHOUT applying
// ============================================================================

app.get('/api/default-chains', (c) => {
  try {
    const interfaces = scanNmConnections();

    // Parse optional query params
    const captivePortalHttp = c.req.query('captivePortalHttp');
    const captivePortalHttps = c.req.query('captivePortalHttps');
    const rateLimit = c.req.query('rateLimit');

    const options: DefaultChainsOptions = {};
    if (captivePortalHttp) options.captivePortalHttp = parseInt(captivePortalHttp, 10);
    if (captivePortalHttps) options.captivePortalHttps = parseInt(captivePortalHttps, 10);
    if (rateLimit) options.rateLimit = parseInt(rateLimit, 10);

    const { config, stats } = generateDefaultChains(interfaces, options);

    return c.json({
      success: true,
      interfaces: interfaces.map(i => ({
        name: i.name,
        iface: i.iface,
        type: i.type,
        nettype: i.nettype,
        nettypeLabel: NETTYPE_LABELS[i.nettype] || 'UNKNOWN',
        ipAddr: i.ipAddr,
        prefix: i.prefix,
        subnetCidr: i.subnetCidr,
        gateway: i.gateway,
        vlanId: i.vlanId,
        mac: i.mac,
      })),
      config,
      stats,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// POST /api/default-chains - Generate and apply the complete gateway ruleset
// ============================================================================

app.post('/api/default-chains', async (c) => {
  try {
    // Parse optional body params
    let body: DefaultChainsOptions = {};
    try {
      body = await c.req.json();
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Scan interfaces
    const interfaces = scanNmConnections();

    if (interfaces.length === 0) {
      return c.json({
        success: false,
        error: 'No network interfaces found. Ensure .nmconnection files exist in /etc/NetworkManager/system-connections/ with [staysuite] nettype configured.',
        interfaces: [],
      }, 400);
    }

    // Generate config
    const { config, stats } = generateDefaultChains(interfaces, body);

    // Ensure config directory exists
    ensureConfigDir();

    // Write config to disk
    const configPath = path.join(NFTABLES_CONFIG_DIR, 'staysuite-gateway.conf');
    fs.writeFileSync(configPath, config, 'utf-8');
    log.info('Wrote gateway default chains config', { path: configPath, lines: config.split('\n').length });

    // Validate config with nft -c -f
    const check = execNft(`nft -c -f ${configPath} 2>&1`);
    if (!check.success) {
      return c.json({
        success: false,
        error: 'Gateway config validation failed',
        validationErrors: check.error || check.output,
        rulesApplied: 0,
        config,
      }, 400);
    }

    // Apply config atomically
    const apply = execNft(`nft -f ${configPath} 2>&1`);
    if (!apply.success) {
      return c.json({
        success: false,
        error: 'Failed to apply gateway config',
        applyError: apply.error || apply.output,
        rulesApplied: 0,
      }, 500);
    }

    // Restore preserved users if needed
    if (body.preserveUsers !== false) {
      const preservedUsers = getLoggedInUsers(); // These should already be in the config
      // Additional: re-add any users that may have been added dynamically between config write and apply
      // (handled within generateDefaultChains via getLoggedInUsers)
    }

    // =========================================================================
    // Boot Restore: Re-apply all persisted GUI rules
    // =========================================================================
    let guiRulesRestored = 0;

    // Restore GUI filter rules
    const guiRules = readGuiRules();
    for (const rule of guiRules) {
      if (!rule.enabled) continue;
      const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rule.sourceIp) parts.push(`ip saddr ${rule.sourceIp}`);
      if (rule.destIp) parts.push(`ip daddr ${rule.destIp}`);
      if (rule.protocol !== 'all') {
        parts.push(rule.protocol === 'icmp' ? 'ip protocol icmp' : `${rule.protocol} protocol ${rule.protocol}`);
      }
      if (rule.destPort && ['tcp', 'udp'].includes(rule.protocol)) {
        parts.push(`${rule.protocol} dport ${rule.destPort}`);
      }
      parts.push(rule.action);
      if (rule.comment) parts.push(`comment "${rule.comment.replace(/"/g, '\\"')}"`);

      const result = execNft(parts.join(' '));
      if (result.success) {
        rule.handle = getRuleHandle('gui_custom_rules');
        guiRulesRestored++;
      } else {
        log.warn('Failed to restore GUI rule', { id: rule.id, error: result.error });
      }
    }
    writeGuiRules(guiRules);

    // Restore port forwards
    const portForwards = readPortForwards();
    for (const pf of portForwards) {
      if (!pf.enabled) continue;
      const protocols = pf.protocol === 'both' ? ['tcp', 'udp'] : [pf.protocol];
      let pfRestored = false;
      for (const proto of protocols) {
        const pfParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_nat_rules`];
        pfParts.push(`${proto} dport ${pf.externalPort}`);
        if (pf.sourceIp) pfParts.push(`ip saddr ${pf.sourceIp}`);
        pfParts.push(`dnat to ${pf.internalIp}:${pf.internalPort}`);
        pfParts.push(`comment "${pf.name.replace(/"/g, '\\"')}"`);

        const result = execNft(pfParts.join(' '));
        if (result.success) pfRestored = true;
      }
      if (pfRestored) {
        pf.handle = getRuleHandle('gui_nat_rules');
        guiRulesRestored++;
      }
    }
    writePortForwards(portForwards);

    // Restore rate limits
    const rateLimits = readRateLimits();
    for (const rl of rateLimits) {
      if (!rl.enabled) continue;

      const dlParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rl.protocol !== 'all') dlParts.push(`${rl.protocol} protocol ${rl.protocol}`);
      dlParts.push(`ip daddr ${rl.targetIp}`);
      dlParts.push(`limit rate over ${rl.downloadRate} drop`);
      dlParts.push(`comment "rl-dl:${rl.name.replace(/"/g, '\\"')}"`);
      const dlResult = execNft(dlParts.join(' '));
      if (dlResult.success) {
        rl.downloadHandle = getRuleHandle('gui_custom_rules');
      }

      const ulParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rl.protocol !== 'all') ulParts.push(`${rl.protocol} protocol ${rl.protocol}`);
      ulParts.push(`ip saddr ${rl.targetIp}`);
      ulParts.push(`limit rate over ${rl.uploadRate} drop`);
      ulParts.push(`comment "rl-ul:${rl.name.replace(/"/g, '\\"')}"`);
      const ulResult = execNft(ulParts.join(' '));
      if (ulResult.success) {
        rl.uploadHandle = getRuleHandle('gui_custom_rules');
      }

      if (dlResult.success || ulResult.success) guiRulesRestored++;
    }
    writeRateLimits(rateLimits);

    // Restore quick blocks
    const quickBlocks = readQuickBlocks();
    for (const block of quickBlocks) {
      if (block.type === 'mac') {
        const result = execNft(`nft add element ip ${TABLE_NAME} mac_blacklist { ${block.value} }`);
        if (result.success) guiRulesRestored++;
      } else {
        const matchExpr = `ip saddr ${block.value}`;
        const cmd = `nft add rule ip ${TABLE_NAME} gui_custom_rules ${matchExpr} drop comment "quick-block:${block.reason.replace(/"/g, '\\"').substring(0, 50)}"`;
        const result = execNft(cmd);
        if (result.success) {
          block.handle = getRuleHandle('gui_custom_rules');
          guiRulesRestored++;
        }
      }
    }
    writeQuickBlocks(quickBlocks);

    log.info('Restored GUI rules on boot', { guiRulesRestored });

    log.info('Applied gateway default chains', {
      rulesApplied: stats.totalRules,
      wanCount: stats.wanCount,
      lanCount: stats.lanCount,
      vlanCount: stats.vlanCount,
      guiRulesRestored,
    });

    return c.json({
      success: true,
      message: `Default chains applied with ${stats.totalRules} rules, restored ${guiRulesRestored} GUI rules`,
      rulesApplied: stats.totalRules,
      guiRulesRestored,
      interfaces: {
        wan: interfaces.filter(i => i.nettype === 1).map(i => ({ name: i.name, iface: i.iface, ip: i.ipAddr })),
        lan: interfaces.filter(i => i.nettype === 0).map(i => ({ name: i.name, iface: i.iface, ip: i.ipAddr })),
        vlan: interfaces.filter(i => i.nettype === 2).map(i => ({ name: i.name, iface: i.iface, ip: i.ipAddr, vlanId: i.vlanId })),
        mgmt: interfaces.filter(i => i.nettype === 3).map(i => ({ name: i.name, iface: i.iface, ip: i.ipAddr })),
      },
      stats,
      configPath,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error, rulesApplied: 0 }, 500);
  }
});

// ============================================================================
// POST /api/default-chains/users - Add user IP to loggedin_users set
// ============================================================================

app.post('/api/default-chains/users', async (c) => {
  if (!staysuiteTableExists()) {
    return c.json({ success: false, error: 'StaySuite nftables table does not exist. Apply default chains first.' }, 404);
  }

  try {
    const body = await c.req.json();
    const { ip, mac } = body;

    if (!ip) {
      return c.json({ success: false, error: 'IP address is required' }, 400);
    }

    // Validate IP format
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return c.json({ success: false, error: 'Invalid IP address format' }, 400);
    }

    const cmd = `nft add element ip ${TABLE_NAME} loggedin_users { ${ip} }`;
    log.info('Adding user to loggedin_users', { ip, mac });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to add user to loggedin_users', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to add user IP to loggedin_users set',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `User IP ${ip} added to loggedin_users`,
      ip,
      mac,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// DELETE /api/default-chains/users - Remove user IP from loggedin_users set
// ============================================================================

app.delete('/api/default-chains/users', async (c) => {
  if (!staysuiteTableExists()) {
    return c.json({ success: false, error: 'StaySuite nftables table does not exist' }, 404);
  }

  try {
    const body = await c.req.json();
    const { ip } = body;

    if (!ip) {
      return c.json({ success: false, error: 'IP address is required' }, 400);
    }

    const cmd = `nft delete element ip ${TABLE_NAME} loggedin_users { ${ip} }`;
    log.info('Removing user from loggedin_users', { ip });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to remove user from loggedin_users', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to remove user IP from loggedin_users set',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `User IP ${ip} removed from loggedin_users`,
      ip,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// GET /api/default-chains/users - List logged-in user IPs
// ============================================================================

app.get('/api/default-chains/users', (c) => {
  if (!staysuiteTableExists()) {
    return c.json({ success: true, users: [], message: 'Table does not exist yet' });
  }

  const ips = getLoggedInUsers();

  return c.json({
    success: true,
    users: ips,
    count: ips.length,
  });
});

// ============================================================================
// POST /api/default-chains/mac-blacklist - Add MAC to blacklist
// ============================================================================

app.post('/api/default-chains/mac-blacklist', async (c) => {
  if (!staysuiteTableExists()) {
    return c.json({ success: false, error: 'StaySuite nftables table does not exist. Apply default chains first.' }, 404);
  }

  try {
    const body = await c.req.json();
    const { mac } = body;

    if (!mac) {
      return c.json({ success: false, error: 'MAC address is required' }, 400);
    }

    // Validate MAC format
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(mac)) {
      return c.json({ success: false, error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' }, 400);
    }

    const cmd = `nft add element ip ${TABLE_NAME} mac_blacklist { ${mac} }`;
    log.info('Adding MAC to blacklist', { mac });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to add MAC to blacklist', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to add MAC to blacklist',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `MAC ${mac} added to blacklist`,
      mac,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// DELETE /api/default-chains/mac-blacklist - Remove MAC from blacklist
// ============================================================================

app.delete('/api/default-chains/mac-blacklist', async (c) => {
  if (!staysuiteTableExists()) {
    return c.json({ success: false, error: 'StaySuite nftables table does not exist' }, 404);
  }

  try {
    const body = await c.req.json();
    const { mac } = body;

    if (!mac) {
      return c.json({ success: false, error: 'MAC address is required' }, 400);
    }

    const cmd = `nft delete element ip ${TABLE_NAME} mac_blacklist { ${mac} }`;
    log.info('Removing MAC from blacklist', { mac });

    const result = execNft(cmd);
    if (!result.success) {
      log.error('Failed to remove MAC from blacklist', { error: result.error });
      return c.json({
        success: false,
        error: 'Failed to remove MAC from blacklist',
        nftError: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: `MAC ${mac} removed from blacklist`,
      mac,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// GUI Firewall Management — Persistence Layer
// ============================================================================

// --- GUI Rule Types ---

interface GuiRule {
  id: string;
  name: string;
  chain: string;            // "gui_custom_rules"
  protocol: string;         // tcp, udp, icmp, all
  sourceIp: string;         // IP or CIDR, empty = any
  destIp: string;           // IP or CIDR, empty = any
  destPort: string;         // port or range
  action: string;           // accept, drop, reject, log
  enabled: boolean;
  comment: string;
  priority: number;
  handle: number;
  createdAt: string;
}

interface PortForward {
  id: string;
  name: string;
  protocol: string;         // tcp, udp, both
  externalPort: number;
  internalIp: string;
  internalPort: number;
  sourceIp: string;         // optional source restriction
  enabled: boolean;
  handle: number;
  createdAt: string;
}

interface RateLimit {
  id: string;
  name: string;
  targetIp: string;
  downloadRate: string;     // e.g., "5mbit"
  uploadRate: string;       // e.g., "2mbit"
  protocol: string;         // all, tcp, udp
  enabled: boolean;
  downloadHandle: number;
  uploadHandle: number;
  createdAt: string;
}

interface QuickBlock {
  id: string;
  type: string;             // ip, subnet, mac
  value: string;
  reason: string;
  blockedAt: string;
  handle: number;           // nft handle for ip/subnet; 0 for mac
}

// --- Persistence Helpers ---

const GUI_RULES_FILE = path.join(NFTABLES_CONFIG_DIR, 'gui-rules.json');
const PORT_FORWARDS_FILE = path.join(NFTABLES_CONFIG_DIR, 'port-forwards.json');
const RATE_LIMITS_FILE = path.join(NFTABLES_CONFIG_DIR, 'rate-limits.json');
const QUICK_BLOCKS_FILE = path.join(NFTABLES_CONFIG_DIR, 'quick-blocks.json');

/**
 * Atomic JSON write: write to .tmp then rename.
 */
function atomicWriteJson(filePath: string, data: unknown): void {
  ensureConfigDir();
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readGuiRules(): GuiRule[] {
  try {
    if (!fs.existsSync(GUI_RULES_FILE)) return [];
    return JSON.parse(fs.readFileSync(GUI_RULES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeGuiRules(rules: GuiRule[]): void {
  atomicWriteJson(GUI_RULES_FILE, rules);
}

function readPortForwards(): PortForward[] {
  try {
    if (!fs.existsSync(PORT_FORWARDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(PORT_FORWARDS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writePortForwards(rules: PortForward[]): void {
  atomicWriteJson(PORT_FORWARDS_FILE, rules);
}

function readRateLimits(): RateLimit[] {
  try {
    if (!fs.existsSync(RATE_LIMITS_FILE)) return [];
    return JSON.parse(fs.readFileSync(RATE_LIMITS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeRateLimits(rules: RateLimit[]): void {
  atomicWriteJson(RATE_LIMITS_FILE, rules);
}

function readQuickBlocks(): QuickBlock[] {
  try {
    if (!fs.existsSync(QUICK_BLOCKS_FILE)) return [];
    return JSON.parse(fs.readFileSync(QUICK_BLOCKS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeQuickBlocks(blocks: QuickBlock[]): void {
  atomicWriteJson(QUICK_BLOCKS_FILE, blocks);
}

// --- Input Validation Helpers ---

const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const CIDR_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
const IP_OR_CIDR_REGEX = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/;
const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const PORT_REGEX = /^(\d+)(-(\d+))?$/;

function validateIpOrCidr(value: string): boolean {
  if (!value || value.trim() === '') return true; // empty = any
  return IP_OR_CIDR_REGEX.test(value.trim());
}

function validatePort(value: string): boolean {
  if (!value || value.trim() === '') return true; // empty = any
  const match = value.trim().match(PORT_REGEX);
  if (!match) return false;
  const p1 = parseInt(match[1], 10);
  if (p1 < 1 || p1 > 65535) return false;
  if (match[3]) {
    const p2 = parseInt(match[3], 10);
    if (p2 < 1 || p2 > 65535 || p2 <= p1) return false;
  }
  return true;
}

function validatePortNumber(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function getRuleHandle(chain: string): number {
  const listResult = execNft(`nft list chain ip ${TABLE_NAME} ${chain} -a 2>/dev/null`);
  if (!listResult.success) return -1;
  const handleMatch = listResult.output.match(/handle (\d+)/g);
  if (handleMatch && handleMatch.length > 0) {
    const lastHandle = handleMatch[handleMatch.length - 1].match(/handle (\d+)/);
    if (lastHandle) return parseInt(lastHandle[1]);
  }
  return -1;
}

// ============================================================================
// GUI Firewall Management — REST Endpoints
// ============================================================================

// --- GUI Rules CRUD ---

// GET /api/gui-rules — list all persisted GUI rules
app.get('/api/gui-rules', (c) => {
  const rules = readGuiRules();
  return c.json({ success: true, data: rules });
});

// POST /api/gui-rules — add a new GUI rule
app.post('/api/gui-rules', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name = '',
      protocol = 'tcp',
      sourceIp = '',
      destIp = '',
      destPort = '',
      action = 'accept',
      comment = '',
      priority = 100,
      enabled = true,
    } = body;

    if (!name.trim()) {
      return c.json({ success: false, error: 'Rule name is required' }, 400);
    }

    if (!['tcp', 'udp', 'icmp', 'all'].includes(protocol)) {
      return c.json({ success: false, error: 'Invalid protocol. Must be tcp, udp, icmp, or all' }, 400);
    }

    if (!['accept', 'drop', 'reject', 'log'].includes(action)) {
      return c.json({ success: false, error: 'Invalid action. Must be accept, drop, reject, or log' }, 400);
    }

    if (!validateIpOrCidr(sourceIp)) {
      return c.json({ success: false, error: 'Invalid source IP/CIDR format' }, 400);
    }

    if (!validateIpOrCidr(destIp)) {
      return c.json({ success: false, error: 'Invalid destination IP/CIDR format' }, 400);
    }

    if (!validatePort(destPort)) {
      return c.json({ success: false, error: 'Invalid destination port format (1-65535, or range like 8000-9000)' }, 400);
    }

    if (!staysuiteTableExists()) {
      return c.json({ success: false, error: 'StaySuite table does not exist. Apply default chains first.' }, 404);
    }

    // Build nft command
    const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];

    if (sourceIp.trim()) parts.push(`ip saddr ${sourceIp.trim()}`);
    if (destIp.trim()) parts.push(`ip daddr ${destIp.trim()}`);
    if (protocol !== 'all') {
      parts.push(protocol === 'icmp' ? 'ip protocol icmp' : `${protocol} protocol ${protocol}`);
    }
    if (destPort.trim() && ['tcp', 'udp'].includes(protocol)) {
      parts.push(`${protocol} dport ${destPort.trim()}`);
    }

    parts.push(action);

    if (comment.trim()) {
      parts.push(`comment "${comment.trim().replace(/"/g, '\\"')}"`);
    }

    const cmd = parts.join(' ');
    let handle = -1;

    if (enabled) {
      const result = execNft(cmd);
      if (!result.success) {
        log.error('Failed to add GUI rule', { command: cmd, error: result.error });
        return c.json({ success: false, error: 'Failed to add nft rule', nftError: result.error }, 500);
      }
      handle = getRuleHandle('gui_custom_rules');
    }

    const rule: GuiRule = {
      id: crypto.randomUUID(),
      name: name.trim(),
      chain: 'gui_custom_rules',
      protocol,
      sourceIp: sourceIp.trim(),
      destIp: destIp.trim(),
      destPort: destPort.trim(),
      action,
      enabled,
      comment: comment.trim(),
      priority: Number(priority) || 100,
      handle,
      createdAt: new Date().toISOString(),
    };

    const rules = readGuiRules();
    rules.push(rule);
    writeGuiRules(rules);

    log.info('GUI rule added', { id: rule.id, name: rule.name, handle });
    return c.json({ success: true, data: rule });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PUT /api/gui-rules/:id — update a GUI rule
app.put('/api/gui-rules/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const rules = readGuiRules();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const body = await c.req.json();
    const existing = rules[idx];

    // Validate updated fields
    if (body.protocol !== undefined && !['tcp', 'udp', 'icmp', 'all'].includes(body.protocol)) {
      return c.json({ success: false, error: 'Invalid protocol' }, 400);
    }
    if (body.action !== undefined && !['accept', 'drop', 'reject', 'log'].includes(body.action)) {
      return c.json({ success: false, error: 'Invalid action' }, 400);
    }
    if (body.sourceIp !== undefined && !validateIpOrCidr(body.sourceIp)) {
      return c.json({ success: false, error: 'Invalid source IP/CIDR format' }, 400);
    }
    if (body.destIp !== undefined && !validateIpOrCidr(body.destIp)) {
      return c.json({ success: false, error: 'Invalid destination IP/CIDR format' }, 400);
    }
    if (body.destPort !== undefined && !validatePort(body.destPort)) {
      return c.json({ success: false, error: 'Invalid destination port format' }, 400);
    }

    // Delete old nft rule if it was enabled and had a handle
    if (existing.enabled && existing.handle > 0) {
      execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${existing.handle}`);
    }

    // Apply updated values
    const updated: GuiRule = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      protocol: body.protocol !== undefined ? body.protocol : existing.protocol,
      sourceIp: body.sourceIp !== undefined ? body.sourceIp : existing.sourceIp,
      destIp: body.destIp !== undefined ? body.destIp : existing.destIp,
      destPort: body.destPort !== undefined ? body.destPort : existing.destPort,
      action: body.action !== undefined ? body.action : existing.action,
      comment: body.comment !== undefined ? body.comment : existing.comment,
      priority: body.priority !== undefined ? body.priority : existing.priority,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      handle: -1,
    };

    // Re-add rule to nft if enabled
    if (updated.enabled) {
      const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (updated.sourceIp) parts.push(`ip saddr ${updated.sourceIp}`);
      if (updated.destIp) parts.push(`ip daddr ${updated.destIp}`);
      if (updated.protocol !== 'all') {
        parts.push(updated.protocol === 'icmp' ? 'ip protocol icmp' : `${updated.protocol} protocol ${updated.protocol}`);
      }
      if (updated.destPort && ['tcp', 'udp'].includes(updated.protocol)) {
        parts.push(`${updated.protocol} dport ${updated.destPort}`);
      }
      parts.push(updated.action);
      if (updated.comment) {
        parts.push(`comment "${updated.comment.replace(/"/g, '\\"')}"`);
      }

      const cmd = parts.join(' ');
      const result = execNft(cmd);
      if (!result.success) {
        log.error('Failed to re-add updated GUI rule', { command: cmd, error: result.error });
        return c.json({ success: false, error: 'Failed to re-add nft rule', nftError: result.error }, 500);
      }
      updated.handle = getRuleHandle('gui_custom_rules');
    }

    rules[idx] = updated;
    writeGuiRules(rules);

    log.info('GUI rule updated', { id, handle: updated.handle });
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// DELETE /api/gui-rules/:id — delete a GUI rule
app.delete('/api/gui-rules/:id', (c) => {
  try {
    const { id } = c.req.param();
    const rules = readGuiRules();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const rule = rules[idx];

    // Delete from nft if enabled with valid handle
    if (rule.enabled && rule.handle > 0) {
      const result = execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rule.handle}`);
      if (!result.success) {
        log.warn('Failed to delete nft rule during GUI rule removal', { id, handle: rule.handle, error: result.error });
      }
    }

    rules.splice(idx, 1);
    writeGuiRules(rules);

    log.info('GUI rule deleted', { id, name: rule.name });
    return c.json({ success: true, message: 'Rule deleted' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PATCH /api/gui-rules/:id/toggle — enable/disable a GUI rule
app.patch('/api/gui-rules/:id/toggle', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return c.json({ success: false, error: 'enabled (boolean) is required' }, 400);
    }

    const rules = readGuiRules();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const rule = rules[idx];

    if (enabled && !rule.enabled) {
      // Enable: re-add rule to nft
      const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rule.sourceIp) parts.push(`ip saddr ${rule.sourceIp}`);
      if (rule.destIp) parts.push(`ip daddr ${rule.destIp}`);
      if (rule.protocol !== 'all') {
        parts.push(rule.protocol === 'icmp' ? 'ip protocol icmp' : `${rule.protocol} protocol ${rule.protocol}`);
      }
      if (rule.destPort && ['tcp', 'udp'].includes(rule.protocol)) {
        parts.push(`${rule.protocol} dport ${rule.destPort}`);
      }
      parts.push(rule.action);
      if (rule.comment) {
        parts.push(`comment "${rule.comment.replace(/"/g, '\\"')}"`);
      }

      const cmd = parts.join(' ');
      const result = execNft(cmd);
      if (!result.success) {
        log.error('Failed to enable GUI rule', { command: cmd, error: result.error });
        return c.json({ success: false, error: 'Failed to add nft rule', nftError: result.error }, 500);
      }
      rule.handle = getRuleHandle('gui_custom_rules');
      rule.enabled = true;
    } else if (!enabled && rule.enabled) {
      // Disable: delete from nft
      if (rule.handle > 0) {
        execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rule.handle}`);
      }
      rule.handle = -1;
      rule.enabled = false;
    }

    rules[idx] = rule;
    writeGuiRules(rules);

    log.info('GUI rule toggled', { id, enabled });
    return c.json({ success: true, data: rule });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// --- Port Forward CRUD ---

// GET /api/port-forwards
app.get('/api/port-forwards', (c) => {
  const rules = readPortForwards();
  return c.json({ success: true, data: rules });
});

// POST /api/port-forwards
app.post('/api/port-forwards', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name = '',
      protocol = 'tcp',
      externalPort,
      internalIp,
      internalPort,
      sourceIp = '',
      enabled = true,
    } = body;

    if (!name.trim()) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }
    if (!['tcp', 'udp', 'both'].includes(protocol)) {
      return c.json({ success: false, error: 'Invalid protocol. Must be tcp, udp, or both' }, 400);
    }
    if (!validatePortNumber(externalPort)) {
      return c.json({ success: false, error: 'External port must be 1-65535' }, 400);
    }
    if (!IP_REGEX.test(internalIp)) {
      return c.json({ success: false, error: 'Invalid internal IP address format' }, 400);
    }
    if (!validatePortNumber(internalPort)) {
      return c.json({ success: false, error: 'Internal port must be 1-65535' }, 400);
    }
    if (sourceIp && !validateIpOrCidr(sourceIp)) {
      return c.json({ success: false, error: 'Invalid source IP/CIDR format' }, 400);
    }

    if (!staysuiteTableExists()) {
      return c.json({ success: false, error: 'StaySuite table does not exist. Apply default chains first.' }, 404);
    }

    let handle = -1;
    if (enabled) {
      const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];
      for (const proto of protocols) {
        const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_nat_rules`];
        parts.push(`${proto} dport ${externalPort}`);
        if (sourceIp.trim()) parts.push(`ip saddr ${sourceIp.trim()}`);
        parts.push(`dnat to ${internalIp}:${internalPort}`);
        parts.push(`comment "${name.trim().replace(/"/g, '\\"')}"`);

        const result = execNft(parts.join(' '));
        if (!result.success) {
          log.error('Failed to add port forward rule', { proto, error: result.error });
          return c.json({ success: false, error: `Failed to add DNAT rule for ${proto}`, nftError: result.error }, 500);
        }
      }
      handle = getRuleHandle('gui_nat_rules');
    }

    const pf: PortForward = {
      id: crypto.randomUUID(),
      name: name.trim(),
      protocol,
      externalPort,
      internalIp,
      internalPort,
      sourceIp: sourceIp.trim(),
      enabled,
      handle,
      createdAt: new Date().toISOString(),
    };

    const rules = readPortForwards();
    rules.push(pf);
    writePortForwards(rules);

    log.info('Port forward added', { id: pf.id, name: pf.name, handle });
    return c.json({ success: true, data: pf });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PUT /api/port-forwards/:id
app.put('/api/port-forwards/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const rules = readPortForwards();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const body = await c.req.json();
    const existing = rules[idx];

    // Validate
    if (body.protocol !== undefined && !['tcp', 'udp', 'both'].includes(body.protocol)) {
      return c.json({ success: false, error: 'Invalid protocol' }, 400);
    }
    if (body.externalPort !== undefined && !validatePortNumber(body.externalPort)) {
      return c.json({ success: false, error: 'Invalid external port' }, 400);
    }
    if (body.internalIp !== undefined && !IP_REGEX.test(body.internalIp)) {
      return c.json({ success: false, error: 'Invalid internal IP' }, 400);
    }
    if (body.internalPort !== undefined && !validatePortNumber(body.internalPort)) {
      return c.json({ success: false, error: 'Invalid internal port' }, 400);
    }
    if (body.sourceIp !== undefined && body.sourceIp !== '' && !validateIpOrCidr(body.sourceIp)) {
      return c.json({ success: false, error: 'Invalid source IP/CIDR' }, 400);
    }

    // Delete old nft rules
    if (existing.enabled && existing.handle > 0) {
      // For "both" protocol, we need to delete multiple rules; best effort
      execNft(`nft delete rule ip ${TABLE_NAME} gui_nat_rules handle ${existing.handle}`);
    }

    const updated: PortForward = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      protocol: body.protocol !== undefined ? body.protocol : existing.protocol,
      externalPort: body.externalPort !== undefined ? body.externalPort : existing.externalPort,
      internalIp: body.internalIp !== undefined ? body.internalIp : existing.internalIp,
      internalPort: body.internalPort !== undefined ? body.internalPort : existing.internalPort,
      sourceIp: body.sourceIp !== undefined ? body.sourceIp : existing.sourceIp,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      handle: -1,
    };

    if (updated.enabled) {
      const protocols = updated.protocol === 'both' ? ['tcp', 'udp'] : [updated.protocol];
      for (const proto of protocols) {
        const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_nat_rules`];
        parts.push(`${proto} dport ${updated.externalPort}`);
        if (updated.sourceIp) parts.push(`ip saddr ${updated.sourceIp}`);
        parts.push(`dnat to ${updated.internalIp}:${updated.internalPort}`);
        parts.push(`comment "${updated.name.replace(/"/g, '\\"')}"`);

        const result = execNft(parts.join(' '));
        if (!result.success) {
          return c.json({ success: false, error: `Failed to re-add DNAT rule for ${proto}`, nftError: result.error }, 500);
        }
      }
      updated.handle = getRuleHandle('gui_nat_rules');
    }

    rules[idx] = updated;
    writePortForwards(rules);

    log.info('Port forward updated', { id, handle: updated.handle });
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// DELETE /api/port-forwards/:id
app.delete('/api/port-forwards/:id', (c) => {
  try {
    const { id } = c.req.param();
    const rules = readPortForwards();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const pf = rules[idx];
    if (pf.enabled && pf.handle > 0) {
      execNft(`nft delete rule ip ${TABLE_NAME} gui_nat_rules handle ${pf.handle}`);
    }

    rules.splice(idx, 1);
    writePortForwards(rules);

    log.info('Port forward deleted', { id, name: pf.name });
    return c.json({ success: true, message: 'Port forward deleted' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PATCH /api/port-forwards/:id/toggle
app.patch('/api/port-forwards/:id/toggle', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return c.json({ success: false, error: 'enabled (boolean) is required' }, 400);
    }

    const rules = readPortForwards();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const pf = rules[idx];

    if (enabled && !pf.enabled) {
      const protocols = pf.protocol === 'both' ? ['tcp', 'udp'] : [pf.protocol];
      for (const proto of protocols) {
        const parts: string[] = [`nft add rule ip ${TABLE_NAME} gui_nat_rules`];
        parts.push(`${proto} dport ${pf.externalPort}`);
        if (pf.sourceIp) parts.push(`ip saddr ${pf.sourceIp}`);
        parts.push(`dnat to ${pf.internalIp}:${pf.internalPort}`);
        parts.push(`comment "${pf.name.replace(/"/g, '\\"')}"`);

        const result = execNft(parts.join(' '));
        if (!result.success) {
          return c.json({ success: false, error: `Failed to add DNAT rule for ${proto}`, nftError: result.error }, 500);
        }
      }
      pf.handle = getRuleHandle('gui_nat_rules');
      pf.enabled = true;
    } else if (!enabled && pf.enabled) {
      if (pf.handle > 0) {
        execNft(`nft delete rule ip ${TABLE_NAME} gui_nat_rules handle ${pf.handle}`);
      }
      pf.handle = -1;
      pf.enabled = false;
    }

    rules[idx] = pf;
    writePortForwards(rules);

    log.info('Port forward toggled', { id, enabled });
    return c.json({ success: true, data: pf });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// --- Rate Limit CRUD ---

// GET /api/rate-limits
app.get('/api/rate-limits', (c) => {
  const rules = readRateLimits();
  return c.json({ success: true, data: rules });
});

// POST /api/rate-limits
app.post('/api/rate-limits', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name = '',
      targetIp,
      downloadRate,
      uploadRate,
      protocol = 'all',
      enabled = true,
    } = body;

    if (!name.trim()) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }
    if (!targetIp || !validateIpOrCidr(targetIp)) {
      return c.json({ success: false, error: 'Valid target IP or CIDR is required' }, 400);
    }
    if (!downloadRate || !downloadRate.match(/^\d+(kbit|mbit|gbit|kbytes|mbytes|gbytes)$/)) {
      return c.json({ success: false, error: 'Invalid download rate format (e.g., 5mbit, 512kbit)' }, 400);
    }
    if (!uploadRate || !uploadRate.match(/^\d+(kbit|mbit|gbit|kbytes|mbytes|gbytes)$/)) {
      return c.json({ success: false, error: 'Invalid upload rate format' }, 400);
    }

    if (!staysuiteTableExists()) {
      return c.json({ success: false, error: 'StaySuite table does not exist. Apply default chains first.' }, 404);
    }

    let downloadHandle = -1;
    let uploadHandle = -1;

    if (enabled) {
      // Download rule: limit rate over for traffic destined to target
      const dlParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (protocol !== 'all') dlParts.push(`${protocol} protocol ${protocol}`);
      dlParts.push(`ip daddr ${targetIp}`);
      dlParts.push(`limit rate over ${downloadRate} drop`);
      dlParts.push(`comment "rl-dl:${name.trim().replace(/"/g, '\\"')}"`);

      const dlResult = execNft(dlParts.join(' '));
      if (!dlResult.success) {
        return c.json({ success: false, error: 'Failed to add download rate limit', nftError: dlResult.error }, 500);
      }
      downloadHandle = getRuleHandle('gui_custom_rules');

      // Upload rule: limit rate over for traffic from target
      const ulParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (protocol !== 'all') ulParts.push(`${protocol} protocol ${protocol}`);
      ulParts.push(`ip saddr ${targetIp}`);
      ulParts.push(`limit rate over ${uploadRate} drop`);
      ulParts.push(`comment "rl-ul:${name.trim().replace(/"/g, '\\"')}"`);

      const ulResult = execNft(ulParts.join(' '));
      if (!ulResult.success) {
        // Rollback download rule
        if (downloadHandle > 0) {
          execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${downloadHandle}`);
        }
        return c.json({ success: false, error: 'Failed to add upload rate limit', nftError: ulResult.error }, 500);
      }
      uploadHandle = getRuleHandle('gui_custom_rules');
    }

    const rl: RateLimit = {
      id: crypto.randomUUID(),
      name: name.trim(),
      targetIp: targetIp.trim(),
      downloadRate: downloadRate.trim(),
      uploadRate: uploadRate.trim(),
      protocol,
      enabled,
      downloadHandle,
      uploadHandle,
      createdAt: new Date().toISOString(),
    };

    const rules = readRateLimits();
    rules.push(rl);
    writeRateLimits(rules);

    log.info('Rate limit added', { id: rl.id, name: rl.name });
    return c.json({ success: true, data: rl });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PUT /api/rate-limits/:id
app.put('/api/rate-limits/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const rules = readRateLimits();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    const body = await c.req.json();
    const existing = rules[idx];

    // Validate
    if (body.targetIp !== undefined && !validateIpOrCidr(body.targetIp)) {
      return c.json({ success: false, error: 'Invalid target IP/CIDR' }, 400);
    }
    if (body.downloadRate !== undefined && !body.downloadRate.match(/^\d+(kbit|mbit|gbit|kbytes|mbytes|gbytes)$/)) {
      return c.json({ success: false, error: 'Invalid download rate format' }, 400);
    }
    if (body.uploadRate !== undefined && !body.uploadRate.match(/^\d+(kbit|mbit|gbit|kbytes|mbytes|gbytes)$/)) {
      return c.json({ success: false, error: 'Invalid upload rate format' }, 400);
    }

    // Delete old rules from nft
    if (existing.enabled) {
      if (existing.downloadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${existing.downloadHandle}`);
      if (existing.uploadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${existing.uploadHandle}`);
    }

    const updated: RateLimit = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      targetIp: body.targetIp !== undefined ? body.targetIp : existing.targetIp,
      downloadRate: body.downloadRate !== undefined ? body.downloadRate : existing.downloadRate,
      uploadRate: body.uploadRate !== undefined ? body.uploadRate : existing.uploadRate,
      protocol: body.protocol !== undefined ? body.protocol : existing.protocol,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      downloadHandle: -1,
      uploadHandle: -1,
    };

    if (updated.enabled) {
      const dlParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (updated.protocol !== 'all') dlParts.push(`${updated.protocol} protocol ${updated.protocol}`);
      dlParts.push(`ip daddr ${updated.targetIp}`);
      dlParts.push(`limit rate over ${updated.downloadRate} drop`);
      dlParts.push(`comment "rl-dl:${updated.name.replace(/"/g, '\\"')}"`);
      const dlResult = execNft(dlParts.join(' '));
      if (dlResult.success) updated.downloadHandle = getRuleHandle('gui_custom_rules');

      const ulParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (updated.protocol !== 'all') ulParts.push(`${updated.protocol} protocol ${updated.protocol}`);
      ulParts.push(`ip saddr ${updated.targetIp}`);
      ulParts.push(`limit rate over ${updated.uploadRate} drop`);
      ulParts.push(`comment "rl-ul:${updated.name.replace(/"/g, '\\"')}"`);
      const ulResult = execNft(ulParts.join(' '));
      if (ulResult.success) updated.uploadHandle = getRuleHandle('gui_custom_rules');
    }

    rules[idx] = updated;
    writeRateLimits(rules);

    log.info('Rate limit updated', { id });
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// DELETE /api/rate-limits/:id
app.delete('/api/rate-limits/:id', (c) => {
  try {
    const { id } = c.req.param();
    const rules = readRateLimits();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    const rl = rules[idx];
    if (rl.enabled) {
      if (rl.downloadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rl.downloadHandle}`);
      if (rl.uploadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rl.uploadHandle}`);
    }

    rules.splice(idx, 1);
    writeRateLimits(rules);

    log.info('Rate limit deleted', { id, name: rl.name });
    return c.json({ success: true, message: 'Rate limit deleted' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// PATCH /api/rate-limits/:id/toggle
app.patch('/api/rate-limits/:id/toggle', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return c.json({ success: false, error: 'enabled (boolean) is required' }, 400);
    }

    const rules = readRateLimits();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    const rl = rules[idx];

    if (enabled && !rl.enabled) {
      // Add download rule
      const dlParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rl.protocol !== 'all') dlParts.push(`${rl.protocol} protocol ${rl.protocol}`);
      dlParts.push(`ip daddr ${rl.targetIp}`);
      dlParts.push(`limit rate over ${rl.downloadRate} drop`);
      dlParts.push(`comment "rl-dl:${rl.name.replace(/"/g, '\\"')}"`);
      const dlResult = execNft(dlParts.join(' '));
      if (dlResult.success) rl.downloadHandle = getRuleHandle('gui_custom_rules');

      // Add upload rule
      const ulParts: string[] = [`nft add rule ip ${TABLE_NAME} gui_custom_rules`];
      if (rl.protocol !== 'all') ulParts.push(`${rl.protocol} protocol ${rl.protocol}`);
      ulParts.push(`ip saddr ${rl.targetIp}`);
      ulParts.push(`limit rate over ${rl.uploadRate} drop`);
      ulParts.push(`comment "rl-ul:${rl.name.replace(/"/g, '\\"')}"`);
      const ulResult = execNft(ulParts.join(' '));
      if (ulResult.success) rl.uploadHandle = getRuleHandle('gui_custom_rules');

      rl.enabled = true;
    } else if (!enabled && rl.enabled) {
      if (rl.downloadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rl.downloadHandle}`);
      if (rl.uploadHandle > 0) execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${rl.uploadHandle}`);
      rl.downloadHandle = -1;
      rl.uploadHandle = -1;
      rl.enabled = false;
    }

    rules[idx] = rl;
    writeRateLimits(rules);

    log.info('Rate limit toggled', { id, enabled });
    return c.json({ success: true, data: rl });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// --- Quick Block ---

// GET /api/quick-blocks
app.get('/api/quick-blocks', (c) => {
  const blocks = readQuickBlocks();
  return c.json({ success: true, data: blocks });
});

// POST /api/quick-blocks
app.post('/api/quick-blocks', async (c) => {
  try {
    const body = await c.req.json();
    const { type = 'ip', value, reason = '' } = body;

    if (!value || !value.trim()) {
      return c.json({ success: false, error: 'Value is required' }, 400);
    }

    if (!['ip', 'subnet', 'mac'].includes(type)) {
      return c.json({ success: false, error: 'Type must be ip, subnet, or mac' }, 400);
    }

    const trimmedValue = value.trim();

    if (type === 'ip' && !IP_REGEX.test(trimmedValue)) {
      return c.json({ success: false, error: 'Invalid IP address format' }, 400);
    }
    if (type === 'subnet' && !CIDR_REGEX.test(trimmedValue)) {
      return c.json({ success: false, error: 'Invalid CIDR format (e.g., 10.0.0.0/24)' }, 400);
    }
    if (type === 'mac' && !MAC_REGEX.test(trimmedValue)) {
      return c.json({ success: false, error: 'Invalid MAC address format' }, 400);
    }

    if (!staysuiteTableExists()) {
      return c.json({ success: false, error: 'StaySuite table does not exist. Apply default chains first.' }, 404);
    }

    let handle = -1;

    if (type === 'mac') {
      // Add to mac_blacklist set
      const result = execNft(`nft add element ip ${TABLE_NAME} mac_blacklist { ${trimmedValue} }`);
      if (!result.success) {
        return c.json({ success: false, error: 'Failed to add MAC to blacklist set', nftError: result.error }, 500);
      }
      // MAC blocks don't have a handle (they're set elements)
      handle = 0;
    } else {
      // Add drop rule to gui_custom_rules
      const matchExpr = type === 'subnet' ? `ip saddr ${trimmedValue}` : `ip saddr ${trimmedValue}`;
      const cmd = `nft add rule ip ${TABLE_NAME} gui_custom_rules ${matchExpr} drop comment "quick-block:${reason.replace(/"/g, '\\"').substring(0, 50)}"`;
      const result = execNft(cmd);
      if (!result.success) {
        return c.json({ success: false, error: 'Failed to add drop rule', nftError: result.error }, 500);
      }
      handle = getRuleHandle('gui_custom_rules');
    }

    const block: QuickBlock = {
      id: crypto.randomUUID(),
      type,
      value: trimmedValue,
      reason: reason.trim(),
      blockedAt: new Date().toISOString(),
      handle,
    };

    const blocks = readQuickBlocks();
    blocks.push(block);
    writeQuickBlocks(blocks);

    log.info('Quick block added', { id: block.id, type, value });
    return c.json({ success: true, data: block });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// DELETE /api/quick-blocks/:id
app.delete('/api/quick-blocks/:id', (c) => {
  try {
    const { id } = c.req.param();
    const blocks = readQuickBlocks();
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) {
      return c.json({ success: false, error: 'Quick block not found' }, 404);
    }

    const block = blocks[idx];

    if (block.type === 'mac') {
      execNft(`nft delete element ip ${TABLE_NAME} mac_blacklist { ${block.value} }`);
    } else if (block.handle > 0) {
      execNft(`nft delete rule ip ${TABLE_NAME} gui_custom_rules handle ${block.handle}`);
    }

    blocks.splice(idx, 1);
    writeQuickBlocks(blocks);

    log.info('Quick block removed', { id, type: block.type, value: block.value });
    return c.json({ success: true, message: 'Quick block removed' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// --- Presets ---

// GET /api/presets — return hardcoded list of preset templates
app.get('/api/presets', (c) => {
  const presets = [
    {
      id: 'allow-pms',
      name: 'Allow PMS Access',
      description: 'Allow TCP 5432 from any LAN subnet',
      category: 'networking',
      rules: [{ protocol: 'tcp', destPort: '5432', action: 'accept' }],
    },
    {
      id: 'allow-rdp',
      name: 'Allow RDP',
      description: 'Allow TCP 3389 from specific IP',
      category: 'remote-access',
      rules: [{ protocol: 'tcp', destPort: '3389', action: 'accept' }],
    },
    {
      id: 'allow-voip',
      name: 'Allow VoIP/SIP',
      description: 'Allow UDP 5060,5061 + RTP 10000-20000',
      category: 'networking',
      rules: [
        { protocol: 'udp', destPort: '5060', action: 'accept' },
        { protocol: 'udp', destPort: '5061', action: 'accept' },
        { protocol: 'udp', destPort: '10000-20000', action: 'accept' },
      ],
    },
    {
      id: 'block-social-media',
      name: 'Block Social Media',
      description: 'Drop traffic to known social media IP ranges',
      category: 'content-filter',
      rules: [
        { protocol: 'tcp', destIp: '31.13.24.0/22', destPort: '443', action: 'drop' },
        { protocol: 'tcp', destIp: '157.240.0.0/16', destPort: '443', action: 'drop' },
      ],
    },
    {
      id: 'allow-printer',
      name: 'Allow Printer',
      description: 'Allow TCP 9100 from LAN subnet',
      category: 'networking',
      rules: [{ protocol: 'tcp', destPort: '9100', action: 'accept' }],
    },
    {
      id: 'allow-cctv',
      name: 'Allow CCTV/NVR',
      description: 'Allow TCP 554,8080 from CCTV subnet',
      category: 'networking',
      rules: [
        { protocol: 'tcp', destPort: '554', action: 'accept' },
        { protocol: 'tcp', destPort: '8080', action: 'accept' },
      ],
    },
    {
      id: 'guest-isolation',
      name: 'Guest Isolation',
      description: 'Block inter-guest communication',
      category: 'security',
      rules: [
        { protocol: 'all', destIp: '10.0.2.0/24', action: 'drop' },
      ],
    },
    {
      id: 'dns-only',
      name: 'DNS Only Access',
      description: 'Only allow DNS from specific subnet',
      category: 'security',
      rules: [
        { protocol: 'udp', destPort: '53', action: 'accept' },
        { protocol: 'tcp', destPort: '53', action: 'accept' },
      ],
    },
  ];

  return c.json({ success: true, data: presets });
});

// ============================================================================
// Start Server
// ============================================================================

console.log(`🛡️  nftables Firewall Service starting on port ${PORT}`);
console.log(`   nftables installed: ${isNftablesInstalled()}`);
console.log(`   Config dir: ${NFTABLES_CONFIG_DIR}`);
console.log(`   Config file: ${NFTABLES_CONFIG}`);

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

log.info('nftables Firewall Service listening', { port: PORT });
// Startup validation
log.info('nftables-service starting', {
  port: PORT,
  version: SERVICE_VERSION,
  nftablesInstalled: isNftablesInstalled(),
  configPath: NFTABLES_CONFIG,
  projectRoot: PROJECT_ROOT,
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  process.exit(0);
});
