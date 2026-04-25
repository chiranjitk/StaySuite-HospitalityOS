/**
 * WiFi Accounting Sync Service
 * 
 * Syncs RADIUS accounting data (RadAcct) to WiFi sessions and updates usage stats.
 * Reads from RadAcct table (written by FreeRADIUS SQL module via detail files)
 * and updates WiFiSession + WiFiUser.totalBytesIn/totalBytesOut.
 * 
 * Architecture (SINGLE SQLite DATABASE):
 * ┌──────────────────────────────────────────────────────┐
 * │  db/custom.db                                        │
 * │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
 * │  │ RadAcct  │→ │ WiFiSession  │  │ WiFiUser     │   │
 * │  │ (source) │  │ (enriched)   │  │ (totals)     │   │
 * │  └──────────┘  └──────────────┘  └──────────────┘   │
 * └──────────────────────────────────────────────────────┘
 * 
 * IMPORTANT: FreeRADIUS writes to RadAcct via SQL module or detail file parser.
 * This service READS RadAcct and updates WiFiSession/WiFiUser.
 */

import { db } from '@/lib/db';

export interface AccountingSyncResult {
  processed: number;
  created: number;
  updated: number;
  closed: number;
  skipped: number;
  errors: number;
  lastRadAcctId: string;
  dataLimitEnforced: number;
}

export class WiFiAccountingSyncService {
  /**
   * Sync accounting data from RadAcct to WiFiSession + WiFiUser.
   * 
   * Uses cursor-based pagination (lastRadAcctId) for efficiency.
   * Matches records by username → WiFiUser → updates session + user stats.
   * 
   * @param tenantId - Optional tenant filter
   */
  async syncAccounting(tenantId?: string): Promise<AccountingSyncResult> {
    const result: AccountingSyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      closed: 0,
      skipped: 0,
      errors: 0,
      lastRadAcctId: '',
      dataLimitEnforced: 0,
    };

