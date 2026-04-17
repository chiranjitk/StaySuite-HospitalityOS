/**
 * StaySuite Notification Service
 * 
 * Comprehensive notification service supporting:
 * - Push notifications (Firebase FCM compatible)
 * - Email notifications
 * - SMS notifications
 * - In-app notifications
 * - Template-based notifications
 * - Scheduled notifications
 * - User preferences
 */

import { db } from '@/lib/db';
import { sendEmail, EmailOptions, EmailResult } from '@/lib/adapters/email';
import { sendSMS, SMSMessage, SMSMessageResult } from '@/lib/integrations/sms';

// Types
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory = 'info' | 'warning' | 'success' | 'error';

export interface NotificationData {
  tenantId: string;
  userId?: string;
  guestId?: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
  icon?: string;
  image?: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  templateId?: string;
  templateVariables?: Record<string, string | number | boolean>;
  actionType?: string;
  actionData?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  scheduledNotificationId?: string;
  channels: {
    email?: EmailResult;
    sms?: SMSMessageResult;
    push?: PushResult;
    in_app?: InAppResult;
  };
  errors?: string[];
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentCount?: number;
}

export interface InAppResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

export interface UserPreference {
  category: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

// Default notification preferences
const DEFAULT_PREFERENCES: Record<string, Partial<UserPreference>> = {
  booking: { emailEnabled: true, smsEnabled: true, pushEnabled: true, inAppEnabled: true },
  payment: { emailEnabled: true, smsEnabled: true, pushEnabled: false, inAppEnabled: true },
  housekeeping: { emailEnabled: false, smsEnabled: false, pushEnabled: true, inAppEnabled: true },
  maintenance: { emailEnabled: false, smsEnabled: false, pushEnabled: true, inAppEnabled: true },
  marketing: { emailEnabled: true, smsEnabled: false, pushEnabled: false, inAppEnabled: false },
  system: { emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true },
};

/**
 * Notification Service Class
 */
export class NotificationService {
  private fcmServerKey?: string;
  private fcmSenderId?: string;

  constructor() {
    this.fcmServerKey = process.env.FCM_SERVER_KEY;
    this.fcmSenderId = process.env.FCM_SENDER_ID;
  }

