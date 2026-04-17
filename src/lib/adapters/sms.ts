/**
 * StaySuite SMS Adapter
 * 
 * Auto-switches between mock (console logging) and Twilio
 * Works seamlessly in both sandbox and production
 */

import { getConfig } from '../config/env';

// SMS options interface
export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
  mediaUrls?: string[];
  statusCallback?: string;
}

// SMS result interface
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  status?: string;
}

// Mock SMS adapter (logs to console)
class MockSMSAdapter {
  private logFile: string[] = [];

  async send(options: SMSOptions): Promise<SMSResult> {
    const from = options.from || '+1234567890';
    
    // Log the SMS
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: options.to,
      from,
      message: options.message,
      mediaUrls: options.mediaUrls,
    };
    
    this.logFile.push(JSON.stringify(logEntry));
    
    // Console output
    console.log('\n[SMS Mock] ====================');
    console.log(`From: ${from}`);
    console.log(`To: ${options.to}`);
    console.log(`Message: ${options.message}`);
    if (options.mediaUrls?.length) {
      console.log(`Media: ${options.mediaUrls.join(', ')}`);
    }
    console.log('[SMS Mock] ====================\n');
    
    // Return mock success
    return {
      success: true,
      messageId: `mock-sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: 'mock',
      status: 'delivered',
    };
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)));
  }

  getLogs(): string[] {
    return [...this.logFile];
  }

  clearLogs(): void {
    this.logFile = [];
  }

  async getBalance(): Promise<number> {
    return 999; // Mock balance
  }
}

// Twilio SMS adapter
class TwilioSMSAdapter {
  private config: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };

  constructor(config: { accountSid: string; authToken: string; phoneNumber: string }) {
    this.config = config;
  }

  private async getClient() {
    // Dynamic import for twilio
    const twilio = await import('twilio');
    return twilio.default(this.config.accountSid, this.config.authToken);
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const client = await this.getClient();
      const from = options.from || this.config.phoneNumber;
      
      const messageData: Record<string, unknown> = {
        body: options.message,
        from,
        to: options.to,
      };

      if (options.mediaUrls?.length) {
        messageData.mediaUrl = options.mediaUrls;
      }

      if (options.statusCallback) {
        messageData.statusCallback = options.statusCallback;
      }

      const message = await client.messages.create(messageData as unknown as Parameters<typeof client.messages.create>[0]);
      
      return {
        success: message.status !== 'failed',
        messageId: message.sid,
        provider: 'twilio',
        status: message.status,
      };
    } catch (error) {
      console.error('[SMS Twilio] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'twilio',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)));
  }

  async getBalance(): Promise<number> {
    try {
      const client = await this.getClient();
      const account = await client.api.accounts(this.config.accountSid).fetch();
      // Balance would come from Twilio API if available
      return parseFloat(account.subresourceUris?.balance || '0');
    } catch {
      return 0;
    }
  }
}

// SMS adapter interface
export interface SMSAdapter {
  send(options: SMSOptions): Promise<SMSResult>;
  sendBatch(messages: SMSOptions[]): Promise<SMSResult[]>;
  getBalance(): Promise<number>;
}

// Singleton instance
let smsInstance: SMSAdapter | null = null;

/**
 * Get SMS adapter instance
 * Auto-detects Twilio or falls back to mock
 */
export async function getSMS(): Promise<SMSAdapter> {
  if (smsInstance) return smsInstance;
  
  const config = getConfig();
  
  if (config.sms.enabled && config.sms.accountSid && config.sms.phoneNumber) {
    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (authToken) {
        const twilioAdapter = new TwilioSMSAdapter({
          accountSid: config.sms.accountSid,
          authToken,
          phoneNumber: config.sms.phoneNumber,
        });
        
        smsInstance = twilioAdapter;
        console.log('[SMS] Using Twilio');
        return smsInstance;
      }
    } catch (error) {
      console.warn('[SMS] Twilio initialization failed, falling back to mock:', error);
    }
  }
  
  // Fallback to mock
  smsInstance = new MockSMSAdapter();
  console.log('[SMS] Using mock adapter (console logging)');
  return smsInstance;
}

/**
 * Send a single SMS
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
  const sms = await getSMS();
  return sms.send(options);
}

/**
 * Send multiple SMS messages
 */
export async function sendSMSBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
  const sms = await getSMS();
  return sms.sendBatch(messages);
}

/**
 * Reset SMS adapter (for testing)
 */
export function resetSMS(): void {
  smsInstance = null;
}

// Export types and classes
export { MockSMSAdapter, TwilioSMSAdapter };
