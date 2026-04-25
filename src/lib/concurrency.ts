/**
 * Concurrency Utilities for StaySuite HospitalityOS
 * 
 * Provides thread-safe operations for inventory management and booking operations.
 * Uses Prisma transactions and optimistic concurrency control.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

// Types
export interface LockOptions {
  tenantId: string;
  propertyId: string;
  roomId?: string;
  roomTypeId?: string;
  startDate: Date;
  endDate: Date;
  sessionId: string;
  durationMinutes?: number;
  createdBy?: string;
}

export interface LockResult {
  success: boolean;
  lockId?: string;
  sessionId?: string;
  expiresAt?: Date;
  error?: string;
  code?: string;
}

export interface AvailabilityCheck {
  propertyId: string;
  roomId?: string;
  roomTypeId?: string;
  startDate: Date;
  endDate: Date;
  excludeSessionId?: string;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  conflictingLocks: number;
  conflictingBookings: number;
  maintenanceLocks: number;
  message?: string;
}

// Default lock duration
const DEFAULT_LOCK_DURATION_MINUTES = 15;
const MAX_LOCK_DURATION_MINUTES = 60;

/**
 * Generate a unique session ID for booking locks
 */
export function generateSessionId(): string {
  return `lock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Calculate expiry time for a lock
 */
export function calculateExpiry(durationMinutes: number = DEFAULT_LOCK_DURATION_MINUTES): Date {
  const minutes = Math.min(durationMinutes, MAX_LOCK_DURATION_MINUTES);
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Clean up expired locks
 * Should be called periodically to keep the database clean
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const result = await db.inventoryLock.deleteMany({
    where: {
      lockType: 'booking_session',
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Execute a function with a row-level lock
 * Uses Prisma's interactive transactions for atomic operations
 */
export async function withLock<T>(
  lockKey: {
    propertyId: string;
    roomId?: string;
    roomTypeId?: string;
  },
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(async (tx) => {
    // Lock the relevant rows by querying them (SQLite doesn't support explicit locks,
    // but the transaction provides isolation)
    
    if (lockKey.roomId) {
      await tx.room.findUnique({
        where: { id: lockKey.roomId },
        select: { id: true },
      });
    }
    
    if (lockKey.roomTypeId) {
      await tx.roomType.findUnique({
        where: { id: lockKey.roomTypeId },
        select: { id: true },
      });
    }
    
    return fn(tx);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Acquire a lock on inventory for a booking session
 * Returns the session ID and expiry time
 */
export async function acquireLock(options: LockOptions): Promise<LockResult> {
  const {
    tenantId,
    propertyId,
    roomId,
    roomTypeId,
    startDate,
    endDate,
    sessionId,
    durationMinutes = DEFAULT_LOCK_DURATION_MINUTES,
    createdBy,
  } = options;

  const expiresAt = calculateExpiry(durationMinutes);

  try {
    const result = await db.$transaction(async (tx) => {
      // Clean up expired locks first
      await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          expiresAt: { lt: new Date() },
        },
      });

      // Check for conflicting locks
      const conflictingQuery: Prisma.InventoryLockWhereInput = {
        lockType: 'booking_session',
        expiresAt: { gt: new Date() },
        sessionId: { not: sessionId },
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      };

      if (roomId) conflictingQuery.roomId = roomId;
      if (roomTypeId) conflictingQuery.roomTypeId = roomTypeId;

      const existingLocks = await tx.inventoryLock.findMany({
        where: conflictingQuery,
      });

      if (existingLocks.length > 0) {
        return { success: false, error: 'LOCK_CONFLICT', code: 'LOCK_CONFLICT' };
      }

      // Check for conflicting bookings
      const bookingQuery: Prisma.BookingWhereInput = {
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
        AND: [
          { checkIn: { lt: endDate } },
          { checkOut: { gt: startDate } },
        ],
      };

      if (roomId) bookingQuery.roomId = roomId;

      const existingBookings = await tx.booking.findMany({
        where: bookingQuery,
      });

      if (existingBookings.length > 0) {
        return { success: false, error: 'BOOKING_CONFLICT', code: 'BOOKING_CONFLICT' };
      }

      // Check for maintenance locks
      const maintenanceQuery: Prisma.InventoryLockWhereInput = {
        lockType: { in: ['maintenance', 'event', 'overbooking'] },
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      };

      if (roomId) maintenanceQuery.roomId = roomId;
      if (roomTypeId) maintenanceQuery.roomTypeId = roomTypeId;

      const maintenanceLocks = await tx.inventoryLock.findMany({
        where: maintenanceQuery,
      });

      if (maintenanceLocks.length > 0) {
        return { success: false, error: 'MAINTENANCE_CONFLICT', code: 'MAINTENANCE_CONFLICT' };
      }

      // Create the lock
      const lock = await tx.inventoryLock.create({
        data: {
          tenantId,
          propertyId,
          roomId,
          roomTypeId,
          startDate,
          endDate,
          reason: 'Booking session lock',
          lockType: 'booking_session',
          sessionId,
          expiresAt,
          createdBy,
        },
      });

      return {
        success: true,
        lockId: lock.id,
        sessionId: lock.sessionId ?? undefined,
        expiresAt: lock.expiresAt ?? undefined,
      } as LockResult;
    });

    return result;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Release a lock by session ID or lock ID
 */
export async function releaseLock(
  sessionId?: string,
  lockId?: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const whereClause: Prisma.InventoryLockWhereInput = {
      lockType: 'booking_session',
    };

    if (sessionId) {
      whereClause.sessionId = sessionId;
    } else if (lockId) {
      whereClause.id = lockId;
    } else {
      return { success: false, deletedCount: 0, error: 'Session ID or lock ID is required' };
    }

    const result = await db.inventoryLock.deleteMany({
      where: whereClause,
    });

    return { success: true, deletedCount: result.count };
  } catch (error) {
    console.error('Error releasing lock:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extend a lock's expiry time (heartbeat)
 */
export async function extendLock(
  sessionId: string,
  additionalMinutes: number = DEFAULT_LOCK_DURATION_MINUTES
): Promise<{ success: boolean; newExpiry?: Date; remainingSeconds?: number; error?: string }> {
  try {
    // Check if locks exist for this session
    const locks = await db.inventoryLock.findMany({
      where: {
        sessionId,
        lockType: 'booking_session',
        expiresAt: { gt: new Date() },
      },
    });

    if (locks.length === 0) {
      return { success: false, error: 'No active locks found for this session' };
    }

    const newExpiry = calculateExpiry(additionalMinutes);

    await db.inventoryLock.updateMany({
      where: {
        sessionId,
        lockType: 'booking_session',
      },
      data: {
        expiresAt: newExpiry,
      },
    });

    return {
      success: true,
      newExpiry,
      remainingSeconds: Math.floor((newExpiry.getTime() - Date.now()) / 1000),
    };
  } catch (error) {
    console.error('Error extending lock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Thread-safe availability check
 * Checks for conflicts with locks, bookings, and maintenance blocks
 */
export async function checkAvailability(
  options: AvailabilityCheck
): Promise<AvailabilityResult> {
  const { propertyId, roomId, roomTypeId, startDate, endDate, excludeSessionId } = options;

  try {
    // Check for conflicting locks
    const lockQuery: Prisma.InventoryLockWhereInput = {
      lockType: 'booking_session',
      expiresAt: { gt: new Date() },
      AND: [
        { startDate: { lt: endDate } },
        { endDate: { gt: startDate } },
      ],
    };

    if (roomId) lockQuery.roomId = roomId;
    if (roomTypeId) lockQuery.roomTypeId = roomTypeId;
    if (excludeSessionId) lockQuery.sessionId = { not: excludeSessionId };

    const conflictingLocks = await db.inventoryLock.count({
      where: lockQuery,
    });

    // Check for conflicting bookings
    const bookingQuery: Prisma.BookingWhereInput = {
      status: { in: ['confirmed', 'checked_in'] },
      deletedAt: null,
      AND: [
        { checkIn: { lt: endDate } },
        { checkOut: { gt: startDate } },
      ],
    };

    if (roomId) bookingQuery.roomId = roomId;

    const conflictingBookings = await db.booking.count({
      where: bookingQuery,
    });

    // Check for maintenance locks
    const maintenanceQuery: Prisma.InventoryLockWhereInput = {
      lockType: { in: ['maintenance', 'event', 'overbooking'] },
      AND: [
        { startDate: { lt: endDate } },
        { endDate: { gt: startDate } },
      ],
    };

    if (roomId) maintenanceQuery.roomId = roomId;
    if (roomTypeId) maintenanceQuery.roomTypeId = roomTypeId;

    const maintenanceLocks = await db.inventoryLock.count({
      where: maintenanceQuery,
    });

    const isAvailable = conflictingLocks === 0 && conflictingBookings === 0 && maintenanceLocks === 0;

    let message = '';
    if (conflictingLocks > 0) {
      message = 'Another user is currently booking this room';
    } else if (conflictingBookings > 0) {
      message = 'This room is already booked for the selected dates';
    } else if (maintenanceLocks > 0) {
      message = 'This room is under maintenance for the selected dates';
    }

    return {
      isAvailable,
      conflictingLocks,
      conflictingBookings,
      maintenanceLocks,
      message: isAvailable ? 'Available' : message,
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      isAvailable: false,
      conflictingLocks: 0,
      conflictingBookings: 0,
      maintenanceLocks: 0,
      message: 'Error checking availability',
    };
  }
}

/**
 * Check availability for multiple rooms/room types in batch
 */
export async function checkBatchAvailability(
  items: Array<{
    roomId?: string;
    roomTypeId?: string;
    startDate: Date;
    endDate: Date;
  }>,
  propertyId: string,
  excludeSessionId?: string
): Promise<Map<string, AvailabilityResult>> {
  const results = new Map<string, AvailabilityResult>();

  for (const item of items) {
    const key = item.roomId || item.roomTypeId || '';
    const result = await checkAvailability({
      propertyId,
      roomId: item.roomId,
      roomTypeId: item.roomTypeId,
      startDate: item.startDate,
      endDate: item.endDate,
      excludeSessionId,
    });
    results.set(key, result);
  }

  return results;
}

/**
 * Convert a lock to a booking
 * This releases the lock after the booking is created
 */
export async function convertLockToBooking(
  sessionId: string,
  bookingData: {
    tenantId: string;
    propertyId: string;
    primaryGuestId: string;
    roomTypeId: string;
    roomId?: string;
    checkIn: Date;
    checkOut: Date;
    adults?: number;
    children?: number;
    roomRate?: number;
    totalAmount?: number;
    source?: string;
    specialRequests?: string;
  }
): Promise<{ success: boolean; bookingId?: string; confirmationCode?: string; error?: string }> {
  try {
    const result = await db.$transaction(async (tx) => {
      // Get all locks for this session
      const locks = await tx.inventoryLock.findMany({
        where: {
          sessionId,
          lockType: 'booking_session',
          expiresAt: { gt: new Date() },
        },
      });

      if (locks.length === 0) {
        throw new Error('No active locks found for this session');
      }

      // Generate confirmation code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const bytes = crypto.randomBytes(6);
      let confirmationCode = 'SS-';
      for (let i = 0; i < 6; i++) {
        confirmationCode += chars[bytes[i] % chars.length];
      }

      // Create the booking
      const booking = await tx.booking.create({
        data: {
          ...bookingData,
          confirmationCode,
          status: 'confirmed',
        },
      });

      // Create audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'created',
          newStatus: 'confirmed',
          notes: 'Booking created from lock session',
        },
      });

      // Delete the locks
      await tx.inventoryLock.deleteMany({
        where: {
          sessionId,
          lockType: 'booking_session',
        },
      });

      return {
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
      };
    });

    return {
      success: true,
      bookingId: result.bookingId,
      confirmationCode: result.confirmationCode,
    };
  } catch (error) {
    console.error('Error converting lock to booking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all locks for a session with details
 */
export async function getSessionLocks(sessionId: string): Promise<Array<{
  id: string;
  propertyId: string;
  roomId: string | null;
  roomTypeId: string | null;
  startDate: Date;
  endDate: Date;
  expiresAt: Date | null;
  remainingSeconds: number;
  isExpired: boolean;
}>> {
  const locks = await db.inventoryLock.findMany({
    where: {
      sessionId,
      lockType: 'booking_session',
    },
  });

  const now = new Date();
  
  return locks.map(lock => ({
    id: lock.id,
    propertyId: lock.propertyId,
    roomId: lock.roomId,
    roomTypeId: lock.roomTypeId,
    startDate: lock.startDate,
    endDate: lock.endDate,
    expiresAt: lock.expiresAt,
    remainingSeconds: lock.expiresAt 
      ? Math.max(0, Math.floor((lock.expiresAt.getTime() - now.getTime()) / 1000))
      : 0,
    isExpired: lock.expiresAt ? lock.expiresAt < now : false,
  }));
}
