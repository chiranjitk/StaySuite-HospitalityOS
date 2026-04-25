/**
 * StaySuite HospitalityOS - PM2 Local Development Configuration
 * 
 * Usage:
 *   pm2 delete all
 *   pm2 start ecosystem.local.config.js
 *   pm2 save
 *   pm2 logs
 */

const APP_DIR = '/home/z/my-project';
const LOG_DIR = `${APP_DIR}/logs`;

module.exports = {
  apps: [
    // =========================================================================
    // Next.js Development Server
    // =========================================================================
    {
      name: 'staysuite-nextjs',
      script: 'npx',
      args: 'next dev -p 3000',
      cwd: APP_DIR,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'file:../db/custom.db',
        PORT: 3000,
        NEXT_DISABLE_TURBOPACK: '1',
      },
      watch: false,
      max_memory_restart: '2G',
      error_file: `${LOG_DIR}/next-error.log`,
      out_file: `${LOG_DIR}/next-out.log`,
      max_restarts: 10,
      restart_delay: 5000,
    },

    // =========================================================================
    // Mini Services (all use bun directly)
    // =========================================================================
    {
      name: 'availability-service',
      script: '/usr/local/bin/bun',
      args: 'server.ts',
      cwd: `${APP_DIR}/mini-services/availability-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
        DATABASE_URL: `file:${APP_DIR}/db/custom.db`,
      },
      error_file: `${LOG_DIR}/availability-service-error.log`,
      out_file: `${LOG_DIR}/availability-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'realtime-service',
      script: '/usr/local/bin/bun',
      args: 'index.ts',
      cwd: `${APP_DIR}/mini-services/realtime-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
        DATABASE_URL: `file:${APP_DIR}/db/custom.db`,
      },
      error_file: `${LOG_DIR}/realtime-service-error.log`,
      out_file: `${LOG_DIR}/realtime-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'dhcp-service',
      script: '/usr/local/bin/bun',
      args: 'index.ts',
      cwd: `${APP_DIR}/mini-services/dhcp-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3011,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
        DATABASE_URL: `file:${APP_DIR}/db/custom.db`,
      },
      error_file: `${LOG_DIR}/dhcp-service-error.log`,
      out_file: `${LOG_DIR}/dhcp-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'dns-service',
      script: '/usr/local/bin/bun',
      args: 'run index.ts',
      cwd: `${APP_DIR}/mini-services/dns-service`,
      env: {
        NODE_ENV: 'production',
        BUN_ENV: 'production',
        PORT: 3012,
        DATABASE_PATH: `${APP_DIR}/db/custom.db`,
        DATABASE_URL: `file:${APP_DIR}/db/custom.db`,
        PRISMA_DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
      error_file: `${LOG_DIR}/dns-service-error.log`,
      out_file: `${LOG_DIR}/dns-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'freeradius-service',
      script: '/usr/local/bin/bun',
      args: 'run index.ts',
      cwd: `${APP_DIR}/mini-services/freeradius-service`,
      env: {
        NODE_ENV: 'production',
        BUN_ENV: 'production',
        PORT: 3010,
      },
      error_file: `${LOG_DIR}/freeradius-service-error.log`,
      out_file: `${LOG_DIR}/freeradius-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'nftables-service',
      script: '/usr/local/bin/bun',
      args: 'run index.ts',
      cwd: `${APP_DIR}/mini-services/nftables-service`,
      env: {
        NODE_ENV: 'production',
        BUN_ENV: 'production',
        PORT: 3013,
      },
      error_file: `${LOG_DIR}/nftables-service-error.log`,
      out_file: `${LOG_DIR}/nftables-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
