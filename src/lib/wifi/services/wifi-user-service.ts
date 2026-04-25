/**
 * WiFi User Service
 * 
 * Handles provisioning and deprovisioning of WiFi users.
 * This is the PMS-side logic that manages the RADIUS database.
 * 
 * Architecture (SINGLE SQLite DATABASE):
 * ┌─────────────────────────────────────────────────────┐
 * │  db/custom.db (single SQLite file)                  │
 * │  ┌──────────────┐  ┌──────────────┐                 │
 * │  │ WiFiUser     │  │ RadCheck     │                 │
 * │  │ RadReply     │  │ RadUserGroup │                 │
 * │  │ RadGroupCheck│  │ RadGroupReply│                 │
 * │  └──────────────┘  └──────────────┘                 │
 * └──────────┬──────────────────┬───────────────────────┘
 *            │                  │
 *   PMS (Prisma)        FreeRADIUS Service (:3010)
 *   writes RadCheck      reads RadCheck for auth
 *   writes RadReply      reads RadReply for attrs
 * 
 * No sync needed — both services read/write the SAME database.
 * When you move to PostgreSQL, just change DATABASE_URL.
 * 
 * DO: PMS = source of truth for user data
 * DO: Use transaction for provisioning operations
 * DO NOT: Implement RADIUS protocol in Node.js
 * DO NOT: Build DHCP/DNS in PMS
 */

import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import {
  getActiveNASVendors,
  generateBandwidthAttributes,
  generateSessionAttributes,
  readDataLimitBytes,
  BANDWIDTH_ATTRIBUTES,
  DATA_LIMIT_ATTRIBUTES,
} from '@/lib/wifi/utils/vendor-attributes';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

/**
 * Helper to call the freeradius-service API
 */
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError: Record<string, unknown>;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  return response.json();
}

export interface WiFiUserCreateInput {
  tenantId: string;
  propertyId: string;
  guestId?: string;
  bookingId?: string;
  username?: string;
  password?: string;
  planId?: string;
  validFrom: Date;
  validUntil: Date;
  userType?: 'guest' | 'staff' | 'admin' | 'service';
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionTimeoutMinutes?: number; // RADIUS Session-Timeout in minutes (from plan validityDays)
  sessionLimit?: number; // Max concurrent sessions (Simultaneous-Use RADIUS attribute)
  dataLimit?: number; // Data cap in MB (from plan dataLimit)
}

export interface WiFiUserUpdateInput {
  validUntil?: Date;
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionTimeoutMinutes?: number; // RADIUS Session-Timeout in minutes
  sessionLimit?: number; // Max concurrent sessions
  dataLimit?: number;
  status?: 'active' | 'suspended' | 'expired' | 'revoked';
}