  /**
   * Send notification through multiple channels
   */
  async send(data: NotificationData): Promise<NotificationResult> {
    const errors: string[] = [];
    const channels: NotificationResult['channels'] = {};

    try {
      // Determine channels to use
      const channelsToUse = await this.resolveChannels(data);
      
      // Check if it's a scheduled notification
      if (data.scheduledFor && new Date(data.scheduledFor) > new Date()) {
        return await this.scheduleNotification(data, channelsToUse);
      }

      // Get template if specified
      let processedData = { ...data };
      if (data.templateId) {
        processedData = await this.applyTemplate(data);
      }

      // Get user preferences and check quiet hours
      const preferences = await this.getUserPreferences(data.tenantId, data.userId);
      const isQuietHours = this.checkQuietHours(preferences);

      // Send through each channel
      for (const channel of channelsToUse) {
        try {
          // Check preference for this channel
          if (!this.isChannelEnabled(channel, processedData.type, preferences)) {
            continue;
          }

          // Skip push and SMS during quiet hours (except urgent)
          if (isQuietHours && processedData.priority !== 'urgent') {
            if (channel === 'sms' || channel === 'push') {
              continue;
            }
          }

          switch (channel) {
            case 'email':
              channels.email = await this.sendEmailNotification(processedData);
              break;
            case 'sms':
              channels.sms = await this.sendSMSNotification(processedData);
              break;
            case 'push':
              channels.push = await this.sendPushNotification(processedData);
              break;
            case 'in_app':
              channels.in_app = await this.sendInAppNotification(processedData);
              break;
          }
        } catch (error) {
          errors.push(`${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Log the notification
      await this.logNotification(processedData, channels);

      return {
        success: errors.length === 0 || Object.values(channels).some(c => c?.success),
        notificationId: channels.in_app?.notificationId,
        channels,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, channels, errors };
    }
  }

  /**
   * Send immediate notification (convenience method)
   */
  async sendImmediate(
    tenantId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    options?: Partial<NotificationData>
  ): Promise<NotificationResult> {
    return this.send({
      tenantId,
      userId,
      type,
      category: options?.category || 'info',
      title,
      message,
      ...options,
    });
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(
    data: NotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationResult> {
    const scheduled = await db.scheduledNotification.create({
      data: {
        tenantId: data.tenantId,
        templateId: data.templateId,
        recipientType: data.userId ? 'user' : 'guest',
        recipientId: data.userId || data.guestId || '',
        recipientEmail: await this.getRecipientEmail(data),
        recipientPhone: await this.getRecipientPhone(data),
        channels: JSON.stringify(channels),
        subject: data.title,
        body: data.message,
        data: JSON.stringify({
          ...data.data,
          type: data.type,
          category: data.category,
          link: data.link,
          icon: data.icon,
          image: data.image,
          priority: data.priority,
          actionType: data.actionType,
          actionData: data.actionData,
          templateVariables: data.templateVariables,
        }),
        scheduledFor: data.scheduledFor!,
        status: 'pending',
      },
    });

    return {
      success: true,
      scheduledNotificationId: scheduled.id,
      channels: {},
    };
  }

  /**
   * Process scheduled notifications that are due
   */
  async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const dueNotifications = await db.scheduledNotification.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: now },
      },
      take: 100,
    });

    for (const scheduled of dueNotifications) {
      try {
        // Mark as processing
        await db.scheduledNotification.update({
          where: { id: scheduled.id },
          data: { status: 'processing', processedAt: now },
        });

        const data: NotificationData = JSON.parse(scheduled.data);
        const channels = JSON.parse(scheduled.channels) as NotificationChannel[];

        data.userId = scheduled.recipientType === 'user' ? scheduled.recipientId : undefined;
        data.guestId = scheduled.recipientType === 'guest' ? scheduled.recipientId : undefined;
        data.title = scheduled.subject || data.title;
        data.message = scheduled.body;

        // Send through each channel
        for (const channel of channels) {
          switch (channel) {
            case 'email':
              if (scheduled.recipientEmail) {
                await this.sendEmailNotification(data);
              }
              break;
            case 'sms':
              if (scheduled.recipientPhone) {
                await this.sendSMSNotification(data);
              }
              break;
            case 'push':
              await this.sendPushNotification(data);
              break;
            case 'in_app':
              await this.sendInAppNotification(data);
              break;
          }
        }

        // Mark as sent
        await db.scheduledNotification.update({
          where: { id: scheduled.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const retryCount = scheduled.retryCount + 1;
        
        await db.scheduledNotification.update({
          where: { id: scheduled.id },
          data: {
            status: retryCount >= scheduled.maxRetries ? 'failed' : 'pending',
            errorMessage,
            retryCount,
            nextRetryAt: retryCount < scheduled.maxRetries 
              ? new Date(Date.now() + Math.pow(2, retryCount) * 60000) // Exponential backoff
              : null,
          },
        });
      }
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(id: string): Promise<boolean> {
    const result = await db.scheduledNotification.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'cancelled' },
    });
    return result.count > 0;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(data: NotificationData): Promise<EmailResult> {
    const email = await this.getRecipientEmail(data);
    if (!email) {
      return { success: false, error: 'No email address found', provider: 'none' };
    }

    const options: EmailOptions = {
      to: email,
      subject: data.title,
      html: this.generateEmailHtml(data),
      text: data.message,
    };

    return sendEmail(options);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(data: NotificationData): Promise<SMSMessageResult> {
    const phone = await this.getRecipientPhone(data);
    if (!phone) {
      return { success: false, error: 'No phone number found' };
    }

    const plainTextBody = `${data.title}\n\n${data.message}`;

    return sendSMS(phone, plainTextBody);
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(data: NotificationData): Promise<PushResult> {
    const userId = data.userId;
    if (!userId) {
      return { success: false, error: 'No user ID for push notification' };
    }

    // Get user's FCM tokens
    const tokens = await db.userFcmToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { success: false, error: 'No active FCM tokens found' };
    }

    // If FCM is configured, send via FCM API
    if (this.fcmServerKey) {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${this.fcmServerKey}`,
          },
          body: JSON.stringify({
            registration_ids: tokens.map(t => t.token),
            notification: {
              title: data.title,
              body: data.message,
              icon: data.icon || '/icon-192x192.png',
              image: data.image,
              click_action: data.link,
            },
            data: {
              ...data.data,
              type: data.type,
              category: data.category,
              priority: data.priority,
              link: data.link || '',
              actionType: data.actionType || '',
            },
            priority: data.priority === 'urgent' ? 'high' : 'normal',
          }),
        });

        const result = await response.json();
        
        // Update token last used
        await db.userFcmToken.updateMany({
          where: { token: { in: tokens.map(t => t.token) } },
          data: { lastUsedAt: new Date() },
        });

        return {
          success: response.ok,
          messageId: result.message_id,
          sentCount: result.success,
          error: response.ok ? undefined : result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'FCM request failed',
        };
      }
    }

