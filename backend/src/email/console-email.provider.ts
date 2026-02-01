import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailOptions,
  EmailWithAttachmentOptions,
  EmailResult,
  EmailProviderType,
} from './email.interface';

/**
 * Console Email Provider
 *
 * Development-only provider that logs emails to console instead of sending.
 * Useful for testing and development without actual email service.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);
  private messageCounter = 0;

  async send(options: EmailOptions): Promise<EmailResult> {
    this.messageCounter++;
    const messageId = `console-${Date.now()}-${this.messageCounter}`;

    this.logger.log('='.repeat(60));
    this.logger.log('EMAIL SENT (Console Provider - Not Actually Sent)');
    this.logger.log('='.repeat(60));
    this.logger.log(`Message ID: ${messageId}`);
    this.logger.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    this.logger.log(`From: ${options.from || '(default)'}`);
    this.logger.log(`Subject: ${options.subject}`);
    if (options.replyTo) {
      this.logger.log(`Reply-To: ${options.replyTo}`);
    }
    this.logger.log('-'.repeat(60));
    if (options.text) {
      this.logger.log('TEXT CONTENT:');
      this.logger.log(options.text);
    }
    if (options.html) {
      this.logger.log('HTML CONTENT:');
      this.logger.log(options.html.substring(0, 500) + (options.html.length > 500 ? '...' : ''));
    }
    this.logger.log('='.repeat(60));

    return {
      success: true,
      messageId,
    };
  }

  async sendWithAttachment(
    options: EmailWithAttachmentOptions,
  ): Promise<EmailResult> {
    this.messageCounter++;
    const messageId = `console-${Date.now()}-${this.messageCounter}`;

    this.logger.log('='.repeat(60));
    this.logger.log('EMAIL WITH ATTACHMENT (Console Provider - Not Actually Sent)');
    this.logger.log('='.repeat(60));
    this.logger.log(`Message ID: ${messageId}`);
    this.logger.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    this.logger.log(`From: ${options.from || '(default)'}`);
    this.logger.log(`Subject: ${options.subject}`);
    if (options.replyTo) {
      this.logger.log(`Reply-To: ${options.replyTo}`);
    }
    this.logger.log('-'.repeat(60));
    this.logger.log('ATTACHMENTS:');
    for (const attachment of options.attachments) {
      this.logger.log(
        `  - ${attachment.filename} (${attachment.content.length} bytes, ${attachment.contentType || 'unknown type'})`,
      );
    }
    this.logger.log('-'.repeat(60));
    if (options.text) {
      this.logger.log('TEXT CONTENT:');
      this.logger.log(options.text);
    }
    this.logger.log('='.repeat(60));

    return {
      success: true,
      messageId,
    };
  }

  async verify(): Promise<boolean> {
    this.logger.log('Console email provider is always available');
    return true;
  }

  getProviderType(): EmailProviderType {
    return 'console';
  }
}
