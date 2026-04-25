/**
 * StaySuite HospitalityOS - PM2 Ecosystem Configuration
 * For Rocky Linux 10 / Debian 13 deployment
 *
 * IMPORTANT: All mini-services use bun directly (NOT npm start).
 * Using "npm start" causes PM2 to lose track of the child bun process,
 * resulting in crash-loop restarts (↺ keeps incrementing).
 *
 * IMPORTANT: Next.js standalone server + Rocky 10 IPv6 EINVAL fix.
 * The standalone server (.next/standalone/server.js) reads process.env.HOSTNAME
 * to determine the listen address. It does NOT parse --hostname CLI args.
 * On Rocky 10, HOSTNAME is set by the OS to the machine hostname, which
 * DNS-resolves to a link-local IPv6 address (fe80::...) — causing EINVAL.
 * PM2 cannot reliably override the system HOSTNAME env var.
 *
 * FIX: Use start-nextjs.sh wrapper which explicitly sets HOSTNAME=0.0.0.0
 * before launching the standalone server.
 *
 * Usage:
 *   chmod +x start-nextjs.sh          # Make wrapper executable
 *   pm2 delete all                    # Kill old processes first
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

const BUN_PATH = process.env.BUN_PATH || '/root/.bun/bin/bun';
const APP_DIR = __dirname;
const LOG_DIR = `${APP_DIR}/logs`;

module.exports = {
  apps: [
    // =========================================================================
    // Next.js Application (production standalone)
    // =========================================================================
    {
      name: 'staysuite-nextjs',
      // CRITICAL: start-nextjs.sh wrapper sets HOSTNAME=0.0.0.0 to prevent
      // EINVAL crash on Rocky 10. The standalone server.js reads process.env
      // .HOSTNAME but ignores --hostname CLI args. PM2 cannot reliably
      // override the system HOSTNAME env var, so a bash wrapper is needed.
      script: 'start-nextjs.sh',
      interpreter: 'bash',
      cwd: APP_DIR,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '2G',
      error_file: `${LOG_DIR}/next-error.log`,
      out_file: `${LOG_DIR}/next-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // =========================================================================
    // Mini Services (all use bun directly)
    // =========================================================================
    {
      name: 'availability-service',
      script: 'server.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/availability-service`,
      error_file: `${LOG_DIR}/availability-service-error.log`,
      out_file: `${LOG_DIR}/availability-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/realtime-service`,
      error_file: `${LOG_DIR}/realtime-service-error.log`,
      out_file: `${LOG_DIR}/realtime-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dhcp-service`,
      error_file: `${LOG_DIR}/dhcp-service-error.log`,
      out_file: `${LOG_DIR}/dhcp-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dns-service`,
      error_file: `${LOG_DIR}/dns-service-error.log`,
      out_file: `${LOG_DIR}/dns-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3012,
        DATABASE_PATH: `${APP_DIR}/db/dns-service.db`,
        PRISMA_DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/freeradius-service`,
      error_file: `${LOG_DIR}/freeradius-service-error.log`,
      out_file: `${LOG_DIR}/freeradius-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/nftables-service`,
      error_file: `${LOG_DIR}/nftables-service-error.log`,
      out_file: `${LOG_DIR}/nftables-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3013,
      },
    },
  ],
};
