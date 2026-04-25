import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  cc?: string;
  bcc?: string;
}

function getEmailConfig(): EmailConfig {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'StaySuite',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'billing@staysuite.com',
  };
}

function createTransporter() {
  const config = getEmailConfig();

  if (!config.user || !config.pass) {
    throw new Error('SMTP credentials not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text || stripHtml(options.html),
      html: options.html,
      attachments: options.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to send email:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  return !!(config.user && config.pass);
}

export function generateInvoiceEmailHtml(params: {
  customerName: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  notes?: string;
}): string {
  const { customerName, invoiceNumber, amount, currency, dueDate, companyName, companyAddress, companyPhone, companyEmail, notes } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 640px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 16px 16px 0 0; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .body { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .amount { font-size: 36px; font-weight: 700; color: #059669; }
    .currency { font-size: 16px; color: #6b7280; margin-top: 4px; }
    .details { margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .detail-label { color: #6b7280; }
    .detail-value { font-weight: 500; }
    .notes { background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 20px; font-size: 14px; color: #4b5563; }
    .footer { text-align: center; padding: 24px 30px; color: #9ca3af; font-size: 12px; }
    .company-info { text-align: left; margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .company-name { font-weight: 600; font-size: 15px; color: #111; margin-bottom: 4px; }
    .company-detail { font-size: 13px; color: #6b7280; line-height: 1.5; }
    .btn { display: inline-block; background: #059669; color: white !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .btn:hover { background: #047857; }
    @media only screen and (max-width: 600px) {
      .container { padding: 10px; }
      .header, .body { padding: 20px; }
      .amount { font-size: 28px; }
      .detail-row { flex-direction: column; gap: 2px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Invoice ${invoiceNumber}</h1>
      <p>A new invoice has been generated for you.</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${customerName},</p>
      <p style="font-size: 14px; color: #4b5563;">A new invoice has been generated for your booking. Please find the details below.</p>

      <div class="company-info">
        <div class="company-name">${companyName}</div>
        ${companyAddress ? `<div class="company-detail">${companyAddress}</div>` : ''}
        ${companyPhone ? `<div class="company-detail">${companyPhone}</div>` : ''}
        ${companyEmail ? `<div class="company-detail">${companyEmail}</div>` : ''}
      </div>

      <div class="amount-box">
        <div class="amount">${amount}</div>
        <div class="currency">${currency}</div>
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Invoice Number</span>
          <span class="detail-value">${invoiceNumber}</span>
        </div>
        ${dueDate ? `
        <div class="detail-row">
          <span class="detail-label">Due Date</span>
          <span class="detail-value">${dueDate}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value" style="color: #059669;">Pending Payment</span>
        </div>
      </div>

      ${notes ? `
      <div class="notes">
        <strong>Note:</strong> ${notes}
      </div>` : ''}

      <div style="text-align: center;">
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Please make payment at your earliest convenience. If you have any questions, don't hesitate to contact us.</p>
      </div>
    </div>
    <div class="footer">
      <p>Thank you for choosing ${companyName}.</p>
      <p style="margin-top: 8px;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
