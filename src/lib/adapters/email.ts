/**
 * StaySuite Email Adapter
 * 
 * Auto-switches between mock (console logging) and SMTP
 * Works seamlessly in both sandbox and production
 * Supports per-tenant SMTP config from the database (falls back to env vars)
 */

import { getConfig } from '../config/env';
import { getSMTPConfig } from '../service-config';

// Email options interface
export interface EmailOptions {
  to: string | string[];
  subject: string;
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
}

// Email result interface
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

// Mock email adapter (logs to console)
class MockEmailAdapter {
  private logFile: string[] = [];

  async send(options: EmailOptions): Promise<EmailResult> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const from = options.from || 'noreply@staysuite.local';
    
    // Log the email
    const logEntry = {
      timestamp: new Date().toISOString(),
      to,
      from,
      subject: options.subject,
      text: options.text,
      html: options.html ? '[HTML Content]' : undefined,
    };
    
    this.logFile.push(JSON.stringify(logEntry));
    
    // Console output
    console.log('\n[Email Mock] ====================');
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${options.subject}`);
    if (options.cc) console.log(`CC: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc}`);
    if (options.bcc) console.log(`BCC: ${Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc}`);
    if (options.text) console.log(`Text: ${options.text.substring(0, 200)}...`);
    if (options.attachments?.length) {
      console.log(`Attachments: ${options.attachments.map(a => a.filename).join(', ')}`);
    }
    console.log('[Email Mock] ====================\n');
    
    // Return mock success
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: 'mock',
    };
  }

  async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
    return Promise.all(emails.map(email => this.send(email)));
  }

  getLogs(): string[] {
    return [...this.logFile];
  }

  clearLogs(): void {
    this.logFile = [];
  }

  async testConnection(): Promise<boolean> {
    console.log('[Email Mock] Connection test: OK (mock mode)');
    return true;
  }
}

// SMTP email adapter
class SMTPEmailAdapter {
  private config: {
    host: string;
    port: number;
    user: string | null;
    pass: string | null;
    from: string;
  };

  constructor(config: {
    host: string;
    port: number;
    user: string | null;
    pass: string | null;
    from: string;
  }) {
    this.config = config;
  }

  private async getTransporter() {
    // Dynamic import for nodemailer
    const nodemailer = await import('nodemailer');
    
    return nodemailer.default.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: this.config.user ? {
        user: this.config.user,
        pass: this.config.pass || '',
      } : undefined,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      const transporter = await this.getTransporter();
      
      const mailOptions = {
        from: options.from || this.config.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        replyTo: options.replyTo,
        attachments: options.attachments,
        headers: options.headers,
      };

      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
      };
    } catch (error) {
      console.error('[Email SMTP] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'smtp',
      };
    }
  }

  async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
    return Promise.all(emails.map(email => this.send(email)));
  }

  async testConnection(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      console.log('[Email SMTP] Connection test: OK');
      return true;
    } catch (error) {
      console.error('[Email SMTP] Connection test failed:', error);
      return false;
    }
  }
}

// Email adapter interface
export interface EmailAdapter {
  send(options: EmailOptions): Promise<EmailResult>;
  sendBatch(emails: EmailOptions[]): Promise<EmailResult[]>;
  testConnection(): Promise<boolean>;
}

// Singleton instance
let emailInstance: EmailAdapter | null = null;

/**
 * Get email adapter instance
 * Auto-detects SMTP or falls back to mock
 */
export async function getEmail(): Promise<EmailAdapter> {
  if (emailInstance) return emailInstance;
  
  const config = getConfig();
  
  if (config.email.enabled && config.email.host) {
    try {
      const smtpAdapter = new SMTPEmailAdapter({
        host: config.email.host,
        port: config.email.port,
        user: config.email.user,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || null,
        from: config.email.from,
      });
      
      // Test connection
      const connected = await smtpAdapter.testConnection();
      if (connected) {
        emailInstance = smtpAdapter;
        console.log('[Email] Using SMTP:', config.email.host);
        return emailInstance;
      }
    } catch (error) {
      console.warn('[Email] SMTP connection failed, falling back to mock:', error);
    }
  }
  
  // Fallback to mock
  emailInstance = new MockEmailAdapter();
  console.log('[Email] Using mock adapter (console logging)');
  return emailInstance;
}

/**
 * Get a tenant-specific email adapter.
 * Loads SMTP config from the database first, falls back to env vars.
 * Returns a fresh adapter instance (not cached) so each tenant gets
 * its own configuration.
 */
export async function getEmailForTenant(tenantId: string): Promise<EmailAdapter> {
  const cfg = await getSMTPConfig(tenantId);

  if (cfg.host) {
    try {
      const adapter = new SMTPEmailAdapter({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user || null,
        pass: cfg.password || null,
        from: cfg.from,
      });

      const connected = await adapter.testConnection();
      if (connected) {
        console.log(`[Email] Using SMTP for tenant ${tenantId}:`, cfg.host, `(${cfg.source})`);
        return adapter;
      }
    } catch (error) {
      console.warn(`[Email] Tenant SMTP connection failed (source: ${cfg.source}), falling back:`, error);
    }
  }

  // Fall back to the global adapter (env-based or mock)
  return getEmail();
}

/**
 * Send a single email
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const email = await getEmail();
  return email.send(options);
}

/**
 * Send multiple emails
 */
export async function sendEmailBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
  const email = await getEmail();
  return email.sendBatch(emails);
}

/**
 * Reset email adapter (for testing)
 */
export function resetEmail(): void {
  emailInstance = null;
}

// Export types and classes
export { MockEmailAdapter, SMTPEmailAdapter };
