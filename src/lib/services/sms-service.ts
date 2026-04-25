/**
 * StaySuite SMS Service
 * 
 * Comprehensive SMS service with:
 * - Multiple provider support (Twilio, mock)
 * - Template support with variable substitution
 * - Delivery tracking
 * - Bulk sending with queue
 * - Webhook support for delivery status
 */

import { db } from '@/lib/db';
import { sendSMS as sendSMSAdapter, SMSOptions, SMSResult } from '@/lib/adapters/sms';
import { getConfig } from '@/lib/config/env';
import crypto from 'crypto';

// Types
export interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  variables?: string[];
  category?: string;
}

export interface TemplatedSMSOptions {
  to: string;
  templateId?: string;
  templateCode?: string;
  message?: string;
  variables?: Record<string, string | number | boolean>;
  from?: string;
  mediaUrls?: string[];
  statusCallback?: string;
  campaignId?: string;
}

export interface QueuedSMS {
  id: string;
  tenantId: string;
  campaignId?: string;
  to: string;
  message: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  messageId?: string;
  createdAt: Date;
}

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  status?: string;
  queued?: boolean;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  to: string;
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

// SMS queue (in-memory for development, should use Redis/BullMQ in production)
const smsQueue: Map<string, QueuedSMS> = new Map();
let queueProcessorRunning = false;

// Delivery tracking
const deliveryTracker: Map<string, DeliveryStatus> = new Map();

/**
 * SMS Service Class
 */
export class SMSService {
  private maxQueueSize = 10000;
  private batchSize = 50;
  private retryDelay = 60000; // 1 minute

