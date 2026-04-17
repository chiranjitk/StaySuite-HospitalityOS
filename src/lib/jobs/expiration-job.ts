/**
 * WiFi User Expiration Job
 * 
 * Checks for expired WiFi users and:
 * - Updates status to 'expired'
 * - Disables RadCheck entries to prevent authentication
 * - Terminates active sessions
 * - Logs expiration events
 */

import { db } from '@/lib/db';

// Types
export interface ExpirationJobResult {
  totalExpired: number;
  usersProcessed: number;
  sessionsTerminated: number;
  errors: string[];
  processedAt: Date;
}

export interface ExpirationJobOptions {
  dryRun?: boolean;
  batchSize?: number;
  tenantId?: string;
}

/**
 * Run the WiFi user expiration job
 */
export async function runExpirationJob(
  options: ExpirationJobOptions = {}
): Promise<ExpirationJobResult> {
  const { dryRun = false, batchSize = 100, tenantId } = options;
  const errors: string[] = [];
  let totalExpired = 0;
  let usersProcessed = 0;
  let sessionsTerminated = 0;

  const now = new Date();

  // Find expired WiFi users
  const whereClause: Record<string, unknown> = {
    status: 'active',
    validUntil: { lt: now },
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  // Get expired users in batches
  let hasMore = true;
  let skip = 0;

  while (hasMore) {
    const expiredUsers = await db.wiFiUser.findMany({
      where: whereClause,
      take: batchSize,
      skip,
      include: {
        radCheck: {
          where: { isActive: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    if (expiredUsers.length === 0) {
      hasMore = false;
      break;
    }

    for (const user of expiredUsers) {
      try {
        if (!dryRun) {
          // Process expiration in a transaction
          await processUserExpiration(user.id, user.username);
          totalExpired++;
        } else {
          // Just count in dry run mode
          totalExpired++;
        }

        // Count active sessions that would be terminated
        const activeSessions = await db.wiFiSession.count({
          where: {
            guestId: user.guestId || undefined,
            status: 'active',
          },
        });
        sessionsTerminated += activeSessions;

        usersProcessed++;
      } catch (error) {
        errors.push(
          `Error processing user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    skip += batchSize;

    if (expiredUsers.length < batchSize) {
      hasMore = false;
    }
  }

  return {
    totalExpired,
    usersProcessed,
    sessionsTerminated,
    errors,
    processedAt: now,
  };
}

/**
 * Process a single user expiration
 */
async function processUserExpiration(
  userId: string,
  username: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // 1. Update WiFi user status
    await tx.wiFiUser.update({
      where: { id: userId },
      data: {
        status: 'expired',
        radiusSynced: false,
      },
    });

    // 2. Disable RadCheck entries (prevent authentication)
    await tx.radCheck.updateMany({
      where: {
        wifiUserId: userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // 3. Deactivate RadReply entries
    await tx.radReply.updateMany({
      where: {
        wifiUserId: userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // 4. Terminate any active sessions
    await tx.wiFiSession.updateMany({
      where: {
        guestId: (await tx.wiFiUser.findUnique({ where: { id: userId } }))?.guestId || 'none',
        status: 'active',
      },
      data: {
        status: 'terminated',
        endTime: new Date(),
      },
    });

    // 5. Create audit log entry
    await tx.auditLog.create({
      data: {
        tenantId: (await tx.wiFiUser.findUnique({ where: { id: userId } }))?.tenantId || 'system',
        module: 'wifi',
        action: 'expire',
        entityType: 'wifi_user',
        entityId: userId,
        newValue: JSON.stringify({
          username,
          reason: 'validUntil exceeded',
          expiredAt: new Date().toISOString(),
        }),
      },
    });
  });
}

/**
 * Get statistics about users nearing expiration
 */
export async function getExpirationStats(
  tenantId?: string
): Promise<{
  active: number;
  expiringIn24h: number;
  expiringIn7d: number;
  expiringIn30d: number;
  expired: number;
}> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const whereClause = tenantId ? { tenantId } : {};

  const [active, expiringIn24h, expiringIn7d, expiringIn30d, expired] = await Promise.all([
    db.wiFiUser.count({
      where: {
        ...whereClause,
        status: 'active',
        validUntil: { gt: now },
      },
    }),
    db.wiFiUser.count({
      where: {
        ...whereClause,
        status: 'active',
        validUntil: { gt: now, lte: in24h },
      },
    }),
    db.wiFiUser.count({
      where: {
        ...whereClause,
        status: 'active',
        validUntil: { gt: in24h, lte: in7d },
      },
    }),
    db.wiFiUser.count({
      where: {
        ...whereClause,
        status: 'active',
        validUntil: { gt: in7d, lte: in30d },
      },
    }),
    db.wiFiUser.count({
      where: {
        ...whereClause,
        status: 'expired',
      },
    }),
  ]);

  return {
    active,
    expiringIn24h,
    expiringIn7d,
    expiringIn30d,
    expired,
  };
}

/**
 * Extend WiFi user validity
 */
export async function extendUserValidity(
  userId: string,
  additionalDays: number
): Promise<void> {
  const user = await db.wiFiUser.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`WiFi user not found: ${userId}`);
  }

  const newValidUntil = new Date(
    user.validUntil.getTime() + additionalDays * 24 * 60 * 60 * 1000
  );

  await db.$transaction(async (tx) => {
    // Update user validity
    await tx.wiFiUser.update({
      where: { id: userId },
      data: {
        validUntil: newValidUntil,
        status: 'active',
      },
    });

    // Re-enable RadCheck
    await tx.radCheck.updateMany({
      where: { wifiUserId: userId },
      data: { isActive: true },
    });

    // Re-enable RadReply
    await tx.radReply.updateMany({
      where: { wifiUserId: userId },
      data: { isActive: true },
    });
  });
}

/**
 * Get users expiring soon for notifications
 */
export async function getUsersExpiringSoon(
  tenantId: string,
  hoursThreshold: number = 24
): Promise<Array<{
  id: string;
  username: string;
  validUntil: Date;
  guestId: string | null;
  guest: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
}>> {
  const now = new Date();
  const threshold = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

  const users = await db.wiFiUser.findMany({
    where: {
      tenantId,
      status: 'active',
      validUntil: { gt: now, lte: threshold },
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Fetch guest data separately for users that have a guestId
  const usersWithGuests = await Promise.all(
    users.map(async (user) => {
      let guestData: {
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
      } | null = null;
      if (user.guestId) {
        const guest = await db.guest.findUnique({
          where: { id: user.guestId },
          select: { firstName: true, lastName: true, email: true, phone: true },
        });
        if (guest) guestData = guest;
      }
      return {
        id: user.id,
        username: user.username,
        validUntil: user.validUntil,
        guestId: user.guestId,
        guest: guestData,
      };
    })
  );

  return usersWithGuests;
}

// Export singleton functions
export const expirationJob = {
  run: runExpirationJob,
  getStats: getExpirationStats,
  extendUser: extendUserValidity,
  getExpiringSoon: getUsersExpiringSoon,
};
