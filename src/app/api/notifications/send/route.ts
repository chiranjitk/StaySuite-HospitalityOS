/**
 * Notifications Send API Route
 * 
 * POST: Send notification through multiple channels
 * - Support for immediate and scheduled delivery
 * - Template variable substitution
 * - Multi-channel delivery (email, sms, push, in_app)
 * - Integration with email-service and sms-service for bulk sending
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  notificationService,
  NotificationData,
  NotificationChannel,
  NotificationCategory,
  NotificationPriority,
} from '@/lib/services/notification-service';
import { emailService } from '@/lib/services/email-service';
import { smsService } from '@/lib/services/sms-service';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Interface for send request
interface SendRequest {
  // Recipient
  userId?: string;
  guestId?: string;
  recipientEmail?: string;
  recipientPhone?: string;

  // Content
  title?: string;
  message?: string;
  subject?: string; // Alias for title
  body?: string; // Alias for message

  // Template
  templateId?: string;
  templateCode?: string; // Alternative: find by code/triggerEvent
  variables?: Record<string, string | number | boolean>;

  // Channels
  channels?: NotificationChannel[];

  // Options
  type?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  scheduledFor?: string;

  // Additional data
  data?: Record<string, unknown>;
  link?: string;
  icon?: string;
  image?: string;
  actionType?: string;
  actionData?: Record<string, unknown>;
  expiresAt?: string;

  // Bulk options
  recipients?: Array<{
    userId?: string;
    guestId?: string;
    email?: string;
    phone?: string;
  }>;

  // Campaign options
  campaignId?: string;
  useQueue?: boolean; // Use queue for bulk sending
}

// POST - Send notification through multiple channels
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.send')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body: SendRequest = await request.json();
    const {
      userId,
      guestId,
      recipientEmail,
      recipientPhone,
      title: inputTitle,
      message: inputMessage,
      subject,
      body: messageBody,
      templateId,
      templateCode,
      variables = {},
      channels,
      type = 'system',
      category = 'info',
      priority = 'normal',
      scheduledFor,
      data,
      link,
      icon,
      image,
      actionType,
      actionData,
      expiresAt,
      recipients,
      campaignId,
      useQueue = false,
    } = body;

    // Resolve title and message
    let resolvedTitle = inputTitle || subject || '';
    let resolvedMessage = inputMessage || messageBody || '';

    // Handle bulk sending
    if (recipients && recipients.length > 0) {
      return handleBulkSend({
        tenantId: user.tenantId,
        recipients,
        title: resolvedTitle,
        message: resolvedMessage,
        templateId,
        templateCode,
        variables,
        channels,
        type,
        category,
        priority,
        scheduledFor,
        data,
        link,
        icon,
        image,
        actionType,
        actionData,
        expiresAt,
        campaignId,
        useQueue,
      });
    }

    // Get template if specified
    let resolvedTemplateId = templateId;
    let resolvedType = type;
    let resolvedCategory = category;

    if (templateCode && !templateId) {
      const template = await db.notificationTemplate.findFirst({
        where: {
          tenantId: user.tenantId,
          triggerEvent: templateCode,
          isActive: true,
        },
      });
      if (template) {
        resolvedTemplateId = template.id;
        resolvedTitle = resolvedTitle || template.subject || '';
        resolvedMessage = resolvedMessage || template.body;
        resolvedType = type || template.triggerEvent?.split('.')[0] || 'system';
        resolvedCategory = category || (template.triggerEvent?.split('.')[1] as NotificationCategory) || 'info';
      }
    } else if (templateId) {
      const template = await db.notificationTemplate.findUnique({
        where: { id: templateId },
      });
      if (template) {
        resolvedTitle = resolvedTitle || template.subject || '';
        resolvedMessage = resolvedMessage || template.body;
        resolvedType = type || template.triggerEvent?.split('.')[0] || 'system';
        resolvedCategory = category || (template.triggerEvent?.split('.')[1] as NotificationCategory) || 'info';
      }
    }

    // Apply template variable substitution
    if (variables && Object.keys(variables).length > 0) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        resolvedTitle = resolvedTitle.replace(new RegExp(placeholder, 'g'), String(value));
        resolvedMessage = resolvedMessage.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    // Validate required fields
    if (!resolvedTitle && !resolvedMessage) {
      return NextResponse.json(
        { success: false, error: 'Title or message is required' },
        { status: 400 }
      );
    }

    if (!userId && !guestId && !recipientEmail && !recipientPhone) {
      return NextResponse.json(
        { success: false, error: 'Recipient is required (userId, guestId, email, or phone)' },
        { status: 400 }
      );
    }

    // Build notification data
    const notificationData: NotificationData = {
      tenantId: user.tenantId,
      userId,
      guestId,
      type: resolvedType,
      category: resolvedCategory,
      title: resolvedTitle,
      message: resolvedMessage,
      data: data || {},
      link,
      icon,
      image,
      priority: priority as NotificationPriority,
      channels: channels,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      templateId: resolvedTemplateId,
      templateVariables: variables,
      actionType,
      actionData,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    // Handle direct recipient (email/phone without user/guest ID)
    if (!userId && !guestId && (recipientEmail || recipientPhone)) {
      // Try to find user by email or phone
      let resolvedUserId: string | undefined;
      
      if (recipientEmail) {
        const foundUser = await db.user.findFirst({
          where: { email: recipientEmail, tenantId: user.tenantId },
          select: { id: true },
        });
        if (foundUser) {
          resolvedUserId = foundUser.id;
        }
      }
      
      if (!resolvedUserId && recipientPhone) {
        const foundUser = await db.user.findFirst({
          where: { phone: recipientPhone, tenantId: user.tenantId },
          select: { id: true },
        });
        if (foundUser) {
          resolvedUserId = foundUser.id;
        }
      }

      notificationData.userId = resolvedUserId;

      // If no user found, send directly to email/phone using services
      if (!resolvedUserId) {
        const results: { email?: { success: boolean; error?: string }; sms?: { success: boolean; error?: string } } = {};
        
        if (channels?.includes('email') && recipientEmail) {
          const emailResult = await emailService.send({
            to: recipientEmail,
            subject: resolvedTitle,
            text: resolvedMessage,
            html: resolvedMessage,
            templateId: resolvedTemplateId,
            variables,
          });
          results.email = { success: emailResult.success, error: emailResult.error };
        }

        if (channels?.includes('sms') && recipientPhone) {
          const smsResult = await smsService.send({
            to: recipientPhone,
            message: `${resolvedTitle}\n\n${resolvedMessage}`,
            templateId: resolvedTemplateId,
            variables,
          });
          results.sms = { success: smsResult.success, error: smsResult.error };
        }

        return NextResponse.json({
          success: results.email?.success || results.sms?.success || false,
          data: {
            channels: results,
          },
          message: 'Notification sent directly to email/phone',
        });
      }
    }

    // Send the notification
    const result = await notificationService.send(notificationData);

    return NextResponse.json({
      success: result.success,
      data: {
        notificationId: result.notificationId,
        scheduledNotificationId: result.scheduledNotificationId,
        channels: result.channels,
      },
      errors: result.errors,
      message: result.success
        ? (result.scheduledNotificationId
          ? 'Notification scheduled successfully'
          : 'Notification sent successfully')
        : 'Failed to send notification',
    });
  } catch (error) {
    console.error('Error in send route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process notification request' },
      { status: 500 }
    );
  }
}

// Handle bulk sending
async function handleBulkSend(params: {
  tenantId: string;
  recipients: Array<{
    userId?: string;
    guestId?: string;
    email?: string;
    phone?: string;
  }>;
  title: string;
  message: string;
  templateId?: string;
  templateCode?: string;
  variables?: Record<string, string | number | boolean>;
  channels?: NotificationChannel[];
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  scheduledFor?: string;
  data?: Record<string, unknown>;
  link?: string;
  icon?: string;
  image?: string;
  actionType?: string;
  actionData?: Record<string, unknown>;
  expiresAt?: string;
  campaignId?: string;
  useQueue?: boolean;
}): Promise<NextResponse> {
  const {
    tenantId,
    recipients,
    title,
    message,
    templateId,
    templateCode,
    variables,
    channels,
    type,
    category,
    priority,
    scheduledFor,
    data,
    link,
    icon,
    image,
    actionType,
    actionData,
    expiresAt,
    campaignId,
    useQueue,
  } = params;

  // Get template if specified
  let resolvedTemplateId = templateId;
  let resolvedTitle = title;
  let resolvedMessage = message;
  let resolvedType = type;
  let resolvedCategory = category;

  if (templateCode && !templateId) {
    const template = await db.notificationTemplate.findFirst({
      where: {
        tenantId,
        triggerEvent: templateCode,
        isActive: true,
      },
    });
    if (template) {
      resolvedTemplateId = template.id;
      resolvedTitle = title || template.subject || '';
      resolvedMessage = message || template.body;
      resolvedType = type || template.triggerEvent?.split('.')[0] || 'system';
      resolvedCategory = category || (template.triggerEvent?.split('.')[1] as NotificationCategory) || 'info';
    }
  }

  // Use queue-based bulk sending for large batches
  if (useQueue && recipients.length > 10) {
    return handleQueuedBulkSend({
      tenantId,
      recipients,
      title: resolvedTitle,
      message: resolvedMessage,
      templateId: resolvedTemplateId,
      variables,
      channels,
      category: resolvedCategory,
      priority,
      scheduledFor,
      campaignId,
    });
  }

  // Send to each recipient
  const results: Array<{
    recipient: { userId?: string; guestId?: string; email?: string; phone?: string };
    success: boolean;
    notificationId?: string;
    error?: string;
  }> = [];

  for (const recipient of recipients) {
    try {
      // Apply recipient-specific variable substitution if variables contain recipient data
      let finalTitle = resolvedTitle;
      let finalMessage = resolvedMessage;

      if (variables) {
        // Add recipient data to variables
        const enrichedVars = {
          ...variables,
          email: recipient.email || '',
          phone: recipient.phone || '',
        };

        for (const [key, value] of Object.entries(enrichedVars)) {
          const placeholder = `{{${key}}}`;
          finalTitle = finalTitle.replace(new RegExp(placeholder, 'g'), String(value));
          finalMessage = finalMessage.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }

      const notificationData: NotificationData = {
        tenantId,
        userId: recipient.userId,
        guestId: recipient.guestId,
        type: resolvedType,
        category: resolvedCategory,
        title: finalTitle,
        message: finalMessage,
        data: data || {},
        link,
        icon,
        image,
        priority: priority as NotificationPriority,
        channels: channels,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        templateId: resolvedTemplateId,
        templateVariables: variables,
        actionType,
        actionData,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      };

      const result = await notificationService.send(notificationData);

      results.push({
        recipient,
        success: result.success,
        notificationId: result.notificationId || result.scheduledNotificationId,
        error: result.errors?.join(', '),
      });
    } catch (error) {
      results.push({
        recipient,
        success: false,
        error: 'An unexpected error occurred',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: failureCount === 0,
    data: {
      total: recipients.length,
      sent: successCount,
      failed: failureCount,
      results,
    },
    message: `Sent ${successCount} of ${recipients.length} notifications`,
  });
}

// Handle queued bulk sending for large batches
async function handleQueuedBulkSend(params: {
  tenantId: string;
  recipients: Array<{
    userId?: string;
    guestId?: string;
    email?: string;
    phone?: string;
  }>;
  title: string;
  message: string;
  templateId?: string;
  variables?: Record<string, string | number | boolean>;
  channels?: NotificationChannel[];
  category: NotificationCategory;
  priority: NotificationPriority;
  scheduledFor?: string;
  campaignId?: string;
}): Promise<NextResponse> {
  const {
    tenantId,
    recipients,
    title,
    message,
    templateId,
    variables,
    channels,
    scheduledFor,
    campaignId,
  } = params;

  // Prepare email recipients
  const emailRecipients = recipients
    .filter(r => r.email)
    .map(r => ({
      email: r.email!,
      variables: {
        ...variables,
        email: r.email,
      },
    }));

  // Prepare SMS recipients
  const smsRecipients = recipients
    .filter(r => r.phone)
    .map(r => ({
      phone: r.phone!,
      variables: {
        ...variables,
        phone: r.phone,
      },
    }));

  const bulkResults: {
    email?: { queued: number; queueId: string };
    sms?: { queued: number; queueId: string; invalid: number };
  } = {};

  // Queue emails if email channel is selected
  if (channels?.includes('email') && emailRecipients.length > 0) {
    bulkResults.email = await emailService.sendBulk(
      tenantId,
      emailRecipients.map(r => ({
        to: r.email,
        subject: title,
        html: message,
        text: message,
        templateId: templateId ?? '',
        variables: r.variables as Record<string, unknown>,
      })) as any[],
      {
        campaignId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      }
    );
  }

  // Queue SMS if SMS channel is selected
  if (channels?.includes('sms') && smsRecipients.length > 0) {
    bulkResults.sms = await smsService.sendBulk(
      tenantId,
      smsRecipients.map(r => ({
        to: r.phone,
        message: `${title}\n\n${message}`,
        templateId,
        variables: r.variables as Record<string, unknown>,
      })),
      {
        campaignId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      }
    );
  }

  const totalQueued = (bulkResults.email?.queued || 0) + (bulkResults.sms?.queued || 0);

  return NextResponse.json({
    success: true,
    data: {
      total: recipients.length,
      queued: totalQueued,
      results: bulkResults,
    },
    message: `Queued ${totalQueued} notifications for delivery`,
  });
}

// GET - Get scheduled notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.view')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status !== 'all') {
      where.status = status;
    }

    const [scheduled, total] = await Promise.all([
      db.scheduledNotification.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.scheduledNotification.count({ where }),
    ]);

    // Get queue status from services
    const emailQueueStatus = emailService.getQueueStatus();
    const smsQueueStatus = smsService.getQueueStatus();

    return NextResponse.json({
      success: true,
      data: {
        scheduled: scheduled.map(s => ({
          id: s.id,
          recipientType: s.recipientType,
          recipientId: s.recipientId,
          recipientEmail: s.recipientEmail,
          recipientPhone: s.recipientPhone,
          channels: JSON.parse(s.channels),
          subject: s.subject,
          body: s.body,
          data: JSON.parse(s.data),
          scheduledFor: s.scheduledFor,
          status: s.status,
          processedAt: s.processedAt,
          sentAt: s.sentAt,
          errorMessage: s.errorMessage,
          retryCount: s.retryCount,
          createdAt: s.createdAt,
        })),
        total,
        queueStatus: {
          email: emailQueueStatus,
          sms: smsQueueStatus,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching scheduled notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled notifications' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel scheduled notification
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Scheduled notification ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const scheduledNotification = await db.scheduledNotification.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!scheduledNotification) {
      return NextResponse.json(
        { success: false, error: 'Scheduled notification not found' },
        { status: 404 }
      );
    }

    const cancelled = await notificationService.cancelScheduledNotification(id);

    return NextResponse.json({
      success: cancelled,
      message: cancelled
        ? 'Scheduled notification cancelled successfully'
        : 'Failed to cancel notification (may already be processed)',
    });
  } catch (error) {
    console.error('Error cancelling scheduled notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel scheduled notification' },
      { status: 500 }
    );
  }
}
