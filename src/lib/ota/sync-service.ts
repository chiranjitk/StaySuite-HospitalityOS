/**
 * OTA Sync Service
 * Handles synchronization between StaySuite and OTA channels
 */

import { db } from '@/lib/db';
import { OTAClientFactory, getAllOTAs, getOTAConfig } from './client-factory';
import {
  OTACredentials,
  OTASyncType,
  OTAInventoryUpdate,
  OTARateUpdate,
  OTARestrictionUpdate,
  OTASyncLog,
} from './types';

// ============================================
// SYNC SERVICE CLASS
// ============================================

export class OTASyncService {
  /**
   * Sync inventory to all active channels
   */
  static async syncInventory(
    tenantId: string,
    propertyId: string,
    updates: OTAInventoryUpdate[]
  ): Promise<void> {
    const connections = await this.getActiveConnections(tenantId, propertyId, 'inventory');
    
    await Promise.allSettled(
      connections.map(connection => this.syncInventoryToChannel(connection.id, updates))
    );
  }

  /**
   * Sync inventory to a specific channel
   */
  static async syncInventoryToChannel(
    connectionId: string,
    updates: OTAInventoryUpdate[]
  ): Promise<void> {
    const connection = await db.channelConnection.findUnique({
      where: { id: connectionId },
      include: { channelMappings: true },
    });

    if (!connection || connection.status !== 'active') {
      return;
    }

    const correlationId = `inv-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
    const startedAt = new Date();

    try {
      // Create sync log
      await this.createSyncLog({
        connectionId,
        syncType: 'inventory',
        direction: 'outbound',
        status: 'processing',
        correlationId,
        startedAt,
        recordsProcessed: 0,
        recordsFailed: 0,
        attemptCount: 1,
      });

      // Get client and sync
      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        throw new Error(`Unknown channel: ${connection.channel}`);
      }

      // Map internal room types to external
      const mappedUpdates = this.mapInventoryUpdates(updates, connection.channelMappings);

      // Connect to channel
      await client.connect({
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        hotelId: connection.hotelId || undefined,
      });

      // Sync
      const result = await client.updateInventory(mappedUpdates);

      // Update sync log
      await this.updateSyncLog(correlationId, {
        status: result.success ? 'success' : 'partial',
        statusCode: 200,
        recordsProcessed: updates.length,
        recordsFailed: result.results?.[0]?.failed || 0,
        errorMessage: result.errors?.map(e => e.message).join('; '),
        completedAt: new Date(),
        responsePayload: JSON.stringify(result),
      });

      // Update connection last sync
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastError: result.success ? null : result.errors?.[0]?.message,
        },
      });
    } catch (error) {
      // Update sync log with error
      await this.updateSyncLog(correlationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        recordsFailed: updates.length,
      });

      // Update connection error
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : 'Sync failed',
        },
      });

      throw error;
    }
  }

  /**
   * Sync rates to all active channels
   */
  static async syncRates(
    tenantId: string,
    propertyId: string,
    updates: OTARateUpdate[]
  ): Promise<void> {
    const connections = await this.getActiveConnections(tenantId, propertyId, 'rates');
    
    await Promise.allSettled(
      connections.map(connection => this.syncRatesToChannel(connection.id, updates))
    );
  }

  /**
   * Sync rates to a specific channel
   */
  static async syncRatesToChannel(
    connectionId: string,
    updates: OTARateUpdate[]
  ): Promise<void> {
    const connection = await db.channelConnection.findUnique({
      where: { id: connectionId },
      include: { channelMappings: true },
    });

    if (!connection || connection.status !== 'active') {
      return;
    }

    const correlationId = `rate-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
    const startedAt = new Date();

    try {
      await this.createSyncLog({
        connectionId,
        syncType: 'rates',
        direction: 'outbound',
        status: 'processing',
        correlationId,
        startedAt,
        recordsProcessed: 0,
        recordsFailed: 0,
        attemptCount: 1,
      });

      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        throw new Error(`Unknown channel: ${connection.channel}`);
      }

      const mappedUpdates = this.mapRateUpdates(updates, connection.channelMappings);

      await client.connect({
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        hotelId: connection.hotelId || undefined,
      });

      const result = await client.updateRates(mappedUpdates);

      await this.updateSyncLog(correlationId, {
        status: result.success ? 'success' : 'partial',
        statusCode: 200,
        recordsProcessed: updates.length,
        recordsFailed: result.results?.[0]?.failed || 0,
        errorMessage: result.errors?.map(e => e.message).join('; '),
        completedAt: new Date(),
        responsePayload: JSON.stringify(result),
      });

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastError: result.success ? null : result.errors?.[0]?.message,
        },
      });
    } catch (error) {
      await this.updateSyncLog(correlationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        recordsFailed: updates.length,
      });

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : 'Sync failed',
        },
      });

      throw error;
    }
  }

  /**
   * Sync restrictions to all active channels
   */
  static async syncRestrictions(
    tenantId: string,
    propertyId: string,
    updates: OTARestrictionUpdate[]
  ): Promise<void> {
    const connections = await this.getActiveConnections(tenantId, propertyId, 'restrictions');
    
    await Promise.allSettled(
      connections.map(connection => this.syncRestrictionsToChannel(connection.id, updates))
    );
  }

  /**
   * Sync restrictions to a specific channel
   */
  static async syncRestrictionsToChannel(
    connectionId: string,
    updates: OTARestrictionUpdate[]
  ): Promise<void> {
    const connection = await db.channelConnection.findUnique({
      where: { id: connectionId },
      include: { channelMappings: true },
    });

    if (!connection || connection.status !== 'active') {
      return;
    }

    const correlationId = `rest-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
    const startedAt = new Date();

    try {
      await this.createSyncLog({
        connectionId,
        syncType: 'restrictions',
        direction: 'outbound',
        status: 'processing',
        correlationId,
        startedAt,
        recordsProcessed: 0,
        recordsFailed: 0,
        attemptCount: 1,
      });

      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        throw new Error(`Unknown channel: ${connection.channel}`);
      }

      const mappedUpdates = this.mapRestrictionUpdates(updates, connection.channelMappings);

      await client.connect({
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        hotelId: connection.hotelId || undefined,
      });

      const result = await client.updateRestrictions(mappedUpdates);

      await this.updateSyncLog(correlationId, {
        status: result.success ? 'success' : 'partial',
        statusCode: 200,
        recordsProcessed: updates.length,
        recordsFailed: result.results?.[0]?.failed || 0,
        errorMessage: result.errors?.map(e => e.message).join('; '),
        completedAt: new Date(),
        responsePayload: JSON.stringify(result),
      });

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastError: result.success ? null : result.errors?.[0]?.message,
        },
      });
    } catch (error) {
      await this.updateSyncLog(correlationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        recordsFailed: updates.length,
      });

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : 'Sync failed',
        },
      });

      throw error;
    }
  }

  /**
   * Pull bookings from all active channels
   */
  static async pullBookings(
    tenantId: string,
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const connections = await this.getActiveConnections(tenantId, propertyId, 'bookings');

    await Promise.allSettled(
      connections.map(connection => 
        this.pullBookingsFromChannel(connection.id, startDate, endDate)
      )
    );
  }

  /**
   * Pull bookings from a specific channel
   */
  static async pullBookingsFromChannel(
    connectionId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const connection = await db.channelConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.status !== 'active') {
      return;
    }

    const correlationId = `book-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
    const startedAt = new Date();

    try {
      await this.createSyncLog({
        connectionId,
        syncType: 'bookings',
        direction: 'inbound',
        status: 'processing',
        correlationId,
        startedAt,
        recordsProcessed: 0,
        recordsFailed: 0,
        attemptCount: 1,
      });

      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        throw new Error(`Unknown channel: ${connection.channel}`);
      }

      await client.connect({
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        hotelId: connection.hotelId || undefined,
      });

      const bookings = await client.getBookings(startDate, endDate);

      // Process each booking
      let processed = 0;
      let failed = 0;

      for (const booking of bookings) {
        try {
          await this.processIncomingBooking(connection.tenantId, connection.id, booking);
          processed++;
        } catch {
          failed++;
        }
      }

      await this.updateSyncLog(correlationId, {
        status: failed > 0 ? 'partial' : 'success',
        statusCode: 200,
        recordsProcessed: processed,
        recordsFailed: failed,
        completedAt: new Date(),
        responsePayload: JSON.stringify({ totalBookings: bookings.length }),
      });

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
        },
      });
    } catch (error) {
      await this.updateSyncLog(correlationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        recordsFailed: 0,
      });

      throw error;
    }
  }

  /**
   * Process incoming booking from OTA
   */
  private static async processIncomingBooking(
    tenantId: string,
    channelId: string,
    bookingData: any
  ): Promise<void> {
    // Check if booking already exists
    const existingBooking = await db.booking.findFirst({
      where: {
        tenantId,
        externalRef: bookingData.externalBookingId || bookingData.reservationId,
      },
    });

    if (existingBooking) {
      // Update existing booking
      await db.booking.update({
        where: { id: existingBooking.id },
        data: {
          // Update booking data
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new booking
      // First find or create guest
      let guest = await db.guest.findFirst({
        where: {
          tenantId,
          email: bookingData.guest?.email,
        },
      });

      if (!guest) {
        guest = await db.guest.create({
          data: {
            tenantId,
            firstName: bookingData.guest?.firstName || 'Unknown',
            lastName: bookingData.guest?.lastName || 'Guest',
            email: bookingData.guest?.email,
            phone: bookingData.guest?.phone,
            country: bookingData.guest?.country,
            source: bookingData.source || channelId,
          },
        });
      }

      // Find room type from mapping
      const mapping = await db.channelMapping.findFirst({
        where: {
          connection: { id: channelId },
          externalRoomId: bookingData.room?.externalRoomId,
        },
      });

      // Create booking
      await db.booking.create({
        data: {
          tenantId,
          propertyId: mapping?.roomTypeId || '', // Need to get from mapping
          confirmationCode: `OTA-${Date.now().toString(36).toUpperCase()}`,
          externalRef: bookingData.externalBookingId || bookingData.reservationId,
          primaryGuestId: guest.id,
          roomTypeId: mapping?.roomTypeId || '',
          checkIn: new Date(bookingData.dates?.checkIn),
          checkOut: new Date(bookingData.dates?.checkOut),
          adults: bookingData.guests?.adults || 1,
          children: bookingData.guests?.children || 0,
          roomRate: bookingData.pricing?.roomRate || 0,
          taxes: bookingData.pricing?.taxes || 0,
          fees: bookingData.pricing?.fees || 0,
          discount: bookingData.pricing?.discount || 0,
          totalAmount: bookingData.pricing?.totalAmount || 0,
          currency: bookingData.pricing?.currency || 'USD',
          source: bookingData.source || channelId,
          channelId,
          status: 'confirmed',
          specialRequests: bookingData.specialRequests,
        },
      });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static async getActiveConnections(
    tenantId: string,
    propertyId: string,
    syncType: 'inventory' | 'rates' | 'restrictions' | 'bookings'
  ) {
    return db.channelConnection.findMany({
      where: {
        tenantId,
        status: 'active',
        autoSync: true,
      },
    });
  }

  private static async createSyncLog(data: {
    connectionId: string;
    syncType: OTASyncType;
    direction: string;
    status: string;
    correlationId: string;
    startedAt: Date;
    recordsProcessed: number;
    recordsFailed: number;
    attemptCount: number;
    requestPayload?: string;
  }) {
    return db.channelSyncLog.create({
      data: {
        connectionId: data.connectionId,
        syncType: data.syncType,
        direction: data.direction,
        status: data.status,
        correlationId: data.correlationId,
        attemptCount: data.attemptCount,
      },
    });
  }

  private static async updateSyncLog(
    correlationId: string,
    data: Partial<{
      status: string;
      statusCode: number;
      recordsProcessed: number;
      recordsFailed: number;
      errorMessage: string;
      completedAt: Date;
      responsePayload: string;
    }>
  ) {
    return db.channelSyncLog.updateMany({
      where: { correlationId },
      data,
    });
  }

  private static mapInventoryUpdates(
    updates: OTAInventoryUpdate[],
    mappings: any[]
  ): OTAInventoryUpdate[] {
    return updates.map(update => {
      const mapping = mappings.find(m => m.roomTypeId === update.roomTypeId);
      return {
        ...update,
        externalRoomId: mapping?.externalRoomId || update.externalRoomId,
      };
    });
  }

  private static mapRateUpdates(
    updates: OTARateUpdate[],
    mappings: any[]
  ): OTARateUpdate[] {
    return updates.map(update => {
      const mapping = mappings.find(
        m => m.roomTypeId === update.roomTypeId && m.ratePlanId === update.ratePlanId
      );
      return {
        ...update,
        externalRoomId: mapping?.externalRoomId || update.externalRoomId,
        externalRatePlanId: mapping?.externalRateId || update.externalRatePlanId,
      };
    });
  }

  private static mapRestrictionUpdates(
    updates: OTARestrictionUpdate[],
    mappings: any[]
  ): OTARestrictionUpdate[] {
    return updates.map(update => {
      const mapping = mappings.find(m => m.roomTypeId === update.roomTypeId);
      return {
        ...update,
        externalRoomId: mapping?.externalRoomId || update.externalRoomId,
      };
    });
  }
}

// ============================================
// SCHEDULED SYNC JOBS
// ============================================

export class OTASyncScheduler {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start scheduled sync for a connection
   */
  static startScheduledSync(connectionId: string, intervalMinutes: number): void {
    // Stop existing if any
    this.stopScheduledSync(connectionId);

    const intervalMs = intervalMinutes * 60 * 1000;
    const interval = setInterval(async () => {
      try {
        await OTASyncService.pullBookingsFromChannel(
          connectionId,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Next year
        );
      } catch (error) {
        console.error(`Scheduled sync failed for ${connectionId}:`, error);
      }
    }, intervalMs);

    this.intervals.set(connectionId, interval);
  }

  /**
   * Stop scheduled sync for a connection
   */
  static stopScheduledSync(connectionId: string): void {
    const interval = this.intervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(connectionId);
    }
  }

  /**
   * Stop all scheduled syncs
   */
  static stopAll(): void {
    for (const [id] of this.intervals) {
      this.stopScheduledSync(id);
    }
  }
}
