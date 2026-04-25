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
import {
  generateCredentials,
  getDefaultCredentialPolicy,
  type CredentialPolicy,
} from './credential-engine';

// Import logProvisioning as standalone function for DB-persisted logging
const { logProvisioning } = wifiUserService;

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
 * Default bandwidth fallback (10 Mbps / 5 Mbps)
 * Used ONLY when no plan is configured anywhere (room type or AAA default).
 * Admins should configure a default plan in WiFi AAA settings to avoid this fallback.
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
      // Verify RADIUS credentials actually exist — a WiFiUser without RadCheck/RadReply
      // is a "ghost" user (e.g. from seed data) and must be re-provisioned
      const hasRadCheck = existingUser.radCheck && existingUser.radCheck.length > 0;
      const hasRadReply = existingUser.radReply && existingUser.radReply.length > 0;

      if (hasRadCheck && hasRadReply && existingUser.status === 'active') {
        console.log(`[WiFi Provisioning] WiFi user already fully provisioned for booking ${event.bookingId}`);
        await logProvisioning({
          action: 'provision',
          username: existingUser.username,
          propertyId: event.propertyId,
          tenantId: event.tenantId,
          guestId: event.guestId,
          bookingId: event.bookingId,
          result: 'success',
          details: 'WiFi user already provisioned with RADIUS credentials',
        });
        return;
      }

      // WiFiUser exists but RADIUS records are missing or user is not active — re-provision
      console.log(`[WiFi Provisioning] WiFi user exists but missing RADIUS credentials (radCheck: ${existingUser.radCheck?.length || 0}, radReply: ${existingUser.radReply?.length || 0}, status: ${existingUser.status}). Re-provisioning for booking ${event.bookingId}`);
      try {
        // Clean up the ghost WiFiUser so we can create fresh with proper RADIUS records
        await wifiUserService.deprovisionUser(existingUser.id);
      } catch (cleanupError) {
        console.warn(`[WiFi Provisioning] Failed to clean up ghost user ${existingUser.id}, will attempt fresh provision anyway:`, cleanupError);
      }
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
      // Check if WiFi user already exists for this booking with valid RADIUS records
      const existingUser = await wifiUserService.getUserByBooking(input.bookingId);
      if (existingUser) {
        const hasRadCheck = existingUser.radCheck && existingUser.radCheck.length > 0;
        const hasRadReply = existingUser.radReply && existingUser.radReply.length > 0;

        if (hasRadCheck && hasRadReply && existingUser.status === 'active') {
          console.log(`[WiFi Provisioning] User ${existingUser.username} already provisioned with RADIUS credentials for booking ${input.bookingId}`);
          return {
            success: true,
            wifiUserId: existingUser.id,
            username: existingUser.username,
            password: existingUser.password,
            validFrom: existingUser.validFrom,
            validUntil: existingUser.validUntil,
          };
        }

        // Ghost user — clean up before re-provisioning
        console.log(`[WiFi Provisioning] Cleaning up ghost WiFi user ${existingUser.id} (radCheck: ${existingUser.radCheck?.length || 0}, radReply: ${existingUser.radReply?.length || 0}, status: ${existingUser.status})`);
        try {
          await wifiUserService.deprovisionUser(existingUser.id);
        } catch (cleanupError) {
          console.warn(`[WiFi Provisioning] Failed to clean up ghost user ${existingUser.id}:`, cleanupError);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // PLAN SELECTION — Priority Chain:
      //   1. Room Type → WiFi Plan (Tier 2: per-room-type mapping)
      //   2. AAA Config → Default Plan (Tier 1: property-level default)
      //   3. AAA Config → Default Bandwidth (legacy fallback, no plan record)
      //   4. System Fallback (10M/5M hardcoded, no plan record)
      // ─────────────────────────────────────────────────────────────────────
      let planId: string | undefined;
      let planValidityDays = 1;
      let planDataLimit: number | undefined;
      let planSessionLimit: number | undefined;
      let bandwidth = { ...DEFAULT_BANDWIDTH }; // fallback
      let planSource = 'fallback'; // track where the plan came from

      console.log(`[WiFi Provisioning] Resolving plan for booking ${input.bookingId} (roomTypeId: ${input.roomTypeId || 'none'}, propertyId: ${input.propertyId})`);

      // Tier 2: Check if room type has a WiFi plan assigned
      if (input.roomTypeId) {
        const roomType = await db.roomType.findUnique({
          where: { id: input.roomTypeId },
          select: { wifiPlanId: true },
        });
        console.log(`[WiFi Provisioning] Tier 2 — roomType.wifiPlanId: ${roomType?.wifiPlanId || 'not set'}`);
        if (roomType?.wifiPlanId) {
          const roomTypePlan = await db.wiFiPlan.findFirst({
            where: { id: roomType.wifiPlanId, status: 'active' },
            select: {
              id: true, downloadSpeed: true, uploadSpeed: true,
              validityDays: true, dataLimit: true, sessionLimit: true, name: true,
            },
          });
          if (roomTypePlan) {
            planId = roomTypePlan.id;
            planValidityDays = roomTypePlan.validityDays || 1;
            planDataLimit = roomTypePlan.dataLimit;
            planSessionLimit = roomTypePlan.sessionLimit;
            bandwidth = {
              download: roomTypePlan.downloadSpeed * 1000000, // Mbps → bps
              upload: roomTypePlan.uploadSpeed * 1000000,
            };
            planSource = `room-type:${roomTypePlan.name}`;
            console.log(`[WiFi Provisioning] Plan selected from Room Type: "${roomTypePlan.name}" (${roomTypePlan.downloadSpeed}M/${roomTypePlan.uploadSpeed}M)`);
          }
        }
      }

      // Tier 1: Check AAA config default plan (if room type had no plan)
      //   - First try property-specific config
      //   - Fall back to ANY config for the same tenant (multi-property setups
      //     where the admin configured the plan on a different property page)
      if (!planId) {
        const aaaConfig = await db.wiFiAAAConfig.findUnique({
          where: { propertyId: input.propertyId },
          select: { defaultPlanId: true },
        });
        console.log(`[WiFi Provisioning] Tier 1 — property(${input.propertyId}) defaultPlanId: ${aaaConfig?.defaultPlanId || 'not set'}`);

        // Resolve the effective plan: try property-specific first, then tenant fallback
        let effectivePlanId = aaaConfig?.defaultPlanId;
        if (!effectivePlanId) {
          // Tenant-level fallback: find any AAA config for this tenant with a default plan
          const tenantConfigs = await db.wiFiAAAConfig.findMany({
            where: { tenantId: input.tenantId, defaultPlanId: { not: null } },
            select: { defaultPlanId: true, propertyId: true },
            take: 1,
          });
          if (tenantConfigs.length > 0) {
            effectivePlanId = tenantConfigs[0].defaultPlanId;
            console.log(`[WiFi Provisioning] Tier 1 — FALLBACK to tenant config (property ${tenantConfigs[0].propertyId}), defaultPlanId: ${effectivePlanId}`);
          }
        }

        if (effectivePlanId) {
          const defaultPlan = await db.wiFiPlan.findFirst({
            where: { id: effectivePlanId, status: 'active' },
            select: {
              id: true, downloadSpeed: true, uploadSpeed: true,
              validityDays: true, dataLimit: true, sessionLimit: true, name: true,
            },
          });
          if (defaultPlan) {
            planId = defaultPlan.id;
            planValidityDays = defaultPlan.validityDays || 1;
            planDataLimit = defaultPlan.dataLimit;
            planSessionLimit = defaultPlan.sessionLimit;
            bandwidth = {
              download: defaultPlan.downloadSpeed * 1000000,
              upload: defaultPlan.uploadSpeed * 1000000,
            };
            planSource = `aaa-default:${defaultPlan.name}`;
            console.log(`[WiFi Provisioning] Plan selected from AAA Default: "${defaultPlan.name}" (${defaultPlan.downloadSpeed}M/${defaultPlan.uploadSpeed}M)`);
          }
        }
      }

      // Fallback: Use AAA config default bandwidth (no plan record)
      if (!planId) {
        // Try property-specific first, then tenant fallback
        let aaaConfig = await db.wiFiAAAConfig.findUnique({
          where: { propertyId: input.propertyId },
          select: { defaultDownloadSpeed: true, defaultUploadSpeed: true },
        });
        if (!aaaConfig) {
          // Tenant fallback: use any config for this tenant
          aaaConfig = await db.wiFiAAAConfig.findFirst({
            where: { tenantId: input.tenantId },
            select: { defaultDownloadSpeed: true, defaultUploadSpeed: true },
          });
        }
        if (aaaConfig) {
          bandwidth = {
            download: (aaaConfig.defaultDownloadSpeed || 10) * 1000000,
            upload: (aaaConfig.defaultUploadSpeed || 10) * 1000000,
          };
          planSource = `aaa-bandwidth:${aaaConfig.defaultDownloadSpeed}M/${aaaConfig.defaultUploadSpeed}M`;
        }
        console.warn(`[WiFi Provisioning] No plan configured — using AAA default bandwidth (${bandwidth.download / 1000000}M/${bandwidth.upload / 1000000}M). Configure a WiFi plan in Room Type or AAA Settings.`);
      }

      // Load credential policy from WiFiAAAConfig (also with tenant fallback)
      const credentialPolicy = await this.loadCredentialPolicy(input.propertyId, input.tenantId);

      // Generate username & password based on configured format
      const { username, password } = generateCredentials(credentialPolicy, {
        firstName: input.guestName?.split(' ')[0],
        lastName: input.guestName?.split(' ').slice(1).join(' '),
        roomNumber: input.roomNumber,
        bookingId: input.bookingId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
      }, input.bookingId);

      // Calculate validity: use the LATER of (checkout + 12h) or (now + plan validityDays)
      // This ensures the guest always gets WiFi for their full stay AND at least the plan's validity period
      const checkoutValidity = new Date(input.checkOut.getTime() + 12 * 60 * 60 * 1000);
      const planValidity = new Date(Date.now() + planValidityDays * 24 * 60 * 60 * 1000);
      const validUntil = new Date(Math.max(checkoutValidity.getTime(), planValidity.getTime()));

      // Session timeout in minutes based on the plan's validity days
      // This tells the NAS/AP to force re-auth after this many minutes
      const sessionTimeoutMinutes = planValidityDays * 24 * 60; // days → minutes

      // Create WiFi user with RADIUS credentials
      const result = await wifiUserService.provisionUser({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        guestId: input.guestId,
        bookingId: input.bookingId,
        username,
        password,
        planId,
        validFrom: new Date(),
        validUntil,
        userType: 'guest',
        downloadSpeed: bandwidth.download,
        uploadSpeed: bandwidth.upload,
        sessionTimeoutMinutes, // plan-based session timeout (minutes)
        sessionLimit: planSessionLimit, // max concurrent sessions from plan
        dataLimit: planDataLimit, // data cap from plan (MB)
      });

      // Check data cap status (warn if approaching limit)
      try {
        const capStatus = await wifiUserService.getDataCapStatus(username);
        if (capStatus.isApproachingCap) {
          console.warn(`[WiFi Provisioning] User ${username} is approaching data cap: ${capStatus.usagePercent.toFixed(1)}% used`);
        }
        if (capStatus.isOverCap) {
          console.warn(`[WiFi Provisioning] User ${username} is OVER data cap. Disconnecting existing sessions.`);
          await wifiUserService.disconnectUser(username);
        }
      } catch (capError) {
        // Non-blocking — data cap check is advisory only
        console.warn('[WiFi Provisioning] Data cap check failed (non-blocking):', capError);
      }

      // Log successful provisioning to DB
      await logProvisioning({
        action: 'provision',
        username: result.credentials.username,
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        guestId: input.guestId,
        bookingId: input.bookingId,
        result: 'success',
        details: `WiFi provisioned for ${input.guestName} - Room ${input.roomNumber || 'TBD'} [plan: ${planSource}]`,
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
      
      // Log failed provisioning to DB
      await logProvisioning({
        action: 'provision',
        username: `pending_${input.bookingId?.slice(-6)}`,
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        guestId: input.guestId,
        bookingId: input.bookingId,
        result: 'failed',
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

      // CoA disconnect active sessions (non-blocking)
      try {
        await wifiUserService.disconnectUser(wifiUser.username);
        console.log(`[WiFi Provisioning] Sent CoA disconnect for ${wifiUser.username}`);
      } catch (coaError) {
        console.warn(`[WiFi Provisioning] CoA disconnect failed for ${wifiUser.username} (non-blocking):`, coaError);
      }

      // Log successful deprovisioning to DB
      await logProvisioning({
        action: 'deprovision',
        username: wifiUser.username,
        propertyId: wifiUser.propertyId,
        tenantId: wifiUser.tenantId,
        bookingId,
        result: 'success',
        details: `WiFi deprovisioned for user ${wifiUser.username}`,
      });

      return {
        success: true,
        wifiUserId: wifiUser.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed deprovisioning to DB
      await logProvisioning({
        action: 'deprovision',
        username: `unknown_${bookingId?.slice(-6)}`,
        propertyId: 'unknown',
        bookingId,
        result: 'failed',
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
   * Load credential policy from WiFiAAAConfig for a property.
   * Falls back to tenant-level config if no property-specific config exists.
   */
  private async loadCredentialPolicy(propertyId: string, tenantId: string): Promise<CredentialPolicy> {
    try {
      // Try property-specific config first
      let config = await db.wiFiAAAConfig.findUnique({
        where: { propertyId },
      });
      // Tenant-level fallback: use any config for the same tenant
      if (!config) {
        config = await db.wiFiAAAConfig.findFirst({
          where: { tenantId },
        });
      }
      if (config) {
        return {
          usernameFormat: config.usernameFormat || 'room_random',
          usernamePrefix: config.usernamePrefix,
          usernameCase: (config.usernameCase as 'lowercase' | 'uppercase' | 'as_is') || 'lowercase',
          usernameMinLength: config.usernameMinLength || 4,
          usernameMaxLength: config.usernameMaxLength || 32,
          passwordFormat: config.passwordFormat || 'random_alphanumeric',
          passwordFixedValue: config.passwordFixedValue,
          passwordLength: config.passwordLength || 8,
          passwordIncludeUppercase: config.passwordIncludeUppercase !== false,
          passwordIncludeNumbers: config.passwordIncludeNumbers !== false,
          passwordIncludeSymbols: config.passwordIncludeSymbols || false,
          credentialSeparator: config.credentialSeparator || '_',
          duplicateUsernameAction: (config.duplicateUsernameAction as 'append_random' | 'reject' | 'overwrite') || 'append_random',
        };
      }
    } catch (error) {
      console.error('[WiFi Provisioning] Failed to load credential policy:', error);
    }
    return getDefaultCredentialPolicy();
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