    try {
      // 1. Get the last synced cursor position
      const syncRecord = await db.wiFiAccountingSync.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
      });

      const lastSyncedId = syncRecord?.lastRadAcctId || '';

      // 2. Fetch new records AFTER the last synced ID (cursor-based)
      const newRecords = await db.radAcct.findMany({
        where: {
          ...(lastSyncedId ? { radacctid: { gt: lastSyncedId } } : {}),
        },
        orderBy: { radacctid: 'asc' },
        take: 1000,
      });

      if (newRecords.length === 0) {
        return result;
      }

      // 3. Process each accounting record
      for (const record of newRecords) {
        try {
          result.processed++;
          result.lastRadAcctId = record.radacctid;

          // Find the WiFi user by username
          const wifiUser = await db.wiFiUser.findFirst({
            where: { username: record.username },
          });

          if (!wifiUser) {
            result.skipped++;
            continue;
          }

          const acctStatus = record.acctstatus?.toLowerCase() || '';

          if (acctStatus === 'start') {
            // Create new WiFi session from accounting Start
            await this.createSession(record, wifiUser);
            result.created++;
          } else if (acctStatus === 'interim' || acctStatus === 'interim-update') {
            // Update existing session with interim data
            await this.updateSession(record, wifiUser);
            result.updated++;
          } else if (acctStatus === 'stop') {
            // Close session and update user stats
            await this.closeSession(record, wifiUser);
            result.closed++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors++;
          console.error(`[AccountingSync] Error processing record ${record.radacctid}:`, error);
        }
      }

      // 4. Check data limits for all active sessions
      try {
        const enforced = await this.enforceDataLimits();
        result.dataLimitEnforced = enforced;
      } catch (error) {
        console.error('[AccountingSync] Data limit enforcement error:', error);
      }

      // 5. Save sync cursor position
      if (result.lastRadAcctId) {
        await db.wiFiAccountingSync.upsert({
          where: { id: syncRecord?.id || 'default' },
          update: {
            lastRadAcctId: result.lastRadAcctId,
            lastSyncedAt: new Date(),
            recordsProcessed: { increment: result.processed },
            errors: { increment: result.errors },
          },
          create: {
            id: 'default',
            lastRadAcctId: result.lastRadAcctId,
            lastSyncedAt: new Date(),
            recordsProcessed: result.processed,
            errors: result.errors,
          },
        });
      }

      console.log(`[AccountingSync] Synced ${result.processed} records: ${result.created} created, ${result.updated} updated, ${result.closed} closed, ${result.skipped} skipped, ${result.errors} errors`);

      return result;
    } catch (error) {
      console.error('[AccountingSync] Fatal error:', error);
      throw error;
    }
  }

  /**
   * Create a new WiFi session from accounting Start record
   */
  private async createSession(record: any, wifiUser: any) {
    // Check if session already exists for this acctuniqueid
    const existing = await db.wiFiSession.findFirst({
      where: { macAddress: record.callingstationid || 'unknown', status: 'active' },
    });

    if (existing) {
      // Session already exists — update it instead
      return this.updateSession(record, wifiUser);
    }

    return db.wiFiSession.create({
      data: {
        tenantId: wifiUser.tenantId || '',
        planId: wifiUser.planId,
        guestId: wifiUser.guestId,
        bookingId: wifiUser.bookingId,
        macAddress: record.callingstationid || 'unknown',
        ipAddress: record.framedipaddress,
        startTime: record.acctstarttime,
        endTime: null,
        dataUsed: 0,
        duration: 0,
        authMethod: 'portal',
        status: 'active',
      },
    });
  }

  /**
   * Update existing session from interim update
   */
  private async updateSession(record: any, wifiUser: any) {
    // Find session by MAC address (most reliable for matching)
    const existingSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: record.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (!existingSession) {
      // No active session found — create one from this interim
      return this.createSession(record, wifiUser);
    }

    // Calculate data in MB (input + output octets / 1048576)
    const totalOctets = (record.acctinputoctets || 0) + (record.acctoutputoctets || 0);
    const dataInMB = Math.floor(totalOctets / 1048576);
    const duration = record.acctsessiontime || 0;

    return db.wiFiSession.update({
      where: { id: existingSession.id },
      data: {
        dataUsed: dataInMB,
        duration,
        ipAddress: record.framedipaddress || existingSession.ipAddress,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Close session from accounting Stop record + update user stats
   */
  private async closeSession(record: any, wifiUser: any) {
    // Find active session by MAC
    const existingSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: record.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (!existingSession) {
      return null;
    }

    const totalOctets = (record.acctinputoctets || 0) + (record.acctoutputoctets || 0);
    const dataInMB = Math.floor(totalOctets / 1048576);
    const duration = record.acctsessiontime || 0;

    // Close the session
    await db.wiFiSession.update({
      where: { id: existingSession.id },
      data: {
        endTime: record.acctstoptime || new Date(),
        dataUsed: dataInMB,
        duration,
        status: 'ended',
        updatedAt: new Date(),
      },
    });

    // Update WiFiUser cumulative stats
    await db.wiFiUser.update({
      where: { id: wifiUser.id },
      data: {
        totalBytesIn: { increment: record.acctinputoctets || 0 },
        totalBytesOut: { increment: record.acctoutputoctets || 0 },
        sessionCount: { increment: 1 },
        lastAccountingAt: new Date(),
      },
    });
  }

  /**
   * Check and enforce data limits for all active sessions.
   * When a session exceeds its plan's data limit, terminate it via Session-Timeout.
   */
  private async enforceDataLimits(): Promise<number> {
    let enforced = 0;

    // Get all active sessions with their WiFi user's plan
    const activeSessions = await db.wiFiSession.findMany({
      where: { status: 'active' },
      include: {
        plan: {
          select: { dataLimit: true },
        },
      },
    });

    for (const session of activeSessions) {
      if (!session.plan?.dataLimit || session.plan.dataLimit <= 0) continue;

      // Convert plan dataLimit (MB) to bytes for comparison
      const dataLimitBytes = session.plan.dataLimit * 1024 * 1024;

      // Find the WiFi user to get current byte totals
      const wifiUser = await db.wiFiUser.findFirst({
        where: {
          OR: [
            { guestId: session.guestId || 'none' },
            { bookingId: session.bookingId || 'none' },
          ],
          status: 'active',
        },
      });

      if (!wifiUser) continue;

      // Check cumulative usage: user's total + current session data
      const userTotalBytes = (wifiUser.totalBytesIn || 0) + (wifiUser.totalBytesOut || 0);
      const currentSessionBytes = (session.dataUsed || 0) * 1024 * 1024; // MB → bytes
      const totalUsageBytes = userTotalBytes + currentSessionBytes;

      if (totalUsageBytes >= dataLimitBytes) {
        console.log(`[AccountingSync] Data limit exceeded for user ${wifiUser.username}: ${Math.round(totalUsageBytes / (1024*1024))}MB used of ${session.plan.dataLimit}MB limit`);

        // Close the session
        await db.wiFiSession.update({
          where: { id: session.id },
          data: {
            status: 'terminated',
            endTime: new Date(),
            updatedAt: new Date(),
          },
        });

        // Suspend the WiFi user (deactivate RadCheck)
        await db.wiFiUser.update({
          where: { id: wifiUser.id },
          data: { status: 'suspended' },
        });

        await db.radCheck.updateMany({
          where: { username: wifiUser.username, attribute: 'Cleartext-Password' },
          data: { isActive: false },
        });

        // Add Session-Timeout = 1 to RadReply to immediately kick the user
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Session-Timeout',
            op: ':=',
            value: '1',
            isActive: true,
          },
        });

        enforced++;
      }
    }

    return enforced;
  }

  /**
   * Get active sessions count for a property
   */
  async getActiveSessionsCount(propertyId: string): Promise<number> {
    return db.wiFiSession.count({
      where: { status: 'active' },
    });
  }

  /**
   * Get bandwidth usage summary for a time period
   */
  async getBandwidthUsage(propertyId: string, startDate: Date, endDate: Date) {
    const sessions = await db.wiFiSession.findMany({
      where: {
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        dataUsed: true,
        duration: true,
      },
    });

    return {
      totalDataMB: sessions.reduce((sum, s) => sum + s.dataUsed, 0),
      totalDurationSeconds: sessions.reduce((sum, s) => sum + s.duration, 0),
      sessionCount: sessions.length,
    };
  }

  /**
   * Cleanup old ended sessions (retention period)
   */
  async cleanupOldSessions(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.wiFiSession.deleteMany({
      where: {
        endTime: { lt: cutoffDate },
        status: { in: ['ended', 'terminated'] },
      },
    });

    return result.count;
  }
}

// Singleton instance
export const wifiAccountingSyncService = new WiFiAccountingSyncService();
