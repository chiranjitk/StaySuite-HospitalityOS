/**
 * WiFi Auto-Provisioning Service
 * 
 * Automatically provisions and deprovisions WiFi access based on booking events.
 * This service connects booking state changes to the WiFi module.
 * 
 * Flow:
 * - Check-in → Create WiFiUser with credentials → Sync to FreeRADIUS
 * - Check-out → Disable WiFiUser → Update FreeRADIUS
 * 
 * DO: Automatically provision WiFi on check-in
 * DO: Log all provisioning events
 * DO: Handle errors gracefully
 * DO NOT: Block check-in/check-out if WiFi provisioning fails
 */

import { db } from '@/lib/db';
import { wifiUserService } from './wifi-user-service';
import { 
  BookingCheckedInEvent, 
  BookingCheckedOutEvent, 
  BookingCancelledEvent,
  bookingEventEmitter 
} from '@/lib/events/booking-events';

export interface WiFiProvisioningResult {
  success: boolean;
  wifiUserId?: string;
  username?: string;
  password?: string;
  validFrom?: Date;
  validUntil?: Date;
  error?: string;
}

export interface WiFiDeprovisioningResult {
  success: boolean;
  wifiUserId?: string;
  error?: string;
}

export interface ProvisioningLogEntry {
  id: string;
  timestamp: Date;
  action: 'provision' | 'deprovision' | 'update' | 'error';
  bookingId: string;
  guestId?: string;
  wifiUserId?: string;
  username?: string;
  status: 'success' | 'failed' | 'partial';
  details: string;
  error?: string;
}

/**
 * Default bandwidth settings by room type tier
 */
const DEFAULT_BANDWIDTH_SETTINGS: Record<string, { download: number; upload: number }> = {
  standard: { download: 5000000, upload: 2000000 },    // 5 Mbps / 2 Mbps
  deluxe: { download: 10000000, upload: 5000000 },     // 10 Mbps / 5 Mbps
  suite: { download: 20000000, upload: 10000000 },     // 20 Mbps / 10 Mbps
  premium: { download: 50000000, upload: 25000000 },   // 50 Mbps / 25 Mbps
  vip: { download: 100000000, upload: 50000000 },      // 100 Mbps / 50 Mbps
};

/**
 * Default bandwidth fallback (10 Mbps / 5 Mbps)
 */
const DEFAULT_BANDWIDTH = { download: 10000000, upload: 5000000 };

class WiFiProvisioningService {
  private provisioningLogs: ProvisioningLogEntry[] = [];
  private maxLogEntries = 1000;

  constructor() {
    // Register event handlers
    this.registerEventHandlers();
  }

  /**
   * Register event handlers for booking events
   */
  private registerEventHandlers(): void {
    // Handle check-in event
    bookingEventEmitter.on('booking.checked_in', async (event) => {
      try {
        await this.handleCheckIn(event as BookingCheckedInEvent);
      } catch (error) {
        console.error('Error handling check-in event for WiFi provisioning:', error);
      }
    });

    // Handle check-out event
    bookingEventEmitter.on('booking.checked_out', async (event) => {
      try {
        await this.handleCheckOut(event as BookingCheckedOutEvent);
      } catch (error) {
        console.error('Error handling check-out event for WiFi deprovisioning:', error);
      }
    });

    // Handle cancellation event
    bookingEventEmitter.on('booking.cancelled', async (event) => {
      try {
        await this.handleCancellation(event as BookingCancelledEvent);
      } catch (error) {
        console.error('Error handling cancellation event for WiFi deprovisioning:', error);
      }
    });
  }

