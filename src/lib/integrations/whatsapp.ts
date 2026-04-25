/**
 * WhatsApp Business API Integration
 * 
 * This module provides a production-ready wrapper for the WhatsApp Business API.
 * It handles message sending, template management, and webhook processing.
 * 
 * Configuration needed:
 * - WHATSAPP_ACCESS_TOKEN: Meta WhatsApp Business API access token
 * - WHATSAPP_PHONE_NUMBER_ID: WhatsApp Business phone number ID
 * - WHATSAPP_BUSINESS_ACCOUNT_ID: WhatsApp Business account ID
 * - WHATSAPP_APP_SECRET: App secret for webhook verification
 */

import { createHmac } from 'crypto';

// Types
export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret?: string;
  apiVersion?: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'interactive';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: {
      code: string;
      policy?: string;
    };
    components?: WhatsAppTemplateComponent[];
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  interactive?: {
    type: 'button' | 'list' | 'product';
    body?: { text: string };
    action?: {
      buttons?: { type: string; reply: { id: string; title: string } }[];
      list?: {
        title: string;
        sections: {
          title: string;
          rows: { id: string; title: string; description?: string }[];
        }[];
      };
    };
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { id: string; link?: string };
    document?: { id: string; link?: string; filename?: string };
    video?: { id: string; link?: string };
  }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name?: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
          context?: {
            id: string;
            forwarded?: boolean;
            frequently_forwarded?: boolean;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            origin: {
              type: string;
            };
            expiration_timestamp?: string;
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
          errors?: Array<{
            code: number;
            title: string;
            message: string;
            error_data?: {
              details: string;
            };
          }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * WhatsApp Business API Client
 */
export class WhatsAppClient {
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion || 'v18.0'}`;
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, text: string): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''), // Remove non-numeric characters
      type: 'text',
      text: {
        body: text,
        preview_url: true,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: WhatsAppTemplateComponent[]
  ): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
          policy: 'deterministic',
        },
        components,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send an image message
   */
  async sendImageMessage(
    to: string,
    imageIdOrUrl: string,
    caption?: string,
    isUrl: boolean = false
  ): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''),
      type: 'image',
      image: {
        ...(isUrl ? { link: imageIdOrUrl } : { id: imageIdOrUrl }),
        caption,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a document message
   */
  async sendDocumentMessage(
    to: string,
    documentIdOrUrl: string,
    filename: string,
    caption?: string,
    isUrl: boolean = false
  ): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''),
      type: 'document',
      document: {
        ...(isUrl ? { link: documentIdOrUrl } : { id: documentIdOrUrl }),
        filename,
        caption,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send an interactive button message
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a list message
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<SendMessageResult> {
    const message: WhatsAppMessage = {
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          list: {
            title: buttonText,
            sections,
          },
        },
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Core message sending function
   */
  private async sendMessage(message: WhatsAppMessage): Promise<SendMessageResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            ...message,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API error:', data);
        return {
          success: false,
          error: data.error?.message || 'Failed to send WhatsApp message',
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(file: Blob, filename: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file, filename);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', file.type);

      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp media upload error:', data);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string): Promise<Blob | null> {
    try {
      // First, get the media URL
      const urlResponse = await fetch(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      const urlData = await urlResponse.json();

      if (!urlResponse.ok) {
        console.error('Error getting media URL:', urlData);
        return null;
      }

      // Then download the actual media
      const mediaResponse = await fetch(urlData.url, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });

      if (!mediaResponse.ok) {
        console.error('Error downloading media');
        return null;
      }

      return await mediaResponse.blob();
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.config.appSecret) {
      console.warn('App secret not configured, skipping signature verification');
      return true;
    }

    const expectedSignature = createHmac('sha256', this.config.appSecret)
      .update(payload)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Get message template list
   */
  async getTemplates(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Error fetching templates:', data);
        return [];
      }

      return data.data || [];
    } catch (error) {
      console.error('Error fetching WhatsApp templates:', error);
      return [];
    }
  }

  /**
   * Create a message template
   */
  async createTemplate(template: {
    name: string;
    category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
    language: string;
    components: any[];
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: template.name,
            category: template.category,
            language: template.language,
            components: template.components,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to create template',
        };
      }

      return {
        success: true,
        id: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Create a WhatsApp client instance from environment variables
 */
export function createWhatsAppClient(): WhatsAppClient | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!accessToken || !phoneNumberId || !businessAccountId) {
    console.warn('WhatsApp credentials not configured');
    return null;
  }

  return new WhatsAppClient({
    accessToken,
    phoneNumberId,
    businessAccountId,
    appSecret,
  });
}

/**
 * Parse webhook payload for easier processing
 */
export function parseWebhookPayload(payload: WhatsAppWebhookPayload): {
  type: 'message' | 'status' | 'unknown';
  data: any;
} | null {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return null;

    // Handle incoming message
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const contact = value.contacts?.[0];

      return {
        type: 'message',
        data: {
          from: message.from,
          messageId: message.id,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          type: message.type,
          content: message.text?.body || message.image || message.document || message.audio || message.video || message.location,
          contactName: contact?.profile?.name,
          phoneNumberId: value.metadata.phone_number_id,
          context: message.context,
          interactive: message.interactive,
        },
      };
    }

    // Handle message status update
    if (value.statuses && value.statuses.length > 0) {
      const status = value.statuses[0];

      return {
        type: 'status',
        data: {
          messageId: status.id,
          status: status.status,
          timestamp: new Date(parseInt(status.timestamp) * 1000),
          recipientId: status.recipient_id,
          conversation: status.conversation,
          pricing: status.pricing,
          errors: status.errors,
        },
      };
    }

    return { type: 'unknown', data: null };
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

// Export singleton instance getter
let whatsAppClientInstance: WhatsAppClient | null = null;

export function getWhatsAppClient(): WhatsAppClient | null {
  if (!whatsAppClientInstance) {
    whatsAppClientInstance = createWhatsAppClient();
  }
  return whatsAppClientInstance;
}
