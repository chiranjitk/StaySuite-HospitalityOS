import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * GET /api/network/os/nat/forwards - Get NAT port forwarding rules from nftables/iptables
 * Reads directly from OS, no kea-service dependency
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

function parseIptablesNat(): any[] {
  const rules: any[] = [];
  const output = safeExec('sudo iptables -t nat -L PREROUTING -n -v 2>/dev/null');
  if (!output) return rules;

  for (const line of output.trim().split('\n').slice(2)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 7) {
      const target = parts[0];
      const protocol = parts[1];
      const destination = parts[5] || '';
      let toDestination = '';

      if (target === 'DNAT' && parts.length >= 8) {
        const toIdx = line.indexOf('to:');
        if (toIdx >= 0) {
          toDestination = line.substring(toIdx + 3).trim().split(/\s/)[0];
        }
      }

      if (target === 'DNAT' || target === 'REDIRECT') {
        rules.push({
          table: 'nat',
          chain: 'PREROUTING',
          family: 'ip',
          parsed: {
            protocol: protocol === 'tcp' ? 'TCP' : protocol === 'udp' ? 'UDP' : protocol.toUpperCase(),
            destination,
            toDestination,
            interface: parts[3] || '',
          },
          raw: line,
        });
      }
    }
  }
  return rules;
}

function parseNftablesNat(): any[] {
  const output = safeExec('sudo nft -j list ruleset 2>/dev/null');
  if (!output) return parseIptablesNat();

  try {
    const nftJson = JSON.parse(output);
    const nftRules = nftJson?.nftables || [];
    const rules: any[] = [];

    for (const item of nftRules) {
      if (item.rule) {
        const rule = item.rule;
        const chain = rule.chain?.name || '';
        const table = rule.table?.name || '';

        if (table === 'nat' || chain.includes('dnat') || chain.includes('prerouting')) {
          const expr = rule.expr || [];
          let protocol = '';
          let destination = '';
          let toDestination = '';
          let interface_ = '';

          for (const e of expr) {
            if (e.match) {
              if (e.match.left?.payload?.protocol === 'tcp') protocol = 'TCP';
              else if (e.match.left?.payload?.protocol === 'udp') protocol = 'UDP';
              if (e.match.right === 'tcp') protocol = 'TCP';
              else if (e.match.right === 'udp') protocol = 'UDP';
            }
            if (e.match?.left?.payload?.field === 'dport' && e.match?.right) {
              destination = `${protocol}:${e.match.right}`;
            }
            if (e.nat?.addr) {
              toDestination = `${e.nat.addr}:${e.nat.port || ''}`;
            }
          }

          if (destination || toDestination) {
            rules.push({
              table, chain,
              family: rule.table?.family || '',
              handle: rule.handle,
              parsed: { protocol, destination, toDestination, interface: interface_ },
              raw: JSON.stringify(expr),
            });
          }
        }
      }
    }
    return rules.length > 0 ? rules : parseIptablesNat();
  } catch {
    return parseIptablesNat();
  }
}

export async function GET() {
  try {
    const forwards = parseNftablesNat();
    return NextResponse.json({ success: true, data: forwards });
  } catch (error) {
    console.error('[Network OS API] NAT forwards error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to read NAT forwarding rules' } },
      { status: 500 }
    );
  }
}