  /**
   * Handle check-in event - provision WiFi access
   */
  private async handleCheckIn(event: BookingCheckedInEvent): Promise<void> {
    console.log(`[WiFi Provisioning] Processing check-in for booking ${event.bookingId}`);

    // Check if WiFi user already exists for this booking
    const existingUser = await wifiUserService.getUserByBooking(event.bookingId);
    if (existingUser) {
      console.log(`[WiFi Provisioning] WiFi user already exists for booking ${event.bookingId}`);
      this.logEvent({
        timestamp: new Date(),
        action: 'provision',
        bookingId: event.bookingId,
        guestId: event.guestId,
        wifiUserId: existingUser.id,
        username: existingUser.username,
        status: 'success',
        details: 'WiFi user already provisioned',
      });
      return;
    }

    // Provision new WiFi user
    const result = await this.provisionWiFiForBooking({
      bookingId: event.bookingId,
      tenantId: event.tenantId,
      propertyId: event.propertyId,
      guestId: event.guestId,
      guestName: event.guestName,
      roomTypeId: event.roomTypeId,
      roomTypeName: event.roomTypeName,
      checkIn: event.checkIn,
      checkOut: event.checkOut,
      roomNumber: event.assignedRoomNumber,
    });

    if (result.success) {
      console.log(`[WiFi Provisioning] Successfully provisioned WiFi for booking ${event.bookingId}: ${result.username}`);
    } else {
      console.error(`[WiFi Provisioning] Failed to provision WiFi for booking ${event.bookingId}: ${result.error}`);
    }
  }

  /**
   * Handle check-out event - deprovision WiFi access
   */
  private async handleCheckOut(event: BookingCheckedOutEvent): Promise<void> {
    console.log(`[WiFi Provisioning] Processing check-out for booking ${event.bookingId}`);

    const result = await this.deprovisionWiFiForBooking(event.bookingId);

    if (result.success) {
      console.log(`[WiFi Provisioning] Successfully deprovisioned WiFi for booking ${event.bookingId}`);
    } else {
      console.error(`[WiFi Provisioning] Failed to deprovision WiFi for booking ${event.bookingId}: ${result.error}`);
    }
  }

  /**
   * Handle cancellation event - deprovision WiFi access
   */
  private async handleCancellation(event: BookingCancelledEvent): Promise<void> {
    console.log(`[WiFi Provisioning] Processing cancellation for booking ${event.bookingId}`);

    const result = await this.deprovisionWiFiForBooking(event.bookingId);

    if (result.success) {
      console.log(`[WiFi Provisioning] Successfully deprovisioned WiFi for cancelled booking ${event.bookingId}`);
    } else if (result.error !== 'No WiFi user found for this booking') {
      console.error(`[WiFi Provisioning] Failed to deprovision WiFi for cancelled booking ${event.bookingId}: ${result.error}`);
    }
  }

