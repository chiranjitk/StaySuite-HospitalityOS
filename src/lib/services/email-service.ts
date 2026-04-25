/**
 * StaySuite Email Service
 * 
 * Comprehensive email service with:
 * - Template support with variable substitution
 * - Attachment support
 * - Queue mechanism for bulk emails
 * - Delivery tracking
 * - Multiple provider support (SMTP, mock)
 */

import { db } from '@/lib/db';
import { sendEmail as sendEmailAdapter, EmailOptions, EmailResult } from '@/lib/adapters/email';
import { getConfig } from '@/lib/config/env';
import crypto from 'crypto';

// Types
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  category?: string;
}

export interface TemplatedEmailOptions {
  to: string | string[];
  templateId?: string;
  templateCode?: string;
  subject?: string;
  variables?: Record<string, string | number | boolean>;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  campaignId?: string;
}

export interface QueuedEmail {
  id: string;
  tenantId: string;
  campaignId?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  createdAt: Date;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  queued?: boolean;
}

// Email queue (in-memory for development, should use Redis/BullMQ in production)
const emailQueue: Map<string, QueuedEmail> = new Map();
let queueProcessorRunning = false;

/**
 * Email Service Class
 */
export class EmailService {
  private maxQueueSize = 10000;
  private batch_size = 50;
  private retryDelay = 60000; // 1 minute

