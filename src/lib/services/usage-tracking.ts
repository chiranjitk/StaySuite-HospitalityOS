/**
 * Usage Tracking Service
 * 
 * This service provides functions to track and log usage metrics for tenants.
 * It tracks API calls, messages, emails, SMS, storage uploads, and webhooks.
 */

import { db } from '@/lib/db';

export type UsageType = 'api_call' | 'message' | 'storage_upload' | 'email' | 'sms' | 'webhook';

export interface UsageLogInput {
  tenantId: string;
  type: UsageType;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  dataSize?: number;
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a usage event
 */
export async function logUsage(input: UsageLogInput): Promise<void> {
  try {
    await db.usageLog.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        dataSize: input.dataSize || 0,
        duration: input.duration,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        userId: input.userId,
        metadata: JSON.stringify(input.metadata || {}),
      },
    });

    // Update usage summary
    await updateUsageSummary(input.tenantId, input.type, input.dataSize || 0);
  } catch (error) {
    console.error('Error logging usage:', error);
    // Don't throw - usage logging should not break the main flow
  }
}

/**
 * Update the usage summary for a tenant
 */
async function updateUsageSummary(tenantId: string, type: UsageType, dataSize: number): Promise<void> {
  try {
    // Try to upsert the usage summary
    const existing = await db.usageSummary.findUnique({
      where: { tenantId },
    });

    if (existing) {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      switch (type) {
        case 'api_call':
          updateData.apiCalls = { increment: 1 };
          updateData.apiCallsMonth = { increment: 1 };
          updateData.lastApiCallAt = new Date();
          break;
        case 'message':
          updateData.messagesSent = { increment: 1 };
          updateData.messagesMonth = { increment: 1 };
          updateData.lastMessageAt = new Date();
          break;
        case 'email':
          updateData.emailsSent = { increment: 1 };
          updateData.emailsMonth = { increment: 1 };
          updateData.lastMessageAt = new Date();
          break;
        case 'sms':
          updateData.smsSent = { increment: 1 };
          updateData.smsMonth = { increment: 1 };
          updateData.lastMessageAt = new Date();
          break;
        case 'storage_upload':
          updateData.storageUsedMb = { increment: dataSize / (1024 * 1024) };
          updateData.storageFiles = { increment: 1 };
          updateData.lastStorageUploadAt = new Date();
          break;
        case 'webhook':
          updateData.webhooksSent = { increment: 1 };
          updateData.webhooksMonth = { increment: 1 };
          break;
      }

      await db.usageSummary.update({
        where: { tenantId },
        data: updateData,
      });
    } else {
      // Create new summary
      await db.usageSummary.create({
        data: {
          tenantId,
          apiCalls: type === 'api_call' ? 1 : 0,
          apiCallsMonth: type === 'api_call' ? 1 : 0,
          messagesSent: type === 'message' ? 1 : 0,
          messagesMonth: type === 'message' ? 1 : 0,
          emailsSent: type === 'email' ? 1 : 0,
          emailsMonth: type === 'email' ? 1 : 0,
          smsSent: type === 'sms' ? 1 : 0,
          smsMonth: type === 'sms' ? 1 : 0,
          storageUsedMb: type === 'storage_upload' ? dataSize / (1024 * 1024) : 0,
          storageFiles: type === 'storage_upload' ? 1 : 0,
          webhooksSent: type === 'webhook' ? 1 : 0,
          webhooksMonth: type === 'webhook' ? 1 : 0,
          lastApiCallAt: type === 'api_call' ? new Date() : null,
          lastMessageAt: ['message', 'email', 'sms'].includes(type) ? new Date() : null,
          lastStorageUploadAt: type === 'storage_upload' ? new Date() : null,
        },
      });
    }
  } catch (error) {
    console.error('Error updating usage summary:', error);
  }
}

/**
 * Get usage statistics for a tenant
 */
export async function getUsageStats(tenantId: string) {
  const summary = await db.usageSummary.findUnique({
    where: { tenantId },
  });

  if (!summary) {
    return {
      apiCalls: 0,
      apiCallsMonth: 0,
      messages: 0,
      messagesMonth: 0,
      storageUsedMb: 0,
      storageFiles: 0,
      webhooksSent: 0,
      webhooksMonth: 0,
    };
  }

  return {
    apiCalls: summary.apiCalls,
    apiCallsMonth: summary.apiCallsMonth,
    messages: summary.messagesSent + summary.emailsSent + summary.smsSent,
    messagesMonth: summary.messagesMonth + summary.emailsMonth + summary.smsMonth,
    storageUsedMb: summary.storageUsedMb,
    storageFiles: summary.storageFiles,
    webhooksSent: summary.webhooksSent,
    webhooksMonth: summary.webhooksMonth,
    lastApiCallAt: summary.lastApiCallAt,
    lastMessageAt: summary.lastMessageAt,
    lastStorageUploadAt: summary.lastStorageUploadAt,
  };
}

/**
 * Reset monthly usage counters (should be called by a cron job)
 */
export async function resetMonthlyUsage(): Promise<void> {
  try {
    await db.usageSummary.updateMany({
      data: {
        apiCallsMonth: 0,
        messagesMonth: 0,
        emailsMonth: 0,
        smsMonth: 0,
        webhooksMonth: 0,
        lastResetAt: new Date(),
      },
    });
    console.log('Monthly usage counters reset successfully');
  } catch (error) {
    console.error('Error resetting monthly usage:', error);
  }
}

/**
 * Track API call with timing
 */
export async function trackApiCall(
  tenantId: string,
  endpoint: string,
  method: string,
  handler: () => Promise<{ status: number; data: unknown }>,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
  }
): Promise<{ status: number; data: unknown }> {
  const startTime = Date.now();
  
  try {
    const result = await handler();
    const duration = Date.now() - startTime;

    await logUsage({
      tenantId,
      type: 'api_call',
      endpoint,
      method,
      statusCode: result.status,
      duration,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      userId: metadata?.userId,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logUsage({
      tenantId,
      type: 'api_call',
      endpoint,
      method,
      statusCode: 500,
      duration,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      userId: metadata?.userId,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    throw error;
  }
}

/**
 * Track message sent
 */
export async function trackMessage(
  tenantId: string,
  type: 'message' | 'email' | 'sms',
  metadata?: {
    recipient?: string;
    userId?: string;
  }
): Promise<void> {
  await logUsage({
    tenantId,
    type,
    userId: metadata?.userId,
    metadata: metadata ? { recipient: metadata.recipient } : undefined,
  });
}

/**
 * Track storage upload
 */
export async function trackStorageUpload(
  tenantId: string,
  fileSize: number,
  metadata?: {
    fileName?: string;
    fileType?: string;
    userId?: string;
  }
): Promise<void> {
  await logUsage({
    tenantId,
    type: 'storage_upload',
    dataSize: fileSize,
    userId: metadata?.userId,
    metadata: metadata ? { fileName: metadata.fileName, fileType: metadata.fileType } : undefined,
  });
}

/**
 * Track webhook sent
 */
export async function trackWebhook(
  tenantId: string,
  endpoint: string,
  statusCode: number,
  metadata?: {
    event?: string;
    duration?: number;
  }
): Promise<void> {
  await logUsage({
    tenantId,
    type: 'webhook',
    endpoint,
    statusCode,
    duration: metadata?.duration,
    metadata: metadata ? { event: metadata.event } : undefined,
  });
}
