const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = process.env.PROJECT_ROOT || __dirname;
const DB_PATH = process.env.DATABASE_URL || `file:${path.join(PROJECT_ROOT, 'db', 'custom.db')}`;

// Auto-detect bun path
function findBun() {
  const candidates = [
    '/root/.bun/bin/bun',
    '/usr/local/bin/bun',
    process.env.HOME + '/.bun/bin/bun',
  ];
  try {
    const which = require('child_process').execSync('which bun 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch {}
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return 'bun';
}

const BUN_PATH = findBun();

// Shared mini-service defaults — prevents EADDRINUSE crash loops
const MINI_SERVICE_DEFAULTS = {
  max_memory_restart: '512M',
  autorestart: true,
  max_restarts: 10,
  restart_delay: 5000,       // 5s between restart attempts (was 3s — too fast for port release)
  kill_timeout: 3000,        // give process 3s to shut down gracefully before SIGKILL
  listen_timeout: 10000,     // wait up to 10s for port to be available on startup
};

module.exports = {
  apps: [
    {
      name: 'staysuite',
      script: path.join(PROJECT_ROOT, 'node_modules/.bin/next'),
      args: 'dev -p 3000',
      interpreter: 'node',
      cwd: PROJECT_ROOT,
      env: {
        NODE_OPTIONS: '--max-old-space-size=7168',
        // SECURITY: These MUST be set via environment variables in production.
        // Never commit real secrets. The fallback values are for local dev only.
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'dev-only-change-in-production',
        NEXTAUTH_URL: 'http://localhost:3000',
        DATABASE_URL: DB_PATH,
        CRON_SECRET: process.env.CRON_SECRET || 'dev-only-cron-secret',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      max_memory_restart: '6G',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'freeradius-service'),
      env: {
        PORT: 3010,
        DATABASE_PATH: path.join(PROJECT_ROOT, 'db', 'custom.db'),
        PROJECT_ROOT: PROJECT_ROOT,
        NODE_PATH: path.join(PROJECT_ROOT, 'mini-services', 'freeradius-service', 'node_modules'),
      },
      ...MINI_SERVICE_DEFAULTS,
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'realtime-service'),
      env: {
        PORT: 3003,
        DATABASE_URL: DB_PATH,
      },
      ...MINI_SERVICE_DEFAULTS,
    },
    {
      name: 'availability-service',
      script: 'server.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'availability-service'),
      env: {
        PORT: 3002,
        DATABASE_URL: DB_PATH,
      },
      ...MINI_SERVICE_DEFAULTS,
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'dns-service'),
      env: {
        PORT: 3012,
        PROJECT_ROOT: PROJECT_ROOT,
        DATABASE_PATH: path.join(PROJECT_ROOT, 'db', 'custom.db'),
        NODE_PATH: path.join(PROJECT_ROOT, 'mini-services', 'dns-service', 'node_modules'),
      },
      ...MINI_SERVICE_DEFAULTS,
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'nftables-service'),
      env: {
        PORT: 3013,
        PROJECT_ROOT: PROJECT_ROOT,
        NODE_PATH: path.join(PROJECT_ROOT, 'mini-services', 'nftables-service', 'node_modules'),
      },
      ...MINI_SERVICE_DEFAULTS,
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: path.join(PROJECT_ROOT, 'mini-services', 'dhcp-service'),
      env: {
        PORT: 3011,
        PROJECT_ROOT: PROJECT_ROOT,
        DATABASE_PATH: path.join(PROJECT_ROOT, 'db', 'custom.db'),
        NODE_PATH: path.join(PROJECT_ROOT, 'mini-services', 'dhcp-service', 'node_modules'),
      },
      ...MINI_SERVICE_DEFAULTS,
    },
  ],
};
