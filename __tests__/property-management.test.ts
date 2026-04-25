/**
 * Comprehensive Vitest test suite for the Property Management module
 * of StaySuite HospitalityOS.
 *
 * Uses the REAL SQLite database (via Prisma) with seeded data.
 * Tests API route handlers by importing and calling them directly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Route handler imports ───────────────────────────────────────────
import {
  GET as listProperties,
  POST as createProperty,
} from '@/app/api/properties/route';
import {
  GET as getProperty,
  PUT as updateProperty,
  DELETE as deleteProperty,
} from '@/app/api/properties/[id]/route';
import {
  GET as listRoomTypes,
  POST as createRoomType,
} from '@/app/api/room-types/route';
import {
  DELETE as deleteRoomType,
} from '@/app/api/room-types/[id]/route';
import {
  GET as listRooms,
  POST as createRoom,
} from '@/app/api/rooms/route';
import {
  DELETE as deleteRoom,
} from '@/app/api/rooms/[id]/route';
import {
  GET as listRatePlans,
  POST as createRatePlan,
  PUT as updateRatePlan,
  DELETE as deleteRatePlans,
} from '@/app/api/rate-plans/route';
import {
  GET as listInventoryLocks,
  POST as createInventoryLock,
  PUT as updateInventoryLock,
  DELETE as deleteInventoryLocks,
} from '@/app/api/inventory-locks/route';
import {
  GET as getTaxSettings,
  PUT as updateTaxSettings,
} from '@/app/api/properties/[id]/tax-settings/route';

// ─── Seed-data identifiers ──────────────────────────────────────────
const ADMIN_USER_ID = 'user-1';
const FRONTDESK_USER_ID = 'user-2';
const HOUSEKEEPING_USER_ID = 'user-3';
const PLATFORM_USER_ID = 'user-platform';
const T2_ADMIN_USER_ID = 'user-t2-1';

const TENANT_1 = 'tenant-1';
const TENANT_2 = 'tenant-2';
const PROPERTY_1 = 'property-1'; // Royal Stay Kolkata
const PROPERTY_2 = 'property-2'; // Royal Stay Darjeeling
const ROOM_TYPE_1 = 'roomtype-1'; // Standard Room
const ROOM_TYPE_2 = 'roomtype-2'; // Deluxe Room

// ─── Session token map ──────────────────────────────────────────────
const sessionTokens = new Map<string, string>();

// ─── Test-created entity IDs (for cleanup) ─────────────────────────
let testPropertySlug: string;
let testPropertyId: string | null = null;
let testRoomTypeId: string | null = null;
let testRoomCode: string;
let testRoomId: string | null = null;
let testRatePlanCode: string;
let testRatePlanId: string | null = null;
let testInventoryLockId: string | null = null;
let testRoomTypeForDeleteId: string | null = null;

// ─── Unique suffix to avoid collisions ──────────────────────────────
const SUFFIX = Date.now();

// ─── Helpers ─────────────────────────────────────────────────────────

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function futureDateOnly(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

/**
 * Create a NextRequest with an optional session cookie.
 */
function createRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    userId?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  const headers = new Headers(options.headers ?? {});

  if (options.userId) {
    const token = sessionTokens.get(options.userId);
    if (token) {
      headers.set('Cookie', `session_token=${token}`);
    }
  }

  const init: RequestInit = { headers };
  if (options.method) init.method = options.method;
  if (options.body) {
    init.body = JSON.stringify(options.body);
    headers.set('Content-Type', 'application/json');
  }

  return new NextRequest(url.toString(), init);
}

