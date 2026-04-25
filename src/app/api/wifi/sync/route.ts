/**
 * WiFi Accounting Sync API Route
 * 
 * Triggers sync of RADIUS accounting data (radacct) to wifi_session.
 * This can be called by a cron job or manually.
 * 
 * After updating session data usage, checks data limits and terminates
 * sessions that have exceeded their limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkDataLimit, enforceDataLimit } from '@/lib/wifi/utils/data-limits';
import { logSystem } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/wifi/sync/accounting - Sync accounting data
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { propertyId, batchSize = 1000 } = body;
    // Use authenticated tenantId, ignoring any tenantId from body
    const tenantId = context.tenantId;

    // Get last sync position
    const syncRecord = await db.wiFiAccountingSync.findFirst({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { lastSyncedAt: 'desc' },
    });

    const lastRadAcctId = syncRecord?.lastRadAcctId || '0';

    // Get new accounting records
    const newRecords = await db.radAcct.findMany({
      where: {
        radacctid: { gt: lastRadAcctId },
      },
      orderBy: { radacctid: 'asc' },
      take: batchSize,
    });

    let processed = 0;
    let created = 0;
    let updated = 0;
    let closed = 0;
    let errors = 0;
    let dataLimitExceeded = 0;
    let lastId = lastRadAcctId;

    for (const record of newRecords) {
      try {
        processed++;
        lastId = record.radacctid;

        if (record.acctstatus === 'start') {
          // Create new session
          // Find WiFi user by username
          const wifiUser = await db.wiFiUser.findFirst({
            where: { username: record.username },
          });

          if (wifiUser) {
            await db.wiFiSession.create({
              data: {
                tenantId: wifiUser.tenantId,
                planId: wifiUser.planId,
                guestId: wifiUser.guestId,
                bookingId: wifiUser.bookingId,
                macAddress: record.callingstationid || 'unknown',
                ipAddress: record.framedipaddress,
                startTime: record.acctstarttime,
                status: 'active',
                authMethod: 'portal',
              },
            });
            created++;
          }
        } else if (record.acctstatus === 'interim') {
          // Update existing session
          const existingSession = await db.wiFiSession.findFirst({
            where: {
              macAddress: record.callingstationid || 'unknown',
              status: 'active',
            },
          });

          if (existingSession) {
            const dataInMB = Math.floor(((record.acctinputoctets || 0) + (record.acctoutputoctets || 0)) / 1048576);
            const duration = record.acctsessiontime || 0;

            await db.wiFiSession.update({
              where: { id: existingSession.id },
              data: {
                dataUsed: dataInMB,
                duration,
              },
            });

            // Check data limit
            try {
              const limitResult = await enforceDataLimit(existingSession.id);
              if (limitResult.terminated) {
                dataLimitExceeded++;
                
                // Log data limit event
                if (tenantId) {
                  await logSystem(tenantId, 'data_limit_exceeded' as any, 'wifi_session', existingSession.id, {
                    dataUsed: limitResult.dataLimit?.dataUsed,
                    dataLimit: limitResult.dataLimit?.dataLimit,
                    reason: limitResult.reason,
                  });
                }
              }
            } catch (limitError) {
              console.error(`Error enforcing data limit for session ${existingSession.id}:`, limitError);
            }

            updated++;
          }
        } else if (record.acctstatus === 'stop') {
          // Close session
          const existingSession = await db.wiFiSession.findFirst({
            where: {
              macAddress: record.callingstationid || 'unknown',
              status: 'active',
            },
          });

          if (existingSession) {
            const dataInMB = Math.floor(((record.acctinputoctets || 0) + (record.acctoutputoctets || 0)) / 1048576);
            const duration = record.acctsessiontime || 0;

            await db.wiFiSession.update({
              where: { id: existingSession.id },
              data: {
                endTime: record.acctstoptime || new Date(),
                dataUsed: dataInMB,
                duration,
                status: 'ended',
              },
            });

            // Update user stats
            await db.wiFiUser.updateMany({
              where: { username: record.username },
              data: {
                totalBytesIn: { increment: record.acctinputoctets || 0 },
                totalBytesOut: { increment: record.acctoutputoctets || 0 },
                sessionCount: { increment: 1 },
                lastAccountingAt: new Date(),
              },
            });

            closed++;
          }
        }
      } catch (error) {
        errors++;
        console.error(`Error processing record ${record.radacctid}:`, error);
      }
    }

    // Update or create sync record (upsert instead of always creating new)
    if (lastId !== lastRadAcctId) {
      if (syncRecord) {
        await db.wiFiAccountingSync.update({
          where: { id: syncRecord.id },
          data: {
            lastRadAcctId: lastId,
            recordsProcessed: processed,
            errors,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        await db.wiFiAccountingSync.create({
          data: {
            tenantId,
            lastRadAcctId: lastId,
            recordsProcessed: processed,
            errors,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        created,
        updated,
        closed,
        errors,
        dataLimitExceeded,
        lastRadAcctId: lastId,
      },
      message: 'Accounting sync completed',
    });
  } catch (error) {
    console.error('Error syncing accounting data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync accounting data' },
      { status: 500 }
    );
  }
}

// GET /api/wifi/sync/accounting - Get sync status
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const syncRecords = await db.wiFiAccountingSync.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      take: 10,
    });

    const stats = await db.radAcct.aggregate({
      _count: true,
      _max: { radacctid: true },
    });

    const activeSessions = await db.wiFiSession.count({
      where: { status: 'active' },
    });

    // Get data limit enforcement status
    const dataLimitStats = await checkAllDataLimitStatus(context.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        syncHistory: syncRecords,
        totalRadAcct: stats._count,
        maxRadAcctId: stats._max.radacctid,
        activeSessions,
        dataLimits: dataLimitStats,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}

/**
 * Get data limit status for all active sessions
 */
async function checkAllDataLimitStatus(tenantId?: string): Promise<{
  totalActive: number;
  nearLimit: number; // > 80%
  overLimit: number;
}> {
  const activeSessions = await db.wiFiSession.findMany({
    where: { status: 'active', ...(tenantId ? { tenantId } : {}) },
    include: {
      plan: {
        select: { dataLimit: true },
      },
    },
  });

  let nearLimit = 0;
  let overLimit = 0;

  for (const session of activeSessions) {
    try {
      const check = await checkDataLimit(session.id);
      if (check.exceeded) {
        overLimit++;
      } else if (check.percentUsed >= 80) {
        nearLimit++;
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    totalActive: activeSessions.length,
    nearLimit,
    overLimit,
  };
}
