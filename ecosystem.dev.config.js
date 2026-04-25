/**
 * StaySuite HospitalityOS - PM2 Development Ecosystem Configuration
 * Uses bun --hot for hot-reload on all services
 */

const BUN_PATH = process.env.BUN_PATH || '/usr/local/bin/bun';
const APP_DIR = __dirname;
const LOG_DIR = `${APP_DIR}/logs`;

module.exports = {
  apps: [
    // =========================================================================
    // Next.js Application (dev mode)
    // =========================================================================
    {
      name: 'staysuite-nextjs',
      script: 'node_modules/.bin/next',
      args: 'dev -p 3000',
      interpreter: 'none',
      cwd: APP_DIR,
      env: {
        NODE_ENV: 'development',
        NEXT_DISABLE_TURBOPACK: '1',
        PORT: 3000,
        DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      },
      max_memory_restart: '2G',
      error_file: `${LOG_DIR}/next-error.log`,
      out_file: `${LOG_DIR}/next-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // =========================================================================
    // Mini Services (dev mode with bun --hot)
    // =========================================================================
    {
      name: 'availability-service',
      script: 'server.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/availability-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      },
      error_file: `${LOG_DIR}/availability-service-error.log`,
      out_file: `${LOG_DIR}/availability-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/realtime-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
        DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      },
      error_file: `${LOG_DIR}/realtime-service-error.log`,
      out_file: `${LOG_DIR}/realtime-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/dhcp-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3011,
      },
      error_file: `${LOG_DIR}/dhcp-service-error.log`,
      out_file: `${LOG_DIR}/dhcp-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/dns-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3012,
        DATABASE_PATH: `${APP_DIR}/db/dns-service.db`,
        PRISMA_DATABASE_PATH: `${APP_DIR}/db/custom.db`,
      },
      error_file: `${LOG_DIR}/dns-service-error.log`,
      out_file: `${LOG_DIR}/dns-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/freeradius-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3010,
      },
      error_file: `${LOG_DIR}/freeradius-service-error.log`,
      out_file: `${LOG_DIR}/freeradius-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      interpreter_args: '--hot',
      cwd: `${APP_DIR}/mini-services/nftables-service`,
      env: {
        NODE_ENV: 'development',
        PORT: 3013,
      },
      error_file: `${LOG_DIR}/nftables-service-error.log`,
      out_file: `${LOG_DIR}/nftables-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
