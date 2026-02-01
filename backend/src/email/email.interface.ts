/**
 * Email Provider Interface
 *
 * Abstraction for email sending operations.
 * Implementations: ConsoleEmailProvider (dev), SmtpEmailProvider, etc.
 *
 * Primary use case: Send to Kindle feature for digital products
 */
export interface EmailProvider {
  /**
   * Send an email
   * @param options - Email options
   * @returns Message ID or provider-specific identifier
   */
  send(options: EmailOptions): Promise<EmailResult>;

  /**
   * Send an email with file attachment(s)
   * @param options - Email options with attachments
   * @returns Message ID or provider-specific identifier
   */
  sendWithAttachment(options: EmailWithAttachmentOptions): Promise<EmailResult>;

  /**
   * Verify the email provider is configured and working
   */
  verify(): Promise<boolean>;

  /**
   * Get the provider type identifier
   */
  getProviderType(): EmailProviderType;
}

export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailWithAttachmentOptions extends EmailOptions {
  attachments: EmailAttachment[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export type EmailProviderType = 'console' | 'smtp' | 'sendgrid' | 'ses' | 'mailgun';

/**
 * Email provider injection token
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/**
 * Special email domains for Send to Kindle
 */
export const KINDLE_EMAIL_DOMAINS = [
  '@kindle.com',
  '@free.kindle.com',
] as const;

/**
 * Check if an email address is a Kindle email
 */
export function isKindleEmail(email: string): boolean {
  const lowercased = email.toLowerCase();
  return KINDLE_EMAIL_DOMAINS.some((domain) => lowercased.endsWith(domain));
}