  /**
   * Provision WiFi access for a booking
   */
  async provisionWiFiForBooking(input: {
    bookingId: string;
    tenantId: string;
    propertyId: string;
    guestId: string;
    guestName: string;
    roomTypeId: string;
    roomTypeName: string;
    checkIn: Date;
    checkOut: Date;
    roomNumber?: string;
  }): Promise<WiFiProvisioningResult> {
    try {
      // Determine bandwidth based on room type
      const bandwidth = this.getBandwidthForRoomType(input.roomTypeName);

      // Find or create a default WiFi plan
      let planId: string | undefined;
      const defaultPlan = await this.findOrCreateDefaultPlan(input.tenantId, bandwidth);
      if (defaultPlan) {
        planId = defaultPlan.id;
      }

      // Generate username based on room number or booking
      const username = this.generateUsername(input.roomNumber, input.bookingId);

      // Create WiFi user with RADIUS credentials
      const result = await wifiUserService.provisionUser({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        guestId: input.guestId,
        bookingId: input.bookingId,
        username,
        planId,
        validFrom: new Date(),
        validUntil: new Date(input.checkOut.getTime() + 12 * 60 * 60 * 1000), // Valid until checkout + 12 hours
        userType: 'guest',
        downloadSpeed: bandwidth.download,
        uploadSpeed: bandwidth.upload,
      });

      // Log successful provisioning
      this.logEvent({
        timestamp: new Date(),
        action: 'provision',
        bookingId: input.bookingId,
        guestId: input.guestId,
        wifiUserId: result.wifiUser.id,
        username: result.credentials.username,
        status: 'success',
        details: `WiFi provisioned for ${input.guestName} - Room ${input.roomNumber || 'TBD'}`,
      });

      return {
        success: true,
        wifiUserId: result.wifiUser.id,
        username: result.credentials.username,
        password: result.credentials.password,
        validFrom: result.credentials.validFrom,
        validUntil: result.credentials.validUntil,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed provisioning
      this.logEvent({
        timestamp: new Date(),
        action: 'error',
        bookingId: input.bookingId,
        guestId: input.guestId,
        status: 'failed',
        details: `Failed to provision WiFi for ${input.guestName}`,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Deprovision WiFi access for a booking
   */
  async deprovisionWiFiForBooking(bookingId: string): Promise<WiFiDeprovisioningResult> {
    try {
      // Find WiFi user for this booking
      const wifiUser = await wifiUserService.getUserByBooking(bookingId);
      
      if (!wifiUser) {
        // Not an error - might not have WiFi access
        return {
          success: true,
          error: 'No WiFi user found for this booking',
        };
      }

      // Deprovision the user
      await wifiUserService.deprovisionUser(wifiUser.id);

      // Log successful deprovisioning
      this.logEvent({
        timestamp: new Date(),
        action: 'deprovision',
        bookingId,
        wifiUserId: wifiUser.id,
        username: wifiUser.username,
        status: 'success',
        details: `WiFi deprovisioned for user ${wifiUser.username}`,
      });

      return {
        success: true,
        wifiUserId: wifiUser.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed deprovisioning
      this.logEvent({
        timestamp: new Date(),
        action: 'error',
        bookingId,
        status: 'failed',
        details: 'Failed to deprovision WiFi',
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get bandwidth settings based on room type name
   */
  private getBandwidthForRoomType(roomTypeName: string): { download: number; upload: number } {
    const normalizedName = roomTypeName.toLowerCase();
    
    // Check for specific room type tiers
    if (normalizedName.includes('vip') || normalizedName.includes('presidential')) {
      return DEFAULT_BANDWIDTH_SETTINGS.vip;
    }
    if (normalizedName.includes('premium') || normalizedName.includes('executive')) {
      return DEFAULT_BANDWIDTH_SETTINGS.premium;
    }
    if (normalizedName.includes('suite')) {
      return DEFAULT_BANDWIDTH_SETTINGS.suite;
    }
    if (normalizedName.includes('deluxe') || normalizedName.includes('superior')) {
      return DEFAULT_BANDWIDTH_SETTINGS.deluxe;
    }
    
    return DEFAULT_BANDWIDTH;
  }

  /**
   * Find or create a default WiFi plan for the tenant
   */
  private async findOrCreateDefaultPlan(
    tenantId: string, 
    bandwidth: { download: number; upload: number }
  ): Promise<{ id: string } | null> {
    try {
      // Try to find an existing default plan
      const existingPlan = await db.wiFiPlan.findFirst({
        where: {
          tenantId,
          status: 'active',
          downloadSpeed: bandwidth.download,
          uploadSpeed: bandwidth.upload,
        },
      });

      if (existingPlan) {
        return existingPlan;
      }

      // Create a new default plan
      const newPlan = await db.wiFiPlan.create({
        data: {
          tenantId,
          name: `Guest Default (${bandwidth.download / 1000000}M/${bandwidth.upload / 1000000}M)`,
          description: 'Auto-generated default WiFi plan for guests',
          downloadSpeed: bandwidth.download,
          uploadSpeed: bandwidth.upload,
          price: 0,
          validityDays: 1,
          status: 'active',
        },
      });

      return newPlan;
    } catch (error) {
      console.error('[WiFi Provisioning] Error finding/creating default plan:', error);
      return null;
    }
  }

  /**
   * Generate a username based on room number or booking ID
   */
  private generateUsername(roomNumber?: string, bookingId?: string): string {
    const bytes = crypto.getRandomValues(new Uint8Array(3));
    const random = Array.from(bytes, b => b.toString(36)).join('').substring(0, 4);
    if (roomNumber) {
      return `room${roomNumber}_${random}`;
    }
    return `guest_${bookingId?.slice(-6) || random}`;
  }

  /**
   * Log a provisioning event
   */
  private logEvent(entry: Omit<ProvisioningLogEntry, 'id' | 'timestamp'> & { timestamp?: Date }): void {
    const logEntry: ProvisioningLogEntry = {
      id: `log_${Date.now()}_${crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(36), '')}`,
      timestamp: entry.timestamp || new Date(),
      action: entry.action,
      bookingId: entry.bookingId,
      guestId: entry.guestId,
      wifiUserId: entry.wifiUserId,
      username: entry.username,
      status: entry.status,
      details: entry.details,
      error: entry.error,
    };

    this.provisioningLogs.push(logEntry);

    // Keep only the last N entries
    if (this.provisioningLogs.length > this.maxLogEntries) {
      this.provisioningLogs = this.provisioningLogs.slice(-this.maxLogEntries);
    }

    // Also log to console for debugging
    const logLevel = entry.status === 'failed' ? 'error' : 'info';
    console[logLevel](`[WiFi Provisioning] ${entry.action.toUpperCase()}: ${entry.details}`, {
      bookingId: entry.bookingId,
      username: entry.username,
      status: entry.status,
      error: entry.error,
    });
  }

  /**
   * Get provisioning logs
   */
  getLogs(options?: { 
    bookingId?: string; 
    action?: 'provision' | 'deprovision' | 'update' | 'error';
    limit?: number;
  }): ProvisioningLogEntry[] {
    let logs = [...this.provisioningLogs];

    if (options?.bookingId) {
      logs = logs.filter(log => log.bookingId === options.bookingId);
    }

    if (options?.action) {
      logs = logs.filter(log => log.action === options.action);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  /**
   * Get WiFi credentials for a booking
   */
  async getWiFiCredentialsForBooking(bookingId: string): Promise<{
    username: string;
    password: string;
    validUntil: Date;
    status: string;
  } | null> {
    const wifiUser = await wifiUserService.getUserByBooking(bookingId);
    
    if (!wifiUser) {
      return null;
    }

    return {
      username: wifiUser.username,
      password: wifiUser.password,
      validUntil: wifiUser.validUntil,
      status: wifiUser.status,
    };
  }

  /**
   * Manually trigger provisioning for a booking (for retry or manual override)
   */
  async manualProvision(bookingId: string): Promise<WiFiProvisioningResult> {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        primaryGuest: true,
        roomType: true,
        room: true,
        property: true,
      },
    });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.status !== 'checked_in') {
      return { success: false, error: 'Booking is not checked in' };
    }

    return this.provisionWiFiForBooking({
      bookingId: booking.id,
      tenantId: booking.tenantId,
      propertyId: booking.propertyId,
      guestId: booking.primaryGuestId,
      guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
      roomTypeId: booking.roomTypeId,
      roomTypeName: booking.roomType.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomNumber: booking.room?.number,
    });
  }

  /**
   * Manually trigger deprovisioning for a booking (for retry or manual override)
   */
  async manualDeprovision(bookingId: string): Promise<WiFiDeprovisioningResult> {
    return this.deprovisionWiFiForBooking(bookingId);
  }
}

// Singleton instance
export const wifiProvisioningService = new WiFiProvisioningService();

// Export type for external use
// (ProvisioningLogEntry is already exported at the interface declaration)