  /**
   * Send an email immediately
   */
  async send(options: TemplatedEmailOptions): Promise<EmailSendResult> {
    try {
      // Get template if specified
      let emailOptions: EmailOptions = {
        to: options.to,
        subject: options.subject || '',
        html: options.html,
        text: options.text,
        from: options.from,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        headers: options.headers,
        tags: options.tags,
      };

      if (options.templateId || options.templateCode) {
        const template = await this.getTemplate(options.templateId, options.templateCode);
        if (template) {
          emailOptions = await this.applyTemplate(template, options);
        }
      }

      // Validate required fields
      if (!emailOptions.subject && !options.subject) {
        return {
          success: false,
          error: 'Subject is required',
          provider: 'none',
        };
      }

      // Send via adapter
      const result = await sendEmailAdapter(emailOptions);

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
   * Send bulk emails (queued)
   */
  async sendBulk(
    tenantId: string,
    emails: Array<Omit<TemplatedEmailOptions, 'to'> & { to: string }>,
    options?: {
      campaignId?: string;
      scheduledFor?: Date;
      batchSize?: number;
    }
  ): Promise<{
    queued: number;
    queueId: string;
    estimatedTime: number;
  }> {
    const queueId = `bulk-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    let queued = 0;
    for (const email of emails) {
      if (emailQueue.size >= this.maxQueueSize) {
        break;
      }

      const id = `${queueId}-${queued}`;
      emailQueue.set(id, {
        id,
        tenantId,
        campaignId: options?.campaignId,
        to: email.to,
        subject: email.subject || '',
        html: email.html,
        text: email.text,
        templateId: email.templateId,
        variables: email.variables,
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

    const estimatedTime = Math.ceil(queued / this.batch_size) * 5; // ~5 seconds per batch

    return {
      queued,
      queueId,
      estimatedTime,
    };
  }

  /**
   * Send campaign emails
   */
  async sendCampaign(
    campaignId: string,
    tenantId: string,
    recipients: Array<{
      email: string;
      name?: string;
      guestId?: string;
      variables?: Record<string, unknown>;
    }>,
    content: {
      subject: string;
      html?: string;
      text?: string;
      templateId?: string;
    }
  ): Promise<{
    total: number;
    queued: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let queued = 0;

    // Prepare emails
    const emails = recipients
      .filter(r => r.email)
      .map(recipient => ({
        to: recipient.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        templateId: content.templateId,
        variables: {
          name: recipient.name || recipient.email.split('@')[0],
          email: recipient.email,
          ...recipient.variables,
        },
      }));

    try {
      const result = await this.sendBulk(tenantId, emails, { campaignId });
      queued = result.queued;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
      total: recipients.length,
      queued,
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

    emailQueue.forEach(email => {
      switch (email.status) {
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
      total: emailQueue.size,
      pending,
      sending,
      sent,
      failed,
    };
  }

  /**
   * Clear processed emails from queue
   */
  clearProcessedEmails(): number {
    let cleared = 0;
    const idsToRemove: string[] = [];

    emailQueue.forEach((email, id) => {
      if (email.status === 'sent' || email.status === 'failed') {
        idsToRemove.push(id);
        cleared++;
      }
    });

    idsToRemove.forEach(id => emailQueue.delete(id));

    return cleared;
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (queueProcessorRunning) return;
    queueProcessorRunning = true;

    // Process queue in background
    this.processQueue().finally(() => {
      queueProcessorRunning = false;
      // Continue processing if there are pending emails
      if (this.getQueueStatus().pending > 0) {
        setTimeout(() => this.startQueueProcessor(), 1000);
      }
    });
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    const now = new Date();
    const pendingEmails = Array.from(emailQueue.values())
      .filter(e => e.status === 'pending' && (!e.scheduledFor || e.scheduledFor <= now))
      .slice(0, this.batch_size);

    for (const email of pendingEmails) {
      try {
        // Mark as sending
        email.status = 'sending';
        email.attempts++;

        // Send email
        const result = await this.send({
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateId: email.templateId,
          variables: email.variables as Record<string, string | number | boolean>,
        });

        if (result.success) {
          email.status = 'sent';
          email.sentAt = new Date();
        } else {
          throw new Error(result.error || 'Send failed');
        }
      } catch (error) {
        email.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (email.attempts >= email.maxAttempts) {
          email.status = 'failed';
        } else {
          // Schedule retry
          email.status = 'pending';
          email.scheduledFor = new Date(Date.now() + this.retryDelay * email.attempts);
        }
      }

      // Update queue
      emailQueue.set(email.id, email);
    }
  }

  /**
   * Get email template
   */
  private async getTemplate(templateId?: string, templateCode?: string): Promise<EmailTemplate | null> {
    if (templateId) {
      const template = await db.messageTemplate.findUnique({
        where: { id: templateId },
      });
      if (template) {
        return {
          id: template.id,
          name: template.name,
          subject: template.subject || '',
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
          subject: template.subject || '',
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
    template: EmailTemplate,
    options: TemplatedEmailOptions
  ): Promise<EmailOptions> {
    let subject = options.subject || template.subject;
    let html = options.html || template.body;
    let text = options.text;

    // Apply variable substitution
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        const placeholder = `{{${key}}}`;
        const strValue = String(value);
        subject = subject.replace(new RegExp(placeholder, 'g'), strValue);
        html = html.replace(new RegExp(placeholder, 'g'), strValue);
        if (text) {
          text = text.replace(new RegExp(placeholder, 'g'), strValue);
        }
      }
    }

    return {
      to: options.to,
      subject,
      html,
      text,
      from: options.from,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
      headers: options.headers,
      tags: options.tags,
    };
  }

  /**
   * Log email delivery
   */
  private async logDelivery(options: TemplatedEmailOptions, result: EmailResult): Promise<void> {
    try {
      // Log to notification log if available
      const config = getConfig();
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      // Could create a dedicated email log table, for now we'll use the notification log
      await db.notificationLog.create({
        data: {
          tenantId: 'system',
          recipientType: 'guest',
          recipientId: '',
          recipientEmail: to,
          channel: 'email',
          subject: options.subject || '',
          body: options.text || options.html?.substring(0, 500) || '',
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
export const emailService = new EmailService();

// Convenience functions
export const sendEmailNow = (options: TemplatedEmailOptions) => emailService.send(options);
export const queueBulkEmails = (tenantId: string, emails: Array<Omit<TemplatedEmailOptions, 'to'> & { to: string }>, options?: { campaignId?: string; scheduledFor?: Date }) => emailService.sendBulk(tenantId, emails, options);
export const sendCampaignEmails = (campaignId: string, tenantId: string, recipients: Array<{ email: string; name?: string; guestId?: string; variables?: Record<string, unknown> }>, content: { subject: string; html?: string; text?: string; templateId?: string }) => emailService.sendCampaign(campaignId, tenantId, recipients, content);
export const getEmailQueueStatus = () => emailService.getQueueStatus();
