/**
 * SMS Gateway Integration (Twilio-style)
 * 
 * This module provides a production-ready wrapper for SMS gateway services.
 * It supports Twilio and similar SMS providers with send and webhook capabilities.
 * 
 * Configuration needed:
 * - SMS_PROVIDER: 'twilio' | 'vonage' | 'messagebird' | 'custom'
 * - SMS_ACCOUNT_SID: Account SID (Twilio)
 * - SMS_AUTH_TOKEN: Auth token (Twilio)
 * - SMS_FROM_NUMBER: Default sender phone number
 * - SMS_WEBHOOK_SECRET: Secret for webhook verification
 */

import { createHmac } from 'crypto';

// Types
export interface SMSConfig {
  provider: 'twilio' | 'vonage' | 'messagebird' | 'custom';
  accountSid: string;
  authToken: string;
  fromNumber: string;
  webhookSecret?: string;
  baseUrl?: string; // For custom providers
}

export interface SMSMessage {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  statusCallback?: string;
  validityPeriod?: number; // seconds
  scheduledAt?: Date;
}

export interface SMSMessageResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  errorCode?: string;
  cost?: number;
}

export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  segments?: number;
  cost?: number;
}

export interface SMSWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus?: string;
  ApiVersion?: string;
  SmsSid?: string;
  SmsMessageSid?: string;
  // Delivery status fields
  MessageStatus?: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  ErrorCode?: string;
  ErrorMessage?: string;
  // Additional fields
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToZip?: string;
  ToCountry?: string;
}

export interface SMSBalanceInfo {
  currency: string;
  balance: number;
  usage: number;
}

/**
 * SMS Gateway Client (Twilio-compatible)
 */
export class SMSClient {
  private config: SMSConfig;
  private baseUrl: string;