  /**
   * Send an SMS immediately
   */
  async send(options: TemplatedSMSOptions): Promise<SMSSendResult> {
    try {
      let smsOptions: SMSOptions = {
        to: options.to,
        message: options.message || '',
        from: options.from,
        mediaUrls: options.mediaUrls,
        statusCallback: options.statusCallback,
      };

      // Get template if specified
      if (options.templateId || options.templateCode) {
        const template = await this.getTemplate(options.templateId, options.templateCode);
        if (template) {
          smsOptions = await this.applyTemplate(template, options);
        }
      }

      // Validate required fields
      if (!smsOptions.message) {
        return {
          success: false,
          error: 'Message is required',
          provider: 'none',
        };
      }

      // Validate phone number
      if (!this.isValidPhoneNumber(options.to)) {
        return {
          success: false,
          error: 'Invalid phone number format',
          provider: 'none',
        };
      }

      // Send via adapter
      const result = await sendSMSAdapter(smsOptions);

      // Track delivery
      if (result.messageId) {
        deliveryTracker.set(result.messageId, {
          messageId: result.messageId,
          status: result.status === 'delivered' ? 'delivered' : 'sent',
          to: options.to,
          timestamp: new Date(),
        });
      }

      // Log delivery
      await this.logDelivery(options, result);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'none',
      };
    }
  }

  /**
   * Send bulk SMS (queued)
   */
  async sendBulk(
    tenantId: string,
    messages: Array<{
      to: string;
      message: string;
      templateId?: string;
      variables?: Record<string, unknown>;
    }>,
    options?: {
      campaignId?: string;
      scheduledFor?: Date;
      from?: string;
    }
  ): Promise<{
    queued: number;
    queueId: string;
    estimatedTime: number;
    invalid: number;
  }> {
    const queueId = `bulk-sms-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    let queued = 0;
    let invalid = 0;

    for (const msg of messages) {
      if (smsQueue.size >= this.maxQueueSize) {
        break;
      }

      // Validate phone number
      if (!this.isValidPhoneNumber(msg.to)) {
        invalid++;
        continue;
      }

      const id = `${queueId}-${queued}`;
      smsQueue.set(id, {
        id,
        tenantId,
        campaignId: options?.campaignId,
        to: msg.to,
        message: msg.message,
        templateId: msg.templateId,
        variables: msg.variables,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledFor: options?.scheduledFor,
        createdAt: new Date(),
      });
      queued++;
    }

    // Start queue processor if not running
    this.startQueueProcessor();

    const estimatedTime = Math.ceil(queued / this.batchSize) * 5;

    return {
      queued,
      queueId,
      estimatedTime,
      invalid,
    };
  }

  /**
   * Send campaign SMS
   */
  async sendCampaign(
    campaignId: string,
    tenantId: string,
    recipients: Array<{
      phone: string;
      name?: string;
      guestId?: string;
      variables?: Record<string, unknown>;
    }>,
    content: {
      message: string;
      templateId?: string;
    }
  ): Promise<{
    total: number;
    queued: number;
    invalid: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let queued = 0;
    let invalid = 0;

    // Prepare messages
    const messages = recipients
      .filter(r => r.phone)
      .map(recipient => {
        if (!this.isValidPhoneNumber(recipient.phone)) {
          invalid++;
          return null;
        }
        return {
          to: recipient.phone,
          message: content.message,
          templateId: content.templateId,
          variables: {
            name: recipient.name || 'Guest',
            phone: recipient.phone,
            ...recipient.variables,
          },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    try {
      const result = await this.sendBulk(tenantId, messages, { campaignId });
      queued = result.queued;
      invalid += result.invalid;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
      total: recipients.length,
      queued,
      invalid,
      errors,
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
  } {
    let pending = 0;
    let sending = 0;
    let sent = 0;
    let failed = 0;

    smsQueue.forEach(sms => {
      switch (sms.status) {
        case 'pending':
          pending++;
          break;
        case 'sending':
          sending++;
          break;
        case 'sent':
          sent++;
          break;
        case 'failed':
          failed++;
          break;
      }
    });

    return {
      total: smsQueue.size,
      pending,
      sending,
      sent,
      failed,
    };
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(messageId: string): DeliveryStatus | undefined {
    return deliveryTracker.get(messageId);
  }

  /**
   * Update delivery status (called by webhook)
   */
  updateDeliveryStatus(
    messageId: string,
    status: DeliveryStatus['status'],
    errorCode?: string,
    errorMessage?: string
  ): void {
    const existing = deliveryTracker.get(messageId);
    if (existing) {
      deliveryTracker.set(messageId, {
        ...existing,
        status,
        errorCode,
        errorMessage,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clear processed messages from queue
   */
  clearProcessedMessages(): number {
    let cleared = 0;
    const idsToRemove: string[] = [];

    smsQueue.forEach((sms, id) => {
      if (sms.status === 'sent' || sms.status === 'failed') {
        idsToRemove.push(id);
        cleared++;
      }
    });

    idsToRemove.forEach(id => smsQueue.delete(id));

    return cleared;
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    // Also accept common formats
    const commonRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    
    return e164Regex.test(phone) || commonRegex.test(phone);
  }

  /**
   * Format phone number to E.164
   */
  private formatPhoneNumber(phone: string): string {
    // Remove spaces, dashes, parentheses
    let formatted = phone.replace(/[\s\-\(\)]/g, '');
    
    // Add + if missing
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (queueProcessorRunning) return;
    queueProcessorRunning = true;

    this.processQueue().finally(() => {
      queueProcessorRunning = false;
      if (this.getQueueStatus().pending > 0) {
        setTimeout(() => this.startQueueProcessor(), 1000);
      }
    });
  }

  /**
   * Process SMS queue
   */
  private async processQueue(): Promise<void> {
    const now = new Date();
    const pendingMessages = Array.from(smsQueue.values())
      .filter(s => s.status === 'pending' && (!s.scheduledFor || s.scheduledFor <= now))
      .slice(0, this.batchSize);

    for (const sms of pendingMessages) {
      try {
        // Mark as sending
        sms.status = 'sending';
        sms.attempts++;

        // Send SMS
        const result = await this.send({
          to: sms.to,
          message: sms.message,
          templateId: sms.templateId,
          variables: sms.variables as Record<string, string | number | boolean>,
        });

        if (result.success) {
          sms.status = 'sent';
          sms.sentAt = new Date();
          sms.messageId = result.messageId;
        } else {
          throw new Error(result.error || 'Send failed');
        }
      } catch (error) {
        sms.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (sms.attempts >= sms.maxAttempts) {
          sms.status = 'failed';
        } else {
          // Schedule retry
          sms.status = 'pending';
          sms.scheduledFor = new Date(Date.now() + this.retryDelay * sms.attempts);
        }
      }

      // Update queue
      smsQueue.set(sms.id, sms);
    }
  }

  /**
   * Get SMS template
   */
  private async getTemplate(templateId?: string, templateCode?: string): Promise<SMSTemplate | null> {
    if (templateId) {
      const template = await db.messageTemplate.findUnique({
        where: { id: templateId },
      });
      if (template) {
        return {
          id: template.id,
          name: template.name,
          body: template.body,
          variables: template.variables ? JSON.parse(template.variables) : [],
        };
      }
    }

    if (templateCode) {
      const template = await db.messageTemplate.findFirst({
        where: {
          category: templateCode,
          isActive: true,
        },
      });
      if (template) {
        return {
          id: template.id,
          name: template.name,
          body: template.body,
          variables: template.variables ? JSON.parse(template.variables) : [],
        };
      }
    }

    return null;
  }

  /**
   * Apply template with variable substitution
   */
  private async applyTemplate(
    template: SMSTemplate,
    options: TemplatedSMSOptions
  ): Promise<SMSOptions> {
    let message = options.message || template.body;

    // Apply variable substitution
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        const placeholder = `{{${key}}}`;
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    return {
      to: this.formatPhoneNumber(options.to),
      message,
      from: options.from,
      mediaUrls: options.mediaUrls,
      statusCallback: options.statusCallback,
    };
  }

  /**
   * Log SMS delivery
   */
  private async logDelivery(options: TemplatedSMSOptions, result: SMSResult): Promise<void> {
    try {
      await db.notificationLog.create({
        data: {
          tenantId: 'system',
          recipientType: 'guest',
          recipientId: '',
          recipientPhone: options.to,
          channel: 'sms',
          subject: '',
          body: options.message || '',
          status: result.success ? 'delivered' : 'failed',
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        },
      }).catch(() => {
        // Ignore errors in logging
      });
    } catch {
      // Ignore logging errors
    }
  }
}

// Singleton instance
export const smsService = new SMSService();

// Convenience functions
export const sendSMSNow = (options: TemplatedSMSOptions) => smsService.send(options);
export const queueBulkSMS = (tenantId: string, messages: Array<{ to: string; message: string; templateId?: string; variables?: Record<string, unknown> }>, options?: { campaignId?: string; scheduledFor?: Date }) => smsService.sendBulk(tenantId, messages, options);
export const sendCampaignSMS = (campaignId: string, tenantId: string, recipients: Array<{ phone: string; name?: string; guestId?: string; variables?: Record<string, unknown> }>, content: { message: string; templateId?: string }) => smsService.sendCampaign(campaignId, tenantId, recipients, content);
export const getSMSQueueStatus = () => smsService.getQueueStatus();
export const getSMSDeliveryStatus = (messageId: string) => smsService.getDeliveryStatus(messageId);