    // Mock mode - just log
    console.log('[Push Mock]', {
      to: tokens.map(t => t.token),
      title: data.title,
      body: data.message,
    });

    return {
      success: true,
      messageId: `mock-push-${Date.now()}`,
      sentCount: tokens.length,
    };
  }

  /**
   * Send in-app notification (store in database)
   */
  private async sendInAppNotification(data: NotificationData): Promise<InAppResult> {
    try {
      const notification = await db.notification.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId || '',
          type: data.type,
          category: data.category,
          title: data.title,
          message: data.message,
          data: JSON.stringify(data.data || {}),
          link: data.link,
          icon: data.icon,
          image: data.image,
          priority: data.priority || 'normal',
          actionType: data.actionType,
          actionData: data.actionData ? JSON.stringify(data.actionData) : null,
          expiresAt: data.expiresAt,
        },
      });

      return {
        success: true,
        notificationId: notification.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create notification',
      };
    }
  }

  /**
   * Register FCM token for a user
   */
  async registerFcmToken(
    tenantId: string,
    userId: string,
    token: string,
    deviceInfo?: {
      deviceId?: string;
      deviceType?: 'web' | 'ios' | 'android';
      deviceName?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    // Deactivate existing tokens for the same device if deviceId provided
    if (deviceInfo?.deviceId) {
      await db.userFcmToken.updateMany({
        where: { userId, deviceId: deviceInfo.deviceId },
        data: { isActive: false },
      });
    }

    // Upsert the token
    await db.userFcmToken.upsert({
      where: { token },
      create: {
        tenantId,
        userId,
        token,
        deviceId: deviceInfo?.deviceId,
        deviceType: deviceInfo?.deviceType || 'web',
        deviceName: deviceInfo?.deviceName,
        userAgent: deviceInfo?.userAgent,
        isActive: true,
      },
      update: {
        userId,
        isActive: true,
        lastUsedAt: new Date(),
        deviceName: deviceInfo?.deviceName,
        userAgent: deviceInfo?.userAgent,
      },
    });
  }

  /**
   * Unregister FCM token
   */
  async unregisterFcmToken(token: string): Promise<void> {
    await db.userFcmToken.update({
      where: { token },
      data: { isActive: false },
    });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(tenantId: string, userId?: string): Promise<UserPreference[]> {
    if (!userId) {
      return Object.entries(DEFAULT_PREFERENCES).map(([category, prefs]) => ({
        category,
        ...prefs,
        quietHoursEnabled: true,
      })) as UserPreference[];
    }

    const preferences = await db.notificationPreference.findMany({
      where: { tenantId, userId },
    });

    // Merge with defaults
    const allCategories = new Set([
      ...Object.keys(DEFAULT_PREFERENCES),
      ...preferences.map(p => p.category),
    ]);

    return Array.from(allCategories).map(category => {
      const existing = preferences.find(p => p.category === category);
      const defaults = DEFAULT_PREFERENCES[category] || {};

      return {
        category,
        emailEnabled: existing?.emailEnabled ?? defaults.emailEnabled ?? true,
        smsEnabled: existing?.smsEnabled ?? defaults.smsEnabled ?? true,
        pushEnabled: existing?.pushEnabled ?? defaults.pushEnabled ?? true,
        inAppEnabled: existing?.inAppEnabled ?? defaults.inAppEnabled ?? true,
        quietHoursEnabled: existing?.quietHoursEnabled ?? true,
        quietHoursStart: existing?.quietHoursStart ?? '22:00',
        quietHoursEnd: existing?.quietHoursEnd ?? '08:00',
      };
    });
  }

  /**
   * Update user notification preference
   */
  async updateUserPreference(
    tenantId: string,
    userId: string,
    category: string,
    preferences: Partial<Omit<UserPreference, 'category'>>
  ): Promise<void> {
    await db.notificationPreference.upsert({
      where: {
        userId_category: { userId, category },
      },
      create: {
        tenantId,
        userId,
        category,
        emailEnabled: preferences.emailEnabled ?? true,
        smsEnabled: preferences.smsEnabled ?? true,
        pushEnabled: preferences.pushEnabled ?? true,
        inAppEnabled: preferences.inAppEnabled ?? true,
        quietHoursEnabled: preferences.quietHoursEnabled ?? true,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
      },
      update: {
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.smsEnabled,
        pushEnabled: preferences.pushEnabled,
        inAppEnabled: preferences.inAppEnabled,
        quietHoursEnabled: preferences.quietHoursEnabled,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
      },
    });
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    tenantId: string,
    userId: string,
    options?: {
      unreadOnly?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    notifications: Array<{
      id: string;
      type: string;
      category: string;
      title: string;
      message: string;
      data: Record<string, unknown>;
      link?: string;
      icon?: string;
      image?: string;
      priority: string;
      readAt?: Date;
      dismissedAt?: Date;
      actionType?: string;
      actionData?: Record<string, unknown>;
      createdAt: Date;
    }>;
    total: number;
    unreadCount: number;
  }> {
    const where: Record<string, unknown> = {
      tenantId,
      userId,
      dismissedAt: null,
    };

    if (options?.unreadOnly) {
      where.readAt = null;
    }

    if (options?.type) {
      where.type = options.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { tenantId, userId, readAt: null, dismissedAt: null },
      }),
    ]);

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        category: n.category,
        title: n.title,
        message: n.message,
        data: JSON.parse(n.data || '{}'),
        link: n.link || undefined,
        icon: n.icon || undefined,
        image: n.image || undefined,
        priority: n.priority,
        readAt: n.readAt || undefined,
        dismissedAt: n.dismissedAt || undefined,
        actionType: n.actionType || undefined,
        actionData: n.actionData ? JSON.parse(n.actionData) : undefined,
        createdAt: n.createdAt,
      })),
      total,
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(tenantId: string, userId: string): Promise<void> {
    await db.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Dismiss notification
   */
  async dismiss(notificationId: string): Promise<void> {
    await db.notification.update({
      where: { id: notificationId },
      data: { dismissedAt: new Date() },
    });
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string): Promise<void> {
    await db.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await db.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  // Private helper methods

  private async resolveChannels(data: NotificationData): Promise<NotificationChannel[]> {
    if (data.channels && data.channels.length > 0) {
      return data.channels;
    }

    // Default channels based on notification type
    const defaultChannels: Record<string, NotificationChannel[]> = {
      booking: ['email', 'sms', 'in_app'],
      payment: ['email', 'in_app'],
      housekeeping: ['push', 'in_app'],
      maintenance: ['push', 'in_app'],
      system: ['email', 'push', 'in_app'],
      marketing: ['email'],
    };

    return defaultChannels[data.type] || ['in_app'];
  }

  private async applyTemplate(data: NotificationData): Promise<NotificationData> {
    if (!data.templateId) return data;

    const template = await db.notificationTemplate.findUnique({
      where: { id: data.templateId },
    });

    if (!template) return data;

    let title = data.title;
    let message = template.body;

    // Apply variable substitution
    if (data.templateVariables) {
      for (const [key, value] of Object.entries(data.templateVariables)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), String(value));
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    return {
      ...data,
      title,
      message,
      category: (template.triggerEvent?.split('.')[0] as NotificationCategory) || data.category,
    };
  }

  private async getRecipientEmail(data: NotificationData): Promise<string | null> {
    if (data.userId) {
      const user = await db.user.findUnique({
        where: { id: data.userId },
        select: { email: true },
      });
      return user?.email || null;
    }
    if (data.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: data.guestId },
        select: { email: true },
      });
      return guest?.email || null;
    }
    return null;
  }

  private async getRecipientPhone(data: NotificationData): Promise<string | null> {
    if (data.userId) {
      const user = await db.user.findUnique({
        where: { id: data.userId },
        select: { phone: true },
      });
      return user?.phone || null;
    }
    if (data.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: data.guestId },
        select: { phone: true },
      });
      return guest?.phone || null;
    }
    return null;
  }

  private isChannelEnabled(
    channel: NotificationChannel,
    type: string,
    preferences: UserPreference[]
  ): boolean {
    const categoryPref = preferences.find(p => p.category === type);
    if (!categoryPref) return true;

    switch (channel) {
      case 'email':
        return categoryPref.emailEnabled;
      case 'sms':
        return categoryPref.smsEnabled;
      case 'push':
        return categoryPref.pushEnabled;
      case 'in_app':
        return categoryPref.inAppEnabled;
      default:
        return true;
    }
  }

  private checkQuietHours(preferences: UserPreference[]): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const pref of preferences) {
      if (!pref.quietHoursEnabled || !pref.quietHoursStart || !pref.quietHoursEnd) continue;

      const [startH, startM] = pref.quietHoursStart.split(':').map(Number);
      const [endH, endM] = pref.quietHoursEnd.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Handle overnight quiet hours (e.g., 22:00 - 08:00)
      if (startMinutes > endMinutes) {
        if (currentTime >= startMinutes || currentTime < endMinutes) {
          return true;
        }
      } else {
        if (currentTime >= startMinutes && currentTime < endMinutes) {
          return true;
        }
      }
    }

    return false;
  }

  private generateEmailHtml(data: NotificationData): string {
    const primaryColor = '#0d9488'; // teal-600
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${data.title}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: ${primaryColor}; padding: 20px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">${data.title}</h1>
            </div>
            <div style="padding: 20px;">
              ${data.image ? `<img src="${data.image}" alt="" style="max-width: 100%; border-radius: 4px; margin-bottom: 16px;">` : ''}
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #333;">${data.message}</p>
              ${data.link ? `<a href="${data.link}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">View Details</a>` : ''}
            </div>
            <div style="background-color: #f9f9f9; padding: 16px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">This is an automated notification from StaySuite</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async logNotification(
    data: NotificationData,
    channels: NotificationResult['channels']
  ): Promise<void> {
    try {
      const email = await this.getRecipientEmail(data);
      const phone = await this.getRecipientPhone(data);

      // Log each channel
      for (const [channel, result] of Object.entries(channels)) {
        if (!result) continue;

        await db.notificationLog.create({
          data: {
            tenantId: data.tenantId,
            templateId: data.templateId,
            recipientType: data.userId ? 'user' : 'guest',
            recipientId: data.userId || data.guestId || '',
            recipientEmail: email,
            recipientPhone: phone,
            channel,
            subject: data.title,
            body: data.message,
            status: result.success ? 'delivered' : 'failed',
            errorMessage: result.error,
            sentAt: result.success ? new Date() : null,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export convenience functions
export const sendNotification = (data: NotificationData) => notificationService.send(data);
export const sendImmediateNotification = (
  tenantId: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  options?: Partial<NotificationData>
) => notificationService.sendImmediate(tenantId, userId, type, title, message, options);