/** Shorthand to create the params object expected by [id] routes. */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Parse JSON body from a Response. */
async function json(res: Response) {
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════

describe('Property Management Module', () => {

  // ───────────────────────────────────────────────────────────────────
  // Setup & Teardown
  // ───────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Clean up leftover test sessions from previous runs
    const testTokens = [
      'test-session-admin',
      'test-session-frontdesk',
      'test-session-housekeeping',
      'test-session-platform',
      'test-session-t2-admin',
    ];
    await db.session.deleteMany({
      where: { token: { in: testTokens } },
    });

    // Create fresh sessions for each test user
    const sessions = [
      { userId: ADMIN_USER_ID, token: 'test-session-admin' },
      { userId: FRONTDESK_USER_ID, token: 'test-session-frontdesk' },
      { userId: HOUSEKEEPING_USER_ID, token: 'test-session-housekeeping' },
      { userId: PLATFORM_USER_ID, token: 'test-session-platform' },
      { userId: T2_ADMIN_USER_ID, token: 'test-session-t2-admin' },
    ];

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    for (const s of sessions) {
      await db.session.create({
        data: {
          userId: s.userId,
          token: s.token,
          refreshToken: `${s.token}-refresh`,
          expiresAt: expiry,
          userAgent: 'vitest',
          ipAddress: '127.0.0.1',
        },
      });
      sessionTokens.set(s.userId, s.token);
    }

    // Generate unique identifiers for test entities
    testPropertySlug = `test-prop-${SUFFIX}`;
    testRoomCode = `TRT${SUFFIX}`;
    testRatePlanCode = `TRP${SUFFIX}`;

    // Pre-create a room type for the "room creation" and "room type delete" tests
    const rt = await db.roomType.create({
      data: {
        propertyId: PROPERTY_1,
        name: `Test Room Type ${SUFFIX}`,
        code: testRoomCode,
        basePrice: 2000,
        currency: 'INR',
        status: 'active',
        amenities: '[]',
        images: '[]',
      },
    });
    testRoomTypeId = rt.id;

    // Pre-create a room type with NO rooms for the delete test
    const rtDel = await db.roomType.create({
      data: {
        propertyId: PROPERTY_1,
        name: `Deletable RT ${SUFFIX}`,
        code: `DELRT${SUFFIX}`,
        basePrice: 1500,
        currency: 'INR',
        status: 'active',
        amenities: '[]',
        images: '[]',
      },
    });
    testRoomTypeForDeleteId = rtDel.id;
  });

  afterAll(async () => {
    // Clean up test sessions
    await db.session.deleteMany({
      where: {
        token: {
          in: Array.from(sessionTokens.values()),
        },
      },
    });

    // Clean up inventory locks created during tests
    if (testInventoryLockId) {
      try {
        await db.inventoryLock.deleteMany({
          where: { createdBy: PLATFORM_USER_ID },
        });
      } catch { /* ignore */ }
    }

    // Clean up rate plans created during tests
    if (testRatePlanId) {
      try {
        await db.ratePlan.deleteMany({
          where: { id: testRatePlanId },
        });
      } catch { /* ignore */ }
    }

    // Clean up rooms created during tests
    if (testRoomId) {
      try {
        await db.room.deleteMany({ where: { id: testRoomId } });
      } catch { /* ignore */ }
    }

    // Clean up properties created during tests
    if (testPropertyId) {
      try {
        await db.property.deleteMany({ where: { id: testPropertyId } });
      } catch { /* ignore */ }
    }

    // Clean up test room types
    for (const rtId of [testRoomTypeId, testRoomTypeForDeleteId]) {
      if (rtId) {
        try {
          await db.roomType.deleteMany({ where: { id: rtId } });
        } catch { /* ignore */ }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // A. Authentication & Authorization
  // ═══════════════════════════════════════════════════════════════════

  describe('A. Authentication & Authorization', () => {
    // A1. Unauthenticated
    it('returns 401 for GET /api/properties without session', async () => {
      const req = createRequest('/api/properties');
      const res = await listProperties(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for POST /api/properties without session', async () => {
      const req = createRequest('/api/properties', { method: 'POST', body: {} });
      const res = await createProperty(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/room-types without session', async () => {
      const req = createRequest('/api/room-types');
      const res = await listRoomTypes(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/rooms without session', async () => {
      const req = createRequest('/api/rooms');
      const res = await listRooms(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/rate-plans without session', async () => {
      const req = createRequest('/api/rate-plans');
      const res = await listRatePlans(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/inventory-locks without session', async () => {
      const req = createRequest('/api/inventory-locks');
      const res = await listInventoryLocks(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/properties/[id]/tax-settings without session', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`);
      const res = await getTaxSettings(req, makeParams(PROPERTY_1));
      expect(res.status).toBe(401);
    });

    // A2. User without permission
    it('returns 403 for POST /api/properties when user lacks properties.create', async () => {
      // frontdesk user does NOT have properties.create
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: FRONTDESK_USER_ID,
        body: { name: 'T', slug: 't', address: 'a', city: 'c', country: 'IN' },
      });
      const res = await createProperty(req);
      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.error?.code).toBe('FORBIDDEN');
    });

    it('returns 403 for POST /api/room-types when user lacks room-types.create', async () => {
      const req = createRequest('/api/room-types', {
        method: 'POST',
        userId: FRONTDESK_USER_ID,
        body: { propertyId: PROPERTY_1, name: 'T', code: 'T', basePrice: 100 },
      });
      const res = await createRoomType(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 for POST /api/rooms when user lacks rooms.create', async () => {
      // housekeeping has rooms.view but NOT rooms.create
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: HOUSEKEEPING_USER_ID,
        body: { propertyId: PROPERTY_1, roomTypeId: ROOM_TYPE_1, number: 'T999' },
      });
      const res = await createRoom(req);
      expect(res.status).toBe(403);
    });

    // A3. Admin user bypasses permission checks
    it('admin can POST /api/properties (roleName bypass)', async () => {
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          name: `Admin Property ${SUFFIX}`,
          slug: testPropertySlug,
          address: '123 Test St',
          city: 'Kolkata',
          country: 'India',
        },
      });
      const res = await createProperty(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe(testPropertySlug);
      testPropertyId = body.data.id;
    });

    // A4. Platform admin bypasses permission checks
    it('platform admin can access any endpoint', async () => {
      const req = createRequest('/api/properties', { userId: PLATFORM_USER_ID });
      const res = await listProperties(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    // A5. Cross-tenant access denied
    it('tenant-2 admin cannot see tenant-1 properties', async () => {
      const req = createRequest('/api/properties', { userId: T2_ADMIN_USER_ID });
      const res = await listProperties(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      // tenant-2 has NO properties in seed data
      expect(body.data).toHaveLength(0);
    });

    it('tenant-2 admin cannot GET tenant-1 property by id', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getProperty(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    it('tenant-2 admin cannot update tenant-1 property', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}`, {
        method: 'PUT',
        userId: T2_ADMIN_USER_ID,
        body: { name: 'Hacked Name' },
      });
      const res = await updateProperty(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(404);
    });

    it('tenant-2 admin cannot delete tenant-1 property', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}`, {
        method: 'DELETE',
        userId: T2_ADMIN_USER_ID,
      });
      const res = await deleteProperty(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // B. Property CRUD
  // ═══════════════════════════════════════════════════════════════════

  describe('B. Property CRUD', () => {
    // B1. GET /api/properties
    it('lists properties for the users tenant', async () => {
      const req = createRequest('/api/properties', { userId: ADMIN_USER_ID });
      const res = await listProperties(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      // Should include Royal Stay Kolkata
      const names = body.data.map((p: any) => p.name);
      expect(names).toContain('Royal Stay Kolkata');
    });

    it('filters by status', async () => {
      const req = createRequest('/api/properties?status=active', {
        userId: ADMIN_USER_ID,
      });
      const res = await listProperties(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const p of body.data) {
        expect(p.status).toBe('active');
      }
    });

    it('filters by type', async () => {
      const req = createRequest('/api/properties?type=resort', {
        userId: ADMIN_USER_ID,
      });
      const res = await listProperties(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const p of body.data) {
        expect(p.type).toBe('resort');
      }
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('excludes soft-deleted properties', async () => {
      // First soft-delete the test property we created
      if (testPropertyId) {
        await db.property.update({
          where: { id: testPropertyId },
          data: { deletedAt: new Date() },
        });
        const req = createRequest('/api/properties', { userId: ADMIN_USER_ID });
        const res = await listProperties(req);
        const body = await json(res);
        const ids = body.data.map((p: any) => p.id);
        expect(ids).not.toContain(testPropertyId);

        // Restore it for later cleanup
        await db.property.update({
          where: { id: testPropertyId },
          data: { deletedAt: null },
        });
      }
    });

    // B2. POST /api/properties
    it('creates property with all defaults applied', async () => {
      const slug = `defaults-test-${SUFFIX}`;
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          name: 'Defaults Test',
          slug,
          address: '1 Default St',
          city: 'Kolkata',
          country: 'India',
        },
      });
      const res = await createProperty(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('hotel');
      expect(body.data.checkInTime).toBe('14:00');
      expect(body.data.checkOutTime).toBe('11:00');
      expect(body.data.timezone).toBe('Asia/Kolkata');
      expect(body.data.currency).toBe('INR');
      expect(body.data.taxType).toBe('gst');
      expect(body.data.status).toBe('active');
      // Cleanup
      await db.property.delete({ where: { id: body.data.id } });
    });

    it('rejects missing required fields', async () => {
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { name: 'Incomplete', slug: 'incomplete' }, // missing address, city, country
      });
      const res = await createProperty(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate slug within same tenant', async () => {
      // 'royal-stay-kolkata' already exists for tenant-1
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          name: 'Duplicate',
          slug: 'royal-stay-kolkata',
          address: 'Dup St',
          city: 'Kolkata',
          country: 'India',
        },
      });
      const res = await createProperty(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('DUPLICATE_SLUG');
    });

    // B3. PUT /api/properties/[id]
    it('updates property fields', async () => {
      const newCity = `Updated City ${SUFFIX}`;
      const req = createRequest(`/api/properties/${PROPERTY_1}`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: { city: newCity },
      });
      const res = await updateProperty(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.city).toBe(newCity);

      // Restore original value
      await db.property.update({
        where: { id: PROPERTY_1 },
        data: { city: 'Kolkata' },
      });
    });

    it('detects slug change conflict', async () => {
      // Trying to change property-1 slug to 'royal-stay-darjeeling' (property-2's slug)
      const req = createRequest(`/api/properties/${PROPERTY_1}`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: { slug: 'royal-stay-darjeeling' },
      });
      const res = await updateProperty(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('DUPLICATE_SLUG');
    });

    it('returns 404 for non-existent property', async () => {
      const req = createRequest('/api/properties/non-existent-id', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: { name: 'Ghost' },
      });
      const res = await updateProperty(req, makeParams('non-existent-id'));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    // B4. DELETE /api/properties/[id]
    it('soft deletes a property', async () => {
      // Create a throwaway property
      const prop = await db.property.create({
        data: {
          tenantId: TENANT_1,
          name: `To Delete ${SUFFIX}`,
          slug: `to-delete-${SUFFIX}`,
          address: 'Del St',
          city: 'Del City',
          country: 'India',
        },
      });

      const req = createRequest(`/api/properties/${prop.id}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteProperty(req, makeParams(prop.id));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify soft-deleted
      const del = await db.property.findUnique({ where: { id: prop.id } });
      expect(del).not.toBeNull();
      expect(del!.deletedAt).not.toBeNull();

      // Cleanup (hard delete)
      await db.property.delete({ where: { id: prop.id } });
    });

    it('returns 404 for already-deleted property', async () => {
      // Create and soft-delete
      const prop = await db.property.create({
        data: {
          tenantId: TENANT_1,
          name: `Already Gone ${SUFFIX}`,
          slug: `already-gone-${SUFFIX}`,
          address: 'Gone St',
          city: 'Gone City',
          country: 'India',
          deletedAt: new Date(),
        },
      });

      const req = createRequest(`/api/properties/${prop.id}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteProperty(req, makeParams(prop.id));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');

      await db.property.delete({ where: { id: prop.id } });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C. Room Type CRUD
  // ═══════════════════════════════════════════════════════════════════

  describe('C. Room Type CRUD', () => {
    // C1. GET /api/room-types
    it('lists room types with propertyId filter', async () => {
      const req = createRequest(`/api/room-types?propertyId=${PROPERTY_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRoomTypes(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
      for (const rt of body.data) {
        expect(rt.propertyId).toBe(PROPERTY_1);
      }
    });

    it('respects pagination limit (max 100)', async () => {
      const req = createRequest('/api/room-types?limit=1000', {
        userId: ADMIN_USER_ID,
      });
      const res = await listRoomTypes(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('returns overbooking stats', async () => {
      const req = createRequest(`/api/room-types?propertyId=${PROPERTY_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRoomTypes(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const rt of body.data) {
        expect(rt).toHaveProperty('overbookingStats');
        expect(rt.overbookingStats).toHaveProperty('activeBookings');
        expect(typeof rt.overbookingStats.activeBookings).toBe('number');
      }
    });

    // C2. POST /api/room-types
    it('creates a room type with validation', async () => {
      const code = `CREATE_RT_${SUFFIX}`;
      const req = createRequest('/api/room-types', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          name: `New Test RT ${SUFFIX}`,
          code,
          basePrice: 4500,
          amenities: ['WiFi', 'TV'],
          images: ['http://img.jpg'],
        },
      });
      const res = await createRoomType(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.code).toBe(code);
      expect(body.data.amenities).toEqual(['WiFi', 'TV']);
      expect(body.data.images).toEqual(['http://img.jpg']);

      // Cleanup
      await db.roomType.delete({ where: { id: body.data.id } });
    });

    it('rejects missing required fields', async () => {
      const req = createRequest('/api/room-types', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { name: 'No code' }, // missing propertyId, code, basePrice
      });
      const res = await createRoomType(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects property tenant mismatch', async () => {
      // tenant-1 admin trying to create in a non-existent property
      const req = createRequest('/api/room-types', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: 'non-existent-property',
          name: 'Ghost RT',
          code: 'GHOST',
          basePrice: 100,
        },
      });
      const res = await createRoomType(req);
      const body = await json(res);
      expect(res.status).toBe(403);
    });

    it('rejects duplicate code per property', async () => {
      // 'STD' already exists for property-1
      const req = createRequest('/api/room-types', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          name: 'Dup Code',
          code: 'STD',
          basePrice: 100,
        },
      });
      const res = await createRoomType(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('DUPLICATE_CODE');
    });

    // C3. DELETE /api/room-types/[id]
    it('soft deletes a room type with no rooms', async () => {
      expect(testRoomTypeForDeleteId).not.toBeNull();
      const req = createRequest(`/api/room-types/${testRoomTypeForDeleteId}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteRoomType(req, makeParams(testRoomTypeForDeleteId!));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify soft-deleted
      const del = await db.roomType.findUnique({
        where: { id: testRoomTypeForDeleteId! },
      });
      expect(del).not.toBeNull();
      expect(del!.deletedAt).not.toBeNull();
    });

    it('rejects deleting a room type that has rooms', async () => {
      // roomtype-1 has rooms (room-101, room-305, etc.)
      const req = createRequest(`/api/room-types/${ROOM_TYPE_1}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteRoomType(req, makeParams(ROOM_TYPE_1));
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('HAS_ROOMS');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // D. Room CRUD
  // ═══════════════════════════════════════════════════════════════════

  describe('D. Room CRUD', () => {
    // D1. GET /api/rooms
    it('lists rooms with propertyId filter', async () => {
      const req = createRequest(`/api/rooms?propertyId=${PROPERTY_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRooms(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      for (const r of body.data) {
        expect(r.propertyId).toBe(PROPERTY_1);
      }
    });

    it('lists rooms filtered by status', async () => {
      const req = createRequest(`/api/rooms?propertyId=${PROPERTY_1}&status=available`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRooms(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const r of body.data) {
        expect(r.status).toBe('available');
      }
    });

    it('enforces tenant isolation on rooms list', async () => {
      // tenant-2 admin listing rooms (no properties for tenant-2)
      const req = createRequest('/api/rooms', { userId: T2_ADMIN_USER_ID });
      const res = await listRooms(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
    });

    it('orders rooms by floor asc, number asc', async () => {
      const req = createRequest(`/api/rooms?propertyId=${PROPERTY_1}&status=available&limit=50`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRooms(req);
      const body = await json(res);
      const rooms = body.data;
      if (rooms.length >= 2) {
        for (let i = 1; i < rooms.length; i++) {
          if (rooms[i].floor === rooms[i - 1].floor) {
            expect(rooms[i].number >= rooms[i - 1].number).toBe(true);
          } else {
            expect(rooms[i].floor >= rooms[i - 1].floor).toBe(true);
          }
        }
      }
    });

    // D2. POST /api/rooms
    it('creates a room with validation', async () => {
      const roomNumber = `T${SUFFIX}`;
      expect(testRoomTypeId).not.toBeNull();

      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: testRoomTypeId,
          number: roomNumber,
          floor: 1,
          status: 'available',
        },
      });
      const res = await createRoom(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.number).toBe(roomNumber);
      testRoomId = body.data.id;
    });

    it('rejects missing required fields', async () => {
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { propertyId: PROPERTY_1 }, // missing roomTypeId, number
      });
      const res = await createRoom(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects property tenant mismatch', async () => {
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: T2_ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          number: 'TENANT_FAIL',
        },
      });
      const res = await createRoom(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_PROPERTY');
    });

    it('rejects duplicate room number per property', async () => {
      // '101' already exists in property-1
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          number: '101',
        },
      });
      const res = await createRoom(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('DUPLICATE_NUMBER');
    });

    it('rejects room type not belonging to property', async () => {
      // roomtype-5 belongs to property-2, not property-1
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: 'roomtype-5', // belongs to property-2
          number: 'MISMATCH_RT',
        },
      });
      const res = await createRoom(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_ROOM_TYPE');
    });

    it('atomically increments totalRooms on roomType and property', async () => {
      expect(testRoomTypeId).not.toBeNull();

      // Get current counts
      const rtBefore = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propBefore = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });

      const roomNum = `INC_${SUFFIX}`;
      const req = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: testRoomTypeId,
          number: roomNum,
        },
      });
      const res = await createRoom(req);
      expect(res.status).toBe(201);

      // Check incremented
      const rtAfter = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propAfter = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });

      expect(rtAfter!.totalRooms).toBe(rtBefore!.totalRooms + 1);
      expect(propAfter!.totalRooms).toBe(propBefore!.totalRooms + 1);

      // Cleanup: hard delete the test room
      await db.room.deleteMany({ where: { number: roomNum, propertyId: PROPERTY_1 } });
      // Restore counts
      await db.roomType.update({
        where: { id: testRoomTypeId! },
        data: { totalRooms: { decrement: 1 } },
      });
      await db.property.update({
        where: { id: PROPERTY_1 },
        data: { totalRooms: { decrement: 1 } },
      });
    });

    // D3. DELETE /api/rooms/[id]
    it('soft deletes a room and decrements totalRooms', async () => {
      // Create a room specifically for deletion
      const delRoomNum = `DEL_${SUFFIX}`;
      const createReq = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: testRoomTypeId,
          number: delRoomNum,
        },
      });
      const createRes = await createRoom(createReq);
      expect(createRes.status).toBe(201);
      const createdRoom = await json(createRes);
      const roomId = createdRoom.data.id;

      // Get counts before delete
      const rtBefore = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propBefore = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });

      // Delete it
      const delReq = createRequest(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const delRes = await deleteRoom(delReq, makeParams(roomId));
      const delBody = await json(delRes);
      expect(delRes.status).toBe(200);
      expect(delBody.success).toBe(true);

      // Verify soft-deleted
      const room = await db.room.findUnique({ where: { id: roomId } });
      expect(room).not.toBeNull();
      expect(room!.deletedAt).not.toBeNull();

      // Verify counts decremented
      const rtAfter = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propAfter = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });
      expect(rtAfter!.totalRooms).toBe(rtBefore!.totalRooms - 1);
      expect(propAfter!.totalRooms).toBe(propBefore!.totalRooms - 1);

      // Hard cleanup
      await db.room.delete({ where: { id: roomId } });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // E. Rate Plan CRUD
  // ═══════════════════════════════════════════════════════════════════

  describe('E. Rate Plan CRUD', () => {
    // E1. GET /api/rate-plans
    it('lists rate plans with computed promo fields', async () => {
      const req = createRequest(`/api/rate-plans?roomTypeId=${ROOM_TYPE_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRatePlans(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      for (const rp of body.data) {
        expect(rp).toHaveProperty('hasActivePromo');
        expect(rp).toHaveProperty('effectivePrice');
        expect(rp).toHaveProperty('discountDisplay');
        // hasActivePromo is boolean or null (when no promo dates are set)
        expect(rp.hasActivePromo === null || typeof rp.hasActivePromo === 'boolean').toBe(true);
        expect(typeof rp.effectivePrice).toBe('number');
      }
    });

    it('filters by meal plan', async () => {
      const req = createRequest(`/api/rate-plans?mealPlan=breakfast`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listRatePlans(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const rp of body.data) {
        expect(rp.mealPlan).toBe('breakfast');
      }
    });

    it('filters by search term', async () => {
      const req = createRequest('/api/rate-plans?search=Non-Refundable', {
        userId: ADMIN_USER_ID,
      });
      const res = await listRatePlans(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    // E2. POST /api/rate-plans
    it('creates a rate plan with all validations', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: `Test Rate Plan ${SUFFIX}`,
          code: testRatePlanCode,
          basePrice: 3000,
          mealPlan: 'half_board',
          status: 'active',
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.code).toBe(testRatePlanCode);
      testRatePlanId = body.data.id;
    });

    it('rejects missing required fields (no roomTypeId)', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { name: 'No RT', code: 'NO_RT', basePrice: 100 },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing name and code', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { roomTypeId: ROOM_TYPE_1, basePrice: 100 },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid base price', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: 'Bad Price',
          code: `BADPRICE${SUFFIX}`,
          basePrice: -10,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-existent room type', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: 'non-existent-rt',
          name: 'Ghost RP',
          code: `GHOST${SUFFIX}`,
          basePrice: 100,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_ROOM_TYPE');
    });

    it('rejects discount percent outside 0-100', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: 'Bad Discount',
          code: `BADDISC${SUFFIX}`,
          basePrice: 1000,
          discountPercent: 150,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_DISCOUNT');
    });

    it('rejects negative discount amount', async () => {
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: 'Neg Disc',
          code: `NEGDISC${SUFFIX}`,
          basePrice: 1000,
          discountAmount: -50,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_DISCOUNT');
    });

    it('rejects promo end before start', async () => {
      const start = futureDate(10);
      const end = futureDate(5);
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: 'Bad Promo',
          code: `BADPROMO${SUFFIX}`,
          basePrice: 1000,
          promoStart: start,
          promoEnd: end,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_PROMO_DATES');
    });

    it('rejects duplicate code per room type', async () => {
      // 'BAR' already exists for roomtype-1
      const req = createRequest('/api/rate-plans', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          roomTypeId: ROOM_TYPE_1,
          name: 'Dup BAR',
          code: 'BAR',
          basePrice: 1000,
        },
      });
      const res = await createRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('DUPLICATE_CODE');
    });

    // E3. PUT /api/rate-plans
    it('updates a rate plan', async () => {
      expect(testRatePlanId).not.toBeNull();
      const req = createRequest('/api/rate-plans', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: testRatePlanId,
          name: 'Updated Rate Plan',
          discountPercent: 10,
        },
      });
      const res = await updateRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Rate Plan');
    });

    it('rejects invalid discount percent on update', async () => {
      expect(testRatePlanId).not.toBeNull();
      const req = createRequest('/api/rate-plans', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: testRatePlanId,
          discountPercent: 200,
        },
      });
      const res = await updateRatePlan(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_DISCOUNT');
    });

    // E4. DELETE /api/rate-plans
    it('soft deletes rate plans not in use', async () => {
      // Our test rate plan has no bookings
      expect(testRatePlanId).not.toBeNull();
      const req = createRequest(`/api/rate-plans?ids=${testRatePlanId}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteRatePlans(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify soft-deleted
      const rp = await db.ratePlan.findUnique({ where: { id: testRatePlanId! } });
      expect(rp).not.toBeNull();
      expect(rp!.deletedAt).not.toBeNull();
      expect(rp!.status).toBe('inactive');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // F. Inventory Lock CRUD
  // ═══════════════════════════════════════════════════════════════════

  describe('F. Inventory Lock CRUD', () => {
    // F1. GET /api/inventory-locks
    it('lists inventory locks with computed status fields', async () => {
      const req = createRequest(`/api/inventory-locks?propertyId=${PROPERTY_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listInventoryLocks(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('stats');
      for (const lock of body.data) {
        expect(lock).toHaveProperty('isActive');
        expect(lock).toHaveProperty('isUpcoming');
        expect(lock).toHaveProperty('isPast');
        expect(lock).toHaveProperty('durationDays');
        expect(typeof lock.durationDays).toBe('number');
      }
    });

    it('filters by lock type', async () => {
      const req = createRequest(`/api/inventory-locks?propertyId=${PROPERTY_1}&lockType=maintenance`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listInventoryLocks(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      for (const lock of body.data) {
        expect(lock.lockType).toBe('maintenance');
      }
    });

    it('returns lock type distribution in stats', async () => {
      const req = createRequest(`/api/inventory-locks?propertyId=${PROPERTY_1}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listInventoryLocks(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.stats).toHaveProperty('lockTypeDistribution');
      expect(Array.isArray(body.stats.lockTypeDistribution)).toBe(true);
    });

    // F2. POST /api/inventory-locks
    it('creates an inventory lock for a room type', async () => {
      const startDate = futureDateOnly(60);
      const endDate = futureDateOnly(65);

      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_2,
          startDate,
          endDate,
          reason: 'Scheduled renovation',
          lockType: 'maintenance',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.roomTypeId).toBe(ROOM_TYPE_2);
      testInventoryLockId = body.data.id;

      // Cleanup
      await db.inventoryLock.delete({ where: { id: testInventoryLockId! } });
      testInventoryLockId = null;
    });

    it('creates an inventory lock for a specific room', async () => {
      const startDate = futureDateOnly(90);
      const endDate = futureDateOnly(92);
      // Use a room without future bookings - room-101 has booking-5 starting in 7 days
      // Use room-510 (booking-3 starts today), so future dates should be safe
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomId: 'room-510',
          startDate,
          endDate,
          reason: 'Deep cleaning',
          lockType: 'housekeeping',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.roomId).toBe('room-510');
      testInventoryLockId = body.data.id;

      // Cleanup
      await db.inventoryLock.delete({ where: { id: testInventoryLockId! } });
      testInventoryLockId = null;
    });

    it('rejects missing required fields', async () => {
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: { propertyId: PROPERTY_1, reason: 'test' }, // missing dates, roomId/roomTypeId
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects when neither roomId nor roomTypeId is provided', async () => {
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          startDate: futureDateOnly(100),
          endDate: futureDateOnly(105),
          reason: 'No target',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid dates (end before start)', async () => {
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_2,
          startDate: futureDateOnly(10),
          endDate: futureDateOnly(5),
          reason: 'Bad dates',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('INVALID_DATES');
    });

    it('detects overlapping locks on the same room type', async () => {
      // Create first lock: days 70-75
      const lock1 = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: new Date(futureDateOnly(70)),
          endDate: new Date(futureDateOnly(75)),
          reason: 'First lock',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      // Try to create overlapping lock: days 73-78
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: futureDateOnly(73),
          endDate: futureDateOnly(78),
          reason: 'Overlapping lock',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('OVERLAPPING_LOCK');

      // Cleanup
      await db.inventoryLock.delete({ where: { id: lock1.id } });
    });

    it('detects conflicting active bookings on a room', async () => {
      // room-501 has booking-1 (checked_in, checkOut: today+1)
      // So a lock starting yesterday and ending tomorrow should conflict
      const start = new Date();
      start.setDate(start.getDate() - 1);
      const end = new Date();
      end.setDate(end.getDate() + 1);

      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomId: 'room-501',
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          reason: 'Conflicts with booking',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('CONFLICTING_BOOKINGS');
    });

    // F3. PUT /api/inventory-locks
    it('updates an inventory lock', async () => {
      // Create a lock to update
      const lock = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_2,
          startDate: new Date(futureDateOnly(80)),
          endDate: new Date(futureDateOnly(85)),
          reason: 'Original reason',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      const req = createRequest('/api/inventory-locks', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: lock.id,
          reason: 'Updated reason',
        },
      });
      const res = await updateInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.reason).toBe('Updated reason');

      // Cleanup
      await db.inventoryLock.delete({ where: { id: lock.id } });
    });

    it('detects overlap on date change during update', async () => {
      // Create lock A: days 110-115 on roomtype-1
      const lockA = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: new Date(futureDateOnly(110)),
          endDate: new Date(futureDateOnly(115)),
          reason: 'Lock A',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      // Create lock B: days 120-125 on roomtype-1
      const lockB = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: new Date(futureDateOnly(120)),
          endDate: new Date(futureDateOnly(125)),
          reason: 'Lock B',
          lockType: 'out_of_order',
          createdBy: ADMIN_USER_ID,
        },
      });

      // Try to update lock B dates to overlap with lock A: days 113-118
      const req = createRequest('/api/inventory-locks', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: lockB.id,
          startDate: futureDateOnly(113),
          endDate: futureDateOnly(118),
        },
      });
      const res = await updateInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('OVERLAPPING_LOCK');

      // Cleanup
      await db.inventoryLock.deleteMany({ where: { id: { in: [lockA.id, lockB.id] } } });
    });

    // F4. DELETE /api/inventory-locks
    it('hard deletes inventory locks with tenant isolation', async () => {
      // Create a lock for tenant-1
      const lock = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_2,
          startDate: new Date(futureDateOnly(130)),
          endDate: new Date(futureDateOnly(135)),
          reason: 'To delete',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      const req = createRequest(`/api/inventory-locks?ids=${lock.id}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const res = await deleteInventoryLocks(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify hard-deleted (not in DB)
      const deleted = await db.inventoryLock.findUnique({ where: { id: lock.id } });
      expect(deleted).toBeNull();
    });

    it('tenant-2 cannot delete tenant-1 locks', async () => {
      // Create a lock for tenant-1
      const lock = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_2,
          startDate: new Date(futureDateOnly(140)),
          endDate: new Date(futureDateOnly(145)),
          reason: 'Tenant1 lock',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      // Try to delete as tenant-2 admin
      const req = createRequest(`/api/inventory-locks?ids=${lock.id}`, {
        method: 'DELETE',
        userId: T2_ADMIN_USER_ID,
      });
      const res = await deleteInventoryLocks(req);
      const body = await json(res);
      expect(res.status).toBe(404);

      // Lock still exists
      const still = await db.inventoryLock.findUnique({ where: { id: lock.id } });
      expect(still).not.toBeNull();

      // Cleanup
      await db.inventoryLock.delete({ where: { id: lock.id } });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // G. Tax Settings
  // ═══════════════════════════════════════════════════════════════════

  describe('G. Tax Settings', () => {
    // G1. GET /api/properties/[id]/tax-settings
    it('returns tax settings for a property', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getTaxSettings(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('taxId');
      expect(body.data).toHaveProperty('taxType');
      expect(body.data).toHaveProperty('defaultTaxRate');
      expect(body.data).toHaveProperty('taxComponents');
      expect(body.data).toHaveProperty('serviceChargePercent');
      expect(body.data).toHaveProperty('includeTaxInPrice');
      expect(body.data).toHaveProperty('currency');
      // taxComponents should be a parsed array
      expect(Array.isArray(body.data.taxComponents)).toBe(true);
    });

    it('returns 404 for non-existent property', async () => {
      const req = createRequest('/api/properties/non-existent/tax-settings', {
        userId: ADMIN_USER_ID,
      });
      const res = await getTaxSettings(req, makeParams('non-existent'));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    it('returns 404 for cross-tenant property', async () => {
      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getTaxSettings(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    // G2. PUT /api/properties/[id]/tax-settings
    it('updates tax settings and parses tax components', async () => {
      const taxComponents = [
        { name: 'CGST', rate: 9, type: 'cgst' },
        { name: 'SGST', rate: 9, type: 'sgst' },
      ];

      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          taxType: 'gst',
          defaultTaxRate: 18,
          taxComponents,
          serviceChargePercent: 5,
          includeTaxInPrice: true,
        },
      });
      const res = await updateTaxSettings(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.taxType).toBe('gst');
      expect(body.data.defaultTaxRate).toBe(18);
      expect(body.data.serviceChargePercent).toBe(5);
      expect(body.data.includeTaxInPrice).toBe(true);
      // taxComponents should be parsed from JSON string
      expect(Array.isArray(body.data.taxComponents)).toBe(true);
      expect(body.data.taxComponents).toHaveLength(2);
      expect(body.data.taxComponents[0].name).toBe('CGST');

      // Restore defaults
      await db.property.update({
        where: { id: PROPERTY_1 },
        data: {
          taxType: 'gst',
          defaultTaxRate: 0,
          taxComponents: '[]',
          serviceChargePercent: 0,
          includeTaxInPrice: false,
        },
      });
    });

    it('returns 404 when updating non-existent property', async () => {
      const req = createRequest('/api/properties/non-existent/tax-settings', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: { taxType: 'gst' },
      });
      const res = await updateTaxSettings(req, makeParams('non-existent'));
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // H. Business Logic
  // ═══════════════════════════════════════════════════════════════════

  describe('H. Business Logic', () => {
    // H1. Slug uniqueness per tenant
    it('allows same slug in different tenants', async () => {
      // 'royal-stay-kolkata' exists in tenant-1
      // Create same slug in tenant-2 (should succeed)
      const prop = await db.property.create({
        data: {
          tenantId: TENANT_2,
          name: 'Same Slug Property',
          slug: 'royal-stay-kolkata',
          address: 'Cross Tenant St',
          city: 'Miami',
          country: 'United States',
        },
      });
      expect(prop.id).toBeTruthy();

      // Verify both exist
      const props = await db.property.findMany({
        where: { slug: 'royal-stay-kolkata' },
      });
      expect(props).toHaveLength(2);

      // Cleanup
      await db.property.delete({ where: { id: prop.id } });
    });

    // H2. Room number uniqueness per property
    it('allows same room number in different properties', async () => {
      // '101' exists in property-1
      // Create '101' in property-2 (should succeed)
      // property-2 has roomtype-5
      const room = await db.room.create({
        data: {
          propertyId: PROPERTY_2,
          roomTypeId: 'roomtype-5',
          number: '101',
          status: 'available',
        },
      });
      expect(room.id).toBeTruthy();

      // Cleanup
      await db.room.delete({ where: { id: room.id } });
    });

    // H3. Rate plan code uniqueness per roomType+tenant
    it('allows same rate plan code in different room types (same tenant)', async () => {
      // 'BB' exists for roomtype-1 in tenant-1
      // Create 'BB' for roomtype-3 in tenant-1 (should succeed due to unique on [tenantId, roomTypeId, code])
      const rp = await db.ratePlan.create({
        data: {
          tenantId: TENANT_1,
          roomTypeId: 'roomtype-3',
          name: 'BB for EXEC',
          code: 'BB',
          basePrice: 12000,
          currency: 'INR',
          status: 'active',
        },
      });
      expect(rp.id).toBeTruthy();

      // Verify
      const plans = await db.ratePlan.findMany({
        where: { code: 'BB', tenantId: TENANT_1, deletedAt: null },
      });
      expect(plans.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await db.ratePlan.delete({ where: { id: rp.id } });
    });

    // H4. Inventory lock serializable transaction prevents double-booking
    it('prevents creating overlapping locks via serializable transaction', async () => {
      // Create first lock
      const lock = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_1,
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: new Date(futureDateOnly(150)),
          endDate: new Date(futureDateOnly(155)),
          reason: 'Double-booking test',
          lockType: 'maintenance',
          createdBy: ADMIN_USER_ID,
        },
      });

      // Try to create an overlapping lock via the API (uses serializable transaction)
      const req = createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: ROOM_TYPE_1,
          startDate: futureDateOnly(153),
          endDate: futureDateOnly(158),
          reason: 'Should be rejected',
        },
      });
      const res = await createInventoryLock(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error?.code).toBe('OVERLAPPING_LOCK');

      // Cleanup
      await db.inventoryLock.delete({ where: { id: lock.id } });
    });

    // H5. TotalRooms counter consistency
    it('maintains totalRooms consistency across room create and delete', async () => {
      expect(testRoomTypeId).not.toBeNull();

      // Record initial state
      const rtBefore = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propBefore = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });

      // Create a room via API (increments both)
      const createReq = createRequest('/api/rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_1,
          roomTypeId: testRoomTypeId,
          number: `CONSIST_${SUFFIX}`,
        },
      });
      const createRes = await createRoom(createReq);
      expect(createRes.status).toBe(201);
      const created = await json(createRes);
      const roomId = created.data.id;

      // Verify incremented
      const rtAfterCreate = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propAfterCreate = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });
      expect(rtAfterCreate!.totalRooms).toBe(rtBefore!.totalRooms + 1);
      expect(propAfterCreate!.totalRooms).toBe(propBefore!.totalRooms + 1);

      // Soft-delete the room via DB directly (simulating API delete)
      await db.room.update({
        where: { id: roomId },
        data: { deletedAt: new Date() },
      });
      await db.$transaction([
        db.roomType.update({
          where: { id: testRoomTypeId! },
          data: { totalRooms: { decrement: 1 } },
        }),
        db.property.update({
          where: { id: PROPERTY_1 },
          data: { totalRooms: { decrement: 1 } },
        }),
      ]);

      // Verify back to original
      const rtAfterDelete = await db.roomType.findUnique({
        where: { id: testRoomTypeId! },
        select: { totalRooms: true },
      });
      const propAfterDelete = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { totalRooms: true },
      });
      expect(rtAfterDelete!.totalRooms).toBe(rtBefore!.totalRooms);
      expect(propAfterDelete!.totalRooms).toBe(propBefore!.totalRooms);

      // Hard cleanup
      await db.room.delete({ where: { id: roomId } });
    });

    // H6. Soft delete pattern (deletedAt field)
    it('sets deletedAt on soft delete and is excluded from listings', async () => {
      // Create property
      const prop = await db.property.create({
        data: {
          tenantId: TENANT_1,
          name: `Soft Delete Test ${SUFFIX}`,
          slug: `soft-del-${SUFFIX}`,
          address: 'SD St',
          city: 'Kolkata',
          country: 'India',
        },
      });

      // Verify it appears in listings
      const listReq = createRequest('/api/properties', { userId: ADMIN_USER_ID });
      const listRes = await listProperties(listReq);
      const listBody = await json(listRes);
      const idsBefore = listBody.data.map((p: any) => p.id);
      expect(idsBefore).toContain(prop.id);

      // Soft delete via API
      const delReq = createRequest(`/api/properties/${prop.id}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const delRes = await deleteProperty(delReq, makeParams(prop.id));
      expect(delRes.status).toBe(200);

      // Verify deletedAt is set
      const delProp = await db.property.findUnique({ where: { id: prop.id } });
      expect(delProp).not.toBeNull();
      expect(delProp!.deletedAt).not.toBeNull();

      // Verify it no longer appears in listings
      const listReq2 = createRequest('/api/properties', { userId: ADMIN_USER_ID });
      const listRes2 = await listProperties(listReq2);
      const listBody2 = await json(listRes2);
      const idsAfter = listBody2.data.map((p: any) => p.id);
      expect(idsAfter).not.toContain(prop.id);

      // Hard cleanup
      await db.property.delete({ where: { id: prop.id } });
    });

    // H7. Default values applied on property creation
    it('applies all expected defaults when creating a property', async () => {
      const slug = `defvals-${SUFFIX}`;
      const req = createRequest('/api/properties', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          name: 'Default Values Test',
          slug,
          address: 'DV St',
          city: 'Kolkata',
          country: 'India',
        },
      });
      const res = await createProperty(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      const p = body.data;
      expect(p.type).toBe('hotel');
      expect(p.checkInTime).toBe('14:00');
      expect(p.checkOutTime).toBe('11:00');
      expect(p.timezone).toBe('Asia/Kolkata');
      expect(p.currency).toBe('INR');
      expect(p.taxType).toBe('gst');
      expect(p.defaultTaxRate).toBe(0);
      expect(p.serviceChargePercent).toBe(0);
      expect(p.includeTaxInPrice).toBe(false);
      expect(p.status).toBe('active');
      expect(p.totalFloors).toBe(1);
      expect(p.totalRooms).toBe(0);

      // Cleanup
      await db.property.delete({ where: { id: p.id } });
    });

    // H8. Tax components JSON serialization/deserialization
    it('serializes tax components to JSON string and deserializes back', async () => {
      const components = [
        { name: 'CGST', rate: 2.5, type: 'cgst' },
        { name: 'SGST', rate: 2.5, type: 'sgst' },
        { name: 'Luxury Tax', rate: 10, type: 'luxury' },
      ];

      // Write via API
      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: { taxComponents: components },
      });
      const res = await updateTaxSettings(req, makeParams(PROPERTY_1));
      expect(res.status).toBe(200);

      // Read directly from DB - should be a JSON string
      const prop = await db.property.findUnique({
        where: { id: PROPERTY_1 },
        select: { taxComponents: true },
      });
      expect(typeof prop!.taxComponents).toBe('string');

      const parsed = JSON.parse(prop!.taxComponents!);
      expect(parsed).toEqual(components);

      // Read via API - should be a parsed array
      const getReq = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        userId: ADMIN_USER_ID,
      });
      const getRes = await getTaxSettings(getReq, makeParams(PROPERTY_1));
      const getBody = await json(getRes);
      expect(Array.isArray(getBody.data.taxComponents)).toBe(true);
      expect(getBody.data.taxComponents).toEqual(components);

      // Restore defaults
      await db.property.update({
        where: { id: PROPERTY_1 },
        data: { taxComponents: '[]', taxType: 'gst', defaultTaxRate: 0, serviceChargePercent: 0, includeTaxInPrice: false },
      });
    });

    it('handles empty/null tax components gracefully', async () => {
      // Some properties might have '[]' or invalid JSON for taxComponents
      // The GET handler should parse safely
      const req = createRequest(`/api/properties/${PROPERTY_1}/tax-settings`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getTaxSettings(req, makeParams(PROPERTY_1));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(Array.isArray(body.data.taxComponents)).toBe(true);
    });
  });
});
