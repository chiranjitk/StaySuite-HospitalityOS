/**
 * WiFi User Service
 * 
 * Handles provisioning and deprovisioning of WiFi users.
 * This is the PMS-side logic that manages the RADIUS database.
 * 
 * Architecture:
 * PMS (this service) → PostgreSQL (radcheck, radreply) → FreeRADIUS → Gateway
 * 
 * DO: PMS = source of truth for user data
 * DO: Use transaction for provisioning operations
 * DO NOT: Implement RADIUS protocol in Node.js
 * DO NOT: Build DHCP/DNS in PMS
 */

import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

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
  sessionLimit?: number;
  dataLimit?: number;
}

export interface WiFiUserUpdateInput {
  validUntil?: Date;
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionLimit?: number;
  dataLimit?: number;
  status?: 'active' | 'suspended' | 'expired' | 'revoked';
}

export class WiFiUserService {
  /**
   * Create a new WiFi user with RADIUS credentials
   * 
   * Flow:
   * 1. Create WiFiUser record
   * 2. Create RadCheck (authentication)
   * 3. Create RadReply (authorization policies)
   */
  async provisionUser(input: WiFiUserCreateInput) {
    const username = input.username || this.generateUsername(input.propertyId);
    const password = input.password || this.generatePassword();

    return db.$transaction(async (tx) => {
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
          radiusSynced: false,
        },
      });

      // 2. Create RadCheck (authentication)
      await tx.radCheck.create({
        data: {
          wifiUserId: wifiUser.id,
          username,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: password,
        },
      });

      // 3. Create RadReply (authorization policies)
      const replies: { attribute: string; value: string }[] = [];

      // Bandwidth limits
      const downloadSpeed = input.downloadSpeed || 10000000; // 10 Mbps default
      const uploadSpeed = input.uploadSpeed || 10000000;

      // WISPr attributes (widely supported)
      replies.push({
        attribute: 'WISPr-Bandwidth-Max-Down',
        value: String(downloadSpeed),
      });
      replies.push({
        attribute: 'WISPr-Bandwidth-Max-Up',
        value: String(uploadSpeed),
      });

      // MikroTik rate limit (if using MikroTik)
      const downloadMbps = downloadSpeed / 1000000;
      const uploadMbps = uploadSpeed / 1000000;
      replies.push({
        attribute: 'Mikrotik-Rate-Limit',
        value: `${downloadMbps}M/${uploadMbps}M`,
      });

      // Session timeout
      if (input.sessionLimit) {
        replies.push({
          attribute: 'Session-Timeout',
          value: String(input.sessionLimit * 60), // Convert minutes to seconds
        });
      }

      // Create all replies
      for (const reply of replies) {
        await tx.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username,
            attribute: reply.attribute,
            op: ':=',
            value: reply.value,
          },
        });
      }

      // Update sync status
      await tx.wiFiUser.update({
        where: { id: wifiUser.id },
        data: {
          radiusSynced: true,
          radiusSyncedAt: new Date(),
        },
      });

      return {
        wifiUser,
        credentials: {
          username,
          password,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
        },
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
          radiusSynced: false,
        },
      });

      // Update RadReply entries
      if (input.downloadSpeed || input.uploadSpeed) {
        const downloadSpeed = input.downloadSpeed || 10000000;
        const uploadSpeed = input.uploadSpeed || 10000000;

        // Update WISPr attributes
        await tx.radReply.updateMany({
          where: {
            username: wifiUser.username,
            attribute: 'WISPr-Bandwidth-Max-Down',
          },
          data: { value: String(downloadSpeed) },
        });

        await tx.radReply.updateMany({
          where: {
            username: wifiUser.username,
            attribute: 'WISPr-Bandwidth-Max-Up',
          },
          data: { value: String(uploadSpeed) },
        });

        // Update MikroTik rate limit
        const downloadMbps = downloadSpeed / 1000000;
        const uploadMbps = uploadSpeed / 1000000;

        await tx.radReply.updateMany({
          where: {
            username: wifiUser.username,
            attribute: 'Mikrotik-Rate-Limit',
          },
          data: { value: `${downloadMbps}M/${uploadMbps}M` },
        });
      }

      // Update session timeout
      if (input.sessionLimit !== undefined) {
        const existingTimeout = await tx.radReply.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Session-Timeout',
          },
        });

        if (existingTimeout) {
          await tx.radReply.update({
            where: { id: existingTimeout.id },
            data: { value: String(input.sessionLimit * 60) },
          });
        } else if (input.sessionLimit) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: 'Session-Timeout',
              op: ':=',
              value: String(input.sessionLimit * 60),
            },
          });
        }
      }

      // Update sync status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          radiusSynced: true,
          radiusSyncedAt: new Date(),
        },
      });

      return updated;
    });
  }

  /**
   * Deprovision (disable) WiFi user
   * This is called on checkout or cancellation
   */
  async deprovisionUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update user status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          status: 'revoked',
          radiusSynced: false,
        },
      });

      // Disable RadCheck (set password to random value)
      await tx.radCheck.updateMany({
        where: {
          username: wifiUser.username,
          attribute: 'Cleartext-Password',
        },
        data: {
          value: this.generatePassword(), // Randomize password
          isActive: false,
        },
      });

      // Deactivate all replies
      await tx.radReply.updateMany({
        where: { username: wifiUser.username },
        data: { isActive: false },
      });

      return { success: true };
    });
  }

  /**
   * Suspend WiFi user (temporary)
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
        data: { status: 'suspended' },
      });

      // Deactivate RadCheck
      await tx.radCheck.updateMany({
        where: { username: wifiUser.username },
        data: { isActive: false },
      });

      return { success: true };
    });
  }

  /**
   * Resume suspended WiFi user
   */
  async resumeUser(userId: string) {
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
        data: { status: 'active' },
      });

      // Reactivate RadCheck
      await tx.radCheck.updateMany({
        where: { username: wifiUser.username },
        data: { isActive: true },
      });

      // Reactivate RadReply
      await tx.radReply.updateMany({
        where: { username: wifiUser.username },
        data: { isActive: true },
      });

      return { success: true };
    });
  }

  /**
   * Get WiFi user by booking ID
   */
  async getUserByBooking(bookingId: string) {
    return db.wiFiUser.findFirst({
      where: { bookingId },
      include: {
        radCheck: { where: { isActive: true } },
        radReply: { where: { isActive: true } },
      },
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
