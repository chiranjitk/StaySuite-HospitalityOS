/**
 * WiFi Accounting Sync Service
 * 
 * Syncs RADIUS accounting data (radacct) to WiFi sessions (wifi_session).
 * This runs as a background job every 1-5 minutes.
 * 
 * Flow:
 * FreeRADIUS → radacct table → this service → wifi_session
 * 
 * AI RULE: Do not implement RADIUS in Node.js
 * AI RULE: FreeRADIUS writes to radacct, PMS reads from radacct
 */

import { db } from '@/lib/db';

export interface AccountingSyncResult {
  processed: number;
  created: number;
  updated: number;
  closed: number;
  errors: number;
  lastRadAcctId: string;
}

export class WiFiAccountingSyncService {
  /**
   * Sync accounting data from radacct to wifi_session
   * 
   * This should be called by a cron job every 1-5 minutes.
   */
  async syncAccounting(tenantId?: string): Promise<AccountingSyncResult> {
    const result: AccountingSyncResult = {
      processed: 0,
      created: 0,
      updated: 0,
      closed: 0,
      errors: 0,
      lastRadAcctId: '',
    };

    try {
      // Get the last synced ID
      const syncRecord = await db.wiFiAccountingSync.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
      });

      const lastSyncedId = syncRecord?.lastRadAcctId || '';

      // Get new accounting records from radacct
      const newRecords = await db.radAcct.findMany({
        where: {
          // Only get records after the last synced ID
          // In production, use cursor-based pagination
          // radacctid: { gt: lastSyncedId },
        },
        orderBy: { radacctid: 'asc' },
        take: 1000, // Process in batches
      });

      for (const record of newRecords) {
        try {
          result.processed++;
          result.lastRadAcctId = record.radacctid;

          // Find the WiFi user by username
          const wifiUser = await db.wiFiUser.findFirst({
            where: { username: record.username },
          });

          if (!wifiUser) {
            // Skip records for unknown users
            continue;
          }

          if (record.acctstatus === 'start') {
            // Create new session
            await this.createSession(record, wifiUser.id);
            result.created++;
          } else if (record.acctstatus === 'interim') {
            // Update existing session
            await this.updateSession(record);
            result.updated++;
          } else if (record.acctstatus === 'stop') {
            // Close session
            await this.closeSession(record);
            result.closed++;

            // Update user stats
            await this.updateUserStats(wifiUser.id, record);
          }
        } catch (error) {
          result.errors++;
          console.error(`Error processing accounting record ${record.radacctid}:`, error);
        }
      }

      // Update sync record
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
            lastRadAcctId: result.lastRadAcctId,
            recordsProcessed: result.processed,
            errors: result.errors,
          },
        });
      }

      return result;
    } catch (error) {
      console.error('Accounting sync error:', error);
      throw error;
    }
  }

  /**
   * Create a new WiFi session from accounting start
   */
  private async createSession(record: any, wifiUserId: string) {
    return db.wiFiSession.create({
      data: {
        tenantId: '', // Get from wifiUser
        planId: null,
        guestId: null,
        bookingId: null,
        macAddress: record.callingstationid || 'unknown',
        ipAddress: record.framedipaddress,
        deviceName: null,
        deviceType: null,
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
  private async updateSession(record: any) {
    // Find existing session by unique ID
    const existingSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: record.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (!existingSession) {
      return null;
    }

    // Calculate data in MB
    const dataInMB = Math.floor((record.acctinputoctets + record.acctoutputoctets) / 1048576);
    const duration = record.acctsessiontime || 0;

    return db.wiFiSession.update({
      where: { id: existingSession.id },
      data: {
        dataUsed: dataInMB,
        duration,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Close session from accounting stop
   */
  private async closeSession(record: any) {
    const existingSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: record.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (!existingSession) {
      return null;
    }

    const dataInMB = Math.floor((record.acctinputoctets + record.acctoutputoctets) / 1048576);
    const duration = record.acctsessiontime || 0;

    return db.wiFiSession.update({
      where: { id: existingSession.id },
      data: {
        endTime: record.acctstoptime || new Date(),
        dataUsed: dataInMB,
        duration,
        status: 'ended',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update user stats after session ends
   */
  private async updateUserStats(wifiUserId: string, record: any) {
    return db.wiFiUser.update({
      where: { id: wifiUserId },
      data: {
        totalBytesIn: { increment: record.acctinputoctets || 0 },
        totalBytesOut: { increment: record.acctoutputoctets || 0 },
        sessionCount: { increment: 1 },
        lastAccountingAt: new Date(),
      },
    });
  }

  /**
   * Get active sessions count for a property
   */
  async getActiveSessionsCount(propertyId: string): Promise<number> {
    return db.wiFiSession.count({
      where: {
        status: 'active',
      },
    });
  }

  /**
   * Get bandwidth usage for a time period
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
   * Cleanup old sessions (older than retention period)
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
