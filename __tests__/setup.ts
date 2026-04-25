// Test setup - global test configuration
// This file is loaded by vitest before any tests run
// See vitest.config.ts -> setupFiles: ['__tests__/setup.ts']

import { beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';

/**
 * Global test configuration for Property Management tests.
 * Uses the REAL SQLite database with seeded data.
 * Tests should create sessions in the DB for authenticated requests.
 */
beforeAll(async () => {
  // Ensure database connection is working
  try {
    await db.$connect();
    // Quick connectivity check
    const tenantCount = await db.tenant.count();
    if (tenantCount === 0) {
      throw new Error('Database appears empty. Run `bun run db:seed` first.');
    }
  } catch (error) {
    console.error('Test setup failed: could not connect to database.', error);
    throw error;
  }
});

afterAll(async () => {
  await db.$disconnect();
});