  constructor(config: SMSConfig) {
    this.config = config;
    
    // Set base URL based on provider
    switch (config.provider) {
      case 'twilio':
        this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`;
        break;
      case 'vonage':
        this.baseUrl = 'https://rest.nexmo.com/sms/json';
        break;
      case 'messagebird':
        this.baseUrl = 'https://rest.messagebird.com/messages';
        break;
      default:
        this.baseUrl = config.baseUrl || '';
    }
  }

  /**
   * Send an SMS message
   */
  async sendMessage(message: SMSMessage): Promise<SMSMessageResult> {
    switch (this.config.provider) {
      case 'twilio':
        return this.sendTwilioMessage(message);
      case 'vonage':
        return this.sendVonageMessage(message);
      case 'messagebird':
        return this.sendMessageBirdMessage(message);
      default:
        return this.sendCustomMessage(message);
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendTwilioMessage(message: SMSMessage): Promise<SMSMessageResult> {
    try {
      const formData = new URLSearchParams();
      formData.append('To', this.formatPhoneNumber(message.to));
      formData.append('From', message.from || this.config.fromNumber);
      formData.append('Body', message.body);

      if (message.mediaUrls && message.mediaUrls.length > 0) {
        message.mediaUrls.forEach((url, index) => {
          formData.append(`MediaUrl${index}`, url);
        });
      }

      if (message.statusCallback) {
        formData.append('StatusCallback', message.statusCallback);
      }

      if (message.validityPeriod) {
        formData.append('ValidityPeriod', message.validityPeriod.toString());
      }

      if (message.scheduledAt) {
        formData.append('SendAt', message.scheduledAt.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Twilio SMS error:', data);
        return {
          success: false,
          error: data.message || 'Failed to send SMS',
          errorCode: data.code?.toString(),
        };
      }

      return {
        success: true,
        messageId: data.sid,
        status: data.status,
        cost: parseFloat(data.price || '0'),
      };
    } catch (error) {
      console.error('Error sending SMS via Twilio:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send SMS via Vonage (Nexmo)
   */
  private async sendVonageMessage(message: SMSMessage): Promise<SMSMessageResult> {
    try {
      const params = new URLSearchParams({
        api_key: this.config.accountSid,
        api_secret: this.config.authToken,
        to: this.formatPhoneNumber(message.to),
        from: message.from || this.config.fromNumber,
        text: message.body,
        'status-report-req': '1',
      });

      if (message.statusCallback) {
        params.append('callback', message.statusCallback);
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (data.messages?.[0]?.status !== '0') {
        return {
          success: false,
          error: data.messages?.[0]?.['error-text'] || 'Failed to send SMS',
          errorCode: data.messages?.[0]?.status,
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.['message-id'],
        status: 'sent',
      };
    } catch (error) {
      console.error('Error sending SMS via Vonage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send SMS via MessageBird
   */
  private async sendMessageBirdMessage(message: SMSMessage): Promise<SMSMessageResult> {
    try {
      const body: Record<string, any> = {
        recipients: [this.formatPhoneNumber(message.to)],
        originator: message.from || this.config.fromNumber,
        body: message.body,
      };

      if (message.statusCallback) {
        body.reportUrl = message.statusCallback;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.errors?.[0]?.description || 'Failed to send SMS',
          errorCode: data.errors?.[0]?.code?.toString(),
        };
      }

      return {
        success: true,
        messageId: data.id,
        status: data.status,
      };
    } catch (error) {
      console.error('Error sending SMS via MessageBird:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send SMS via custom provider
   */
  private async sendCustomMessage(message: SMSMessage): Promise<SMSMessageResult> {
    try {
      if (!this.baseUrl) {
        return {
          success: false,
          error: 'Custom SMS provider URL not configured',
        };
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: this.formatPhoneNumber(message.to),
          from: message.from || this.config.fromNumber,
          body: message.body,
          callback: message.statusCallback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send SMS',
        };
      }

      return {
        success: true,
        messageId: data.id || data.messageId,
        status: data.status,
      };
    } catch (error) {
      console.error('Error sending SMS via custom provider:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<SMSDeliveryStatus | null> {
    if (this.config.provider !== 'twilio') {
      console.warn('Message status lookup only supported for Twilio');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/Messages/${messageId}.json`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error fetching message status:', data);
        return null;
      }

      return {
        messageId: data.sid,
        status: data.status,
        errorCode: data.error_code,
        errorMessage: data.error_message,
        segments: parseInt(data.num_segments || '1'),
        cost: parseFloat(data.price || '0'),
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      return null;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<SMSBalanceInfo | null> {
    if (this.config.provider !== 'twilio') {
      console.warn('Balance lookup only supported for Twilio');
      return null;
    }

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Balance.json`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error fetching balance:', data);
        return null;
      }

      return {
        currency: data.currency,
        balance: parseFloat(data.balance),
        usage: 0, // Would need separate API call
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      return null;
    }
  }

  /**
   * Validate phone number format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // Add country code if missing (default to US)
    if (formatted.length === 10) {
      formatted = `1${formatted}`;
    }
    
    // Ensure it starts with +
    return `+${formatted}`;
  }

  /**
   * Verify webhook signature (Twilio)
   */
  verifyWebhookSignature(signature: string, url: string, params: Record<string, string>): boolean {
    if (!this.config.webhookSecret) {
      console.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');

    const data = `${url}${sortedParams}`;

    const expectedSignature = createHmac('sha1', this.config.webhookSecret)
      .update(data)
      .digest('base64');

    return signature === expectedSignature;
  }
}

/**
 * Create an SMS client instance from environment variables
 */
export function createSMSClient(): SMSClient | null {
  const provider = (process.env.SMS_PROVIDER || 'twilio') as SMSConfig['provider'];
  const accountSid = process.env.SMS_ACCOUNT_SID;
  const authToken = process.env.SMS_AUTH_TOKEN;
  const fromNumber = process.env.SMS_FROM_NUMBER;
  const webhookSecret = process.env.SMS_WEBHOOK_SECRET;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('SMS credentials not configured');
    return null;
  }

  return new SMSClient({
    provider,
    accountSid,
    authToken,
    fromNumber,
    webhookSecret,
  });
}

/**
 * Parse incoming SMS webhook payload
 */
export function parseSMSWebhook(payload: SMSWebhookPayload): {
  type: 'inbound' | 'status';
  data: {
    messageId: string;
    from: string;
    to: string;
    body?: string;
    status?: SMSDeliveryStatus['status'];
    media?: { url: string; type: string }[];
    errorCode?: string;
    errorMessage?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
} {
  const hasInboundContent = payload.Body || payload.MediaUrl0;
  
  if (hasInboundContent) {
    // Inbound message
    const media: { url: string; type: string }[] = [];
    let i = 0;
    while (payload[`MediaUrl${i}` as keyof SMSWebhookPayload]) {
      media.push({
        url: payload[`MediaUrl${i}` as keyof SMSWebhookPayload] as string,
        type: payload[`MediaContentType${i}` as keyof SMSWebhookPayload] as string,
      });
      i++;
    }

    return {
      type: 'inbound',
      data: {
        messageId: payload.MessageSid || payload.SmsSid || '',
        from: payload.From,
        to: payload.To,
        body: payload.Body,
        media: media.length > 0 ? media : undefined,
        location: {
          city: payload.FromCity,
          state: payload.FromState,
          country: payload.FromCountry,
        },
      },
    };
  } else {
    // Delivery status update
    return {
      type: 'status',
      data: {
        messageId: payload.MessageSid || '',
        from: payload.From,
        to: payload.To,
        status: payload.MessageStatus,
        errorCode: payload.ErrorCode,
        errorMessage: payload.ErrorMessage,
      },
    };
  }
}

/**
 * Send SMS message helper function
 */
export async function sendSMS(
  to: string,
  body: string,
  options?: Partial<SMSMessage>
): Promise<SMSMessageResult> {
  const client = getSMSClient();
  
  if (!client) {
    return {
      success: false,
      error: 'SMS client not configured',
    };
  }

  return client.sendMessage({
    to,
    body,
    ...options,
  });
}

// Singleton instance
let smsClientInstance: SMSClient | null = null;

export function getSMSClient(): SMSClient | null {
  if (!smsClientInstance) {
    smsClientInstance = createSMSClient();
  }
  return smsClientInstance;
}