export class WiFiUserService {
  /**
   * Create a new WiFi user with RADIUS credentials
   * 
   * Since both PMS and FreeRADIUS service use the SAME SQLite database,
   * writing to RadCheck/RadReply/RadUserGroup via Prisma is all that's needed.
   * The FreeRADIUS service will immediately see the new user.
   * 
   * Flow:
   * 1. Create WiFiUser record
   * 2. Create RadCheck (authentication) — same table FreeRADIUS reads
   * 3. Create RadReply (authorization policies) — same table FreeRADIUS reads
   * 4. Create RadUserGroup (plan group mapping) — links user to plan group
   */
  async provisionUser(input: WiFiUserCreateInput) {
    const username = input.username || this.generateUsername(input.propertyId);
    const password = input.password || this.generatePassword();

    return db.$transaction(async (tx) => {
      // Resolve plan group name (radusergroup maps username → groupname)
      let groupName = 'standard-guests'; // default fallback
      if (input.planId) {
        const plan = await tx.wiFiPlan.findUnique({
          where: { id: input.planId },
          select: { name: true },
        });
        if (plan) {
          // Convert plan name to a RADIUS-safe group name (lowercase, underscores)
          groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
        }
      }

      // 1. Create WiFiUser
      const wifiUser = await tx.wiFiUser.create({
        data: {
          tenantId: input.tenantId,
          propertyId: input.propertyId,
          username,
          password,
          guestId: input.guestId,
          bookingId: input.bookingId,
          planId: input.planId,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          userType: input.userType || 'guest',
          status: 'active',
          radiusSynced: true, // Same DB — always synced
          radiusSyncedAt: new Date(),
        },
      });

      // 2. Create RadCheck (authentication — FreeRADIUS reads this table directly)
      await tx.radCheck.create({
        data: {
          wifiUserId: wifiUser.id,
          username,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: password,
          isActive: true,
        },
      });

      // 3. Create RadReply (authorization policies — FreeRADIUS reads this table directly)
      // Use VENDOR-AWARE attribute generation based on active NAS types
      const vendors = await getActiveNASVendors(input.propertyId);

      // Bandwidth limits
      const downloadMbps = input.downloadSpeed ? input.downloadSpeed / 1000000 : 10;
      const uploadMbps = input.uploadSpeed ? input.uploadSpeed / 1000000 : 5;
      const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);

      // Session timeout + data limit
      const sessionAttrs = generateSessionAttributes(
        vendors,
        input.sessionTimeoutMinutes || 0,
        input.dataLimit || 0,
      );

      // Merge all reply attributes
      const replies = [...bwAttrs, ...sessionAttrs];

      // Create all replies
      for (const reply of replies) {
        await tx.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username,
            attribute: reply.attribute,
            op: ':=',
            value: reply.value,
            isActive: true,
          },
        });
      }

      // 4. Create RadUserGroup — maps username to plan group
      // FreeRADIUS uses this to load group-level attributes from radgroupcheck/radgroupreply
      await tx.radUserGroup.create({
        data: {
          username,
          groupname: groupName,
          priority: 0,
        },
      });

      // 5. Set Simultaneous-Use if sessionLimit is specified (max concurrent sessions)
      // This goes in radcheck (not radreply) because it's an access check
      if (input.sessionLimit && input.sessionLimit > 0) {
        await tx.radCheck.create({
          data: {
            wifiUserId: wifiUser.id,
            username,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: String(input.sessionLimit),
            isActive: true,
          },
        });
      }

      console.log(`[WiFi Provisioning] User ${username} created in shared DB (booking: ${input.bookingId || 'manual'}, group: ${groupName})`);

      return {
        wifiUser,
        credentials: {
          username,
          password,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
        },
        groupName,
      };
    });
  }

  /**
   * Update WiFi user
   */
  async updateUser(userId: string, input: WiFiUserUpdateInput) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update user record
      const updated = await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          ...input,
          radiusSynced: true,
          radiusSyncedAt: new Date(),
        },
      });

      // Update RadReply entries (same DB — changes are immediate)
      // Vendor-aware: delete ALL old bandwidth attrs, write new vendor-appropriate ones
      if (input.downloadSpeed || input.uploadSpeed) {
        const vendors = await getActiveNASVendors(wifiUser.propertyId);
        const downloadMbps = input.downloadSpeed ? input.downloadSpeed / 1000000 : 10;
        const uploadMbps = input.uploadSpeed ? input.uploadSpeed / 1000000 : 5;

        // Delete old bandwidth attributes (all known vendor names)
        for (const attr of BANDWIDTH_ATTRIBUTES) {
          await tx.radReply.deleteMany({ where: { username: wifiUser.username, attribute: attr } });
        }

        // Write new vendor-appropriate bandwidth attributes
        const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);
        for (const reply of bwAttrs) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: reply.attribute,
              op: ':=',
              value: reply.value,
              isActive: true,
            },
          });
        }
      }

      // Update session timeout (from sessionTimeoutMinutes, not sessionLimit)
      if (input.sessionTimeoutMinutes !== undefined) {
        const existingTimeout = await tx.radReply.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Session-Timeout',
          },
        });

        if (existingTimeout) {
          await tx.radReply.update({
            where: { id: existingTimeout.id },
            data: { value: String(input.sessionTimeoutMinutes * 60) },
          });
        } else if (input.sessionTimeoutMinutes) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: 'Session-Timeout',
              op: ':=',
              value: String(input.sessionTimeoutMinutes * 60),
              isActive: true,
            },
          });
        }
      }

      // Update Simultaneous-Use (max concurrent sessions) if sessionLimit changed
      if (input.sessionLimit !== undefined) {
        const existingSimUse = await tx.radCheck.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Simultaneous-Use',
          },
        });

        if (input.sessionLimit > 0) {
          if (existingSimUse) {
            await tx.radCheck.update({
              where: { id: existingSimUse.id },
              data: { value: String(input.sessionLimit) },
            });
          } else {
            await tx.radCheck.create({
              data: {
                wifiUserId: wifiUser.id,
                username: wifiUser.username,
                attribute: 'Simultaneous-Use',
                op: ':=',
                value: String(input.sessionLimit),
                isActive: true,
              },
            });
          }
        } else if (existingSimUse) {
          // Remove Simultaneous-Use if set to 0/undefined
          await tx.radCheck.delete({ where: { id: existingSimUse.id } });
        }
      }

      return updated;
    });
  }

  /**
   * Deprovision (disable) WiFi user
   * This is called on checkout or cancellation.
   *
   * IMPORTANT: Uses HARD DELETE on RadCheck/RadReply instead of soft-delete (isActive=false).
   * FreeRADIUS queries no longer filter by isActive — they simply check if the record exists.
   * This allows guests to disconnect/reconnect from hotspot without issues.
   * The WiFiUser record is preserved for audit purposes (status = 'revoked').
   */
  async deprovisionUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update user status (preserves audit trail)
      await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          status: 'revoked',
          radiusSynced: false,
          radiusSyncedAt: new Date(),
        },
      });

      // HARD DELETE RADIUS credentials — FreeRADIUS will return 'User not found'
      await tx.radCheck.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radReply.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radUserGroup.deleteMany({
        where: { username: wifiUser.username },
      });

      console.log(`[WiFi Provisioning] User ${wifiUser.username} deprovisioned (credentials deleted, status: revoked)`);

      return { success: true };
    });
  }

  /**
   * Suspend WiFi user (temporary)
   * Uses HARD DELETE on RadCheck — on resume, credentials will be re-created.
   */
  async suspendUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: { status: 'suspended', radiusSynced: false },
      });

      // DELETE RADIUS credentials to prevent authentication
      await tx.radCheck.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radReply.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radUserGroup.deleteMany({
        where: { username: wifiUser.username },
      });

      return { success: true };
    });
  }

  /**
   * Resume suspended WiFi user
   * Re-creates RadCheck/RadReply credentials from WiFiUser.password and WiFiPlan.
   */
  async resumeUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
        include: { plan: true },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: { status: 'active', radiusSynced: true, radiusSyncedAt: new Date() },
      });

      // Re-create RadCheck (password) if not exists
      const existingCheck = await tx.radCheck.findFirst({
        where: { username: wifiUser.username },
      });
      if (!existingCheck) {
        await tx.radCheck.create({
          data: {
            username: wifiUser.username,
            attribute: 'Cleartext-Password',
            op: ':=',
            value: wifiUser.password,
            isActive: true,
          },
        });
      }

      // Re-create RadReply (bandwidth) if not exists
      // Vendor-aware: generate attrs based on active NAS types
      const existingReply = await tx.radReply.findFirst({
        where: { username: wifiUser.username },
      });
      if (!existingReply && wifiUser.plan) {
        const vendors = await getActiveNASVendors(wifiUser.propertyId);
        const downloadMbps = wifiUser.plan.downloadSpeed || 10;
        const uploadMbps = wifiUser.plan.uploadSpeed || 5;
        const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);

        for (const reply of bwAttrs) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: reply.attribute,
              op: '=',
              value: reply.value,
              isActive: true,
            },
          });
        }
      }

      // Re-create RadUserGroup if not exists
      const existingGroup = await tx.radUserGroup.findFirst({
        where: { username: wifiUser.username },
      });
      if (!existingGroup) {
        const groupName = wifiUser.plan
          ? wifiUser.plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests'
          : 'standard-guests';
        await tx.radUserGroup.create({
          data: { username: wifiUser.username, groupname: groupName, priority: 0 },
        });
      }

      return { success: true };
    });
  }

  /**
   * Get WiFi user by booking ID
   * Returns the most recent active WiFi user (skips revoked/expired)
   */
  async getUserByBooking(bookingId: string) {
    return db.wiFiUser.findFirst({
      where: { bookingId, status: { in: ['active', 'suspended'] } },
      include: {
        radCheck: { where: { isActive: true } },
        radReply: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get WiFi user by guest ID
   */
  async getUsersByGuest(guestId: string) {
    return db.wiFiUser.findMany({
      where: { guestId },
      include: {
        radCheck: { where: { isActive: true } },
        radReply: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Enforce simultaneous use limit for a user
   * Adds a Simultaneous-Use check attribute in RadCheck
   */
  async enforceSimultaneousUse(username: string, maxSessions: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if Simultaneous-Use already exists for this user
      const existing = await db.radCheck.findFirst({
        where: {
          username,
          attribute: 'Simultaneous-Use',
          isActive: true,
        },
      });

      if (existing) {
        // Update existing
        await db.radCheck.update({
          where: { id: existing.id },
          data: { value: String(maxSessions) },
        });
      } else {
        // Create new
        const wifiUser = await db.wiFiUser.findUnique({ where: { username } });
        await db.radCheck.create({
          data: {
            wifiUserId: wifiUser?.id,
            username,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: String(maxSessions),
            isActive: true,
          },
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enforce simultaneous use',
      };
    }
  }

  /**
   * Get data cap status for a user
   * Fetches from accounting API to check usage vs cap
   */
  async getDataCapStatus(username: string): Promise<{
    username: string;
    totalBytesIn: number;
    totalBytesOut: number;
    totalBytes: number;
    dataLimitBytes: number;
    usagePercent: number;
    isOverCap: boolean;
    isApproachingCap: boolean; // > 80%
    activeSessions: number;
  }> {
    // Get user's data limit from RadReply (vendor-agnostic — checks all known data-limit attrs)
    const allReplies = await db.radReply.findMany({
      where: { username, isActive: true },
    });
    const attrsMap: Record<string, string> = {};
    for (const r of allReplies) {
      attrsMap[r.attribute] = r.value;
    }
    const dataLimitBytes = readDataLimitBytes(attrsMap) || 0;

    // Get usage from accounting
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let activeSessions = 0;

    try {
      const result = await freeradiusRequest(`/api/accounting?username=${encodeURIComponent(username)}&limit=100`);
      if (result && result.sessions) {
        for (const session of result.sessions) {
          totalBytesIn += Number(session.acctInputOctets || session.inputOctets || 0);
          totalBytesOut += Number(session.acctOutputOctets || session.outputOctets || 0);
          if (!session.acctStopTime) {
            activeSessions++;
          }
        }
      }
    } catch {
      // Fallback: check RadAcct table directly
      const acctRecords = await db.radAcct.findMany({
        where: { username },
      });
      for (const record of acctRecords) {
        totalBytesIn += record.acctinputoctets;
        totalBytesOut += record.acctoutputoctets;
        if (!record.acctstoptime) {
          activeSessions++;
        }
      }
    }

    const totalBytes = totalBytesIn + totalBytesOut;
    // dataLimitBytes = 0 means unlimited — never over cap
    const isUnlimited = dataLimitBytes <= 0;
    const usagePercent = isUnlimited ? 0 : (totalBytes / dataLimitBytes) * 100;

    return {
      username,
      totalBytesIn,
      totalBytesOut,
      totalBytes,
      dataLimitBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isOverCap: isUnlimited ? false : totalBytes >= dataLimitBytes,
      isApproachingCap: isUnlimited ? false : usagePercent >= 80,
      activeSessions,
    };
  }

  /**
   * Disconnect a user's active session via CoA
   * Routes through freeradius-service API (radclient CLI)
   */
  async disconnectUser(username: string, sessionId?: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // If no sessionId provided, find the active one from accounting
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const result = await freeradiusRequest(`/api/accounting?username=${encodeURIComponent(username)}&status=active&limit=1`);
        if (result?.sessions?.length > 0) {
          targetSessionId = result.sessions[0].acctSessionId || result.sessions[0].sessionId;
        }
      }

      if (!targetSessionId) {
        return {
          success: false,
          error: 'No active session found for user',
        };
      }

      const result = await freeradiusRequest('/api/coa/disconnect', {
        method: 'POST',
        body: JSON.stringify({ username, sessionId: targetSessionId }),
      });

      return {
        success: result.success !== false,
        message: result.message || 'Disconnect sent',
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      };
    }
  }

  /**
   * Change a user's bandwidth via CoA
   * Routes through freeradius-service API (radclient CLI)
   */
  async changeUserBandwidth(
    username: string,
    downloadMbps: number,
    uploadMbps: number
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Update RadReply for persistent change
      const downloadBps = downloadMbps * 1000000;
      const uploadBps = uploadMbps * 1000000;

      // Vendor-aware: delete ALL old bandwidth attrs, write new vendor-appropriate ones
      const wifiUser = await db.wiFiUser.findUnique({ where: { username } });
      const vendors = wifiUser ? await getActiveNASVendors(wifiUser.propertyId) : ['other' as const];
      const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);

      await db.$transaction(async (tx) => {
        // Delete all known bandwidth attributes
        for (const attr of BANDWIDTH_ATTRIBUTES) {
          await tx.radReply.deleteMany({ where: { username, attribute: attr } });
        }
        // Write new vendor-appropriate attributes
        for (const reply of bwAttrs) {
          await tx.radReply.create({
            data: {
              username,
              attribute: reply.attribute,
              op: ':=',
              value: reply.value,
              isActive: true,
            },
          });
        }
      });

      // Send CoA to apply immediately to active session
      const result = await freeradiusRequest('/api/coa/bandwidth', {
        method: 'POST',
        body: JSON.stringify({
          username,
          downloadMbps,
          uploadMbps,
        }),
      });

      return {
        success: true,
        message: `Bandwidth updated to ${downloadMbps}M/${uploadMbps}M`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bandwidth change failed',
      };
    }
  }

  /**
   * Bulk create event WiFi users
   * Creates multiple RADIUS users for event attendees
   */
  async createEventUsers(params: {
    eventId: string;
    eventName: string;
    count: number;
    bandwidthDown: number; // Mbps
    bandwidthUp: number;   // Mbps
    dataLimitMb?: number;
    validHours?: number;
    propertyId: string;
    tenantId: string;
  }): Promise<{
    success: boolean;
    created: number;
    failed: number;
    users?: Array<{ username: string; password: string }>[];
    error?: string;
  }> {
    const {
      tenantId, propertyId, eventId, eventName, count,
      bandwidthDown, bandwidthUp, dataLimitMb = 512, validHours = 24,
    } = params;

    const results: Array<{ username: string; password: string }[]> = [];
    let created = 0;
    let failed = 0;

    const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000);
    const downloadSpeed = bandwidthDown * 1000000; // Mbps to bps
    const uploadSpeed = bandwidthUp * 1000000;

    for (let i = 0; i < count; i++) {
      try {
        const username = `evt_${eventId.slice(-6)}_${String(i + 1).padStart(3, '0')}`;
        const password = this.generatePassword(6);

        await this.provisionUser({
          tenantId,
          propertyId,
          username,
          password,
          validFrom: new Date(),
          validUntil,
          userType: 'guest',
          downloadSpeed,
          uploadSpeed,
          dataLimit: dataLimitMb,
        });

        results.push({ username, password });
        created++;
      } catch {
        failed++;
      }
    }

    // Also create via backend for tracking
    try {
      await freeradiusRequest('/api/event-users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          eventName,
          count,
          propertyId,
          bandwidthDown,
          bandwidthUp,
          dataLimitMb,
          validHours,
          credentials: results,
        }),
      });
    } catch {
      // Best effort — credentials are already in the DB
    }

    return {
      success: created > 0,
      created,
      failed,
      users: results,
    };
  }

  /**
   * Revoke an event user and deprovision
   */
  async revokeEventUser(eventUserId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Revoke via backend API
      const result = await freeradiusRequest(`/api/event-users/${encodeURIComponent(eventUserId)}/revoke`, {
        method: 'POST',
      });

      return {
        success: result.success !== false,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Revoke failed',
      };
    }
  }

  /**
   * Add a MAC address for auto-authentication
   * Adds to the MAC authentication whitelist
   */
  async addMacAuth(params: {
    propertyId: string;
    macAddress: string;
    username?: string;
    guestId?: string;
    description?: string;
  }): Promise<{
    success: boolean;
    macAuthId?: string;
    error?: string;
  }> {
    try {
      // Create via backend API
      const result = await freeradiusRequest('/api/mac-auth', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      return {
        success: result.success !== false,
        macAuthId: result.id,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add MAC auth',
      };
    }
  }

  /**
   * Remove a MAC address from auto-authentication whitelist
   */
  async removeMacAuth(macAuthId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(macAuthId)}`, {
        method: 'DELETE',
      });

      return {
        success: result.success !== false,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove MAC auth',
      };
    }
  }

  /**
   * Persist a provisioning log to the database
   * Used for audit trail of all WiFi provisioning operations
   */
  async logProvisioning(params: {
    action: string;
    username: string;
    propertyId: string;
    tenantId?: string;
    guestId?: string;
    bookingId?: string;
    userId?: string;
    result: 'success' | 'failed' | 'partial';
    details?: string;
    error?: string;
    durationMs?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Use the AuditLog model for provisioning logs
      // NOTE: entityId must be a valid UUID for PostgreSQL (@db.Uuid columns).
      //   - Use bookingId when available (it's always a UUID)
      //   - Fall back to undefined rather than passing a non-UUID username
      //   - The username is stored inside newValue JSON for reference
      const resolvedTenantId = params.tenantId;
      if (!resolvedTenantId) {
        console.warn('[WiFi Provisioning Log] Skipped: no tenantId provided (required for PostgreSQL UUID column)');
        return { success: false, error: 'No tenantId provided' };
      }
      const logEntry = await db.auditLog.create({
        data: {
          tenantId: resolvedTenantId,
          // Only set userId if explicitly provided (must exist in User table for FK constraint)
          ...(params.userId ? { userId: params.userId } : {}),
          module: 'wifi-provisioning',
          action: params.action,
          entityType: 'WiFiUser',
          entityId: params.bookingId || undefined, // bookingId is a UUID; username is not
          newValue: JSON.stringify({
            username: params.username,
            propertyId: params.propertyId,
            guestId: params.guestId,
            result: params.result,
            details: params.details,
            durationMs: params.durationMs,
          }),
          oldValue: params.error || undefined,
        },
      });

      console.log(`[WiFi Provisioning Log] ${params.action}: ${params.username} - ${params.result}${params.error ? ` (${params.error})` : ''}`);

      return { success: true, id: logEntry.id };
    } catch (error) {
      console.error('[WiFi Provisioning Log] Failed to persist log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to persist provisioning log',
      };
    }
  }

  /**
   * Generate username
   * Format: guest_{property_code}_{random}
   */
  private generateUsername(propertyId: string): string {
    const random = randomBytes(4).toString('hex');
    return `guest_${propertyId.slice(-4)}_${random}`;
  }

  /**
   * Generate random password
   */
  private generatePassword(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }
}

// Singleton instance
export const wifiUserService = new WiFiUserService();
