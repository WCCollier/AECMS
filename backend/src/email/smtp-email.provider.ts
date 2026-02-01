import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailProvider,
  EmailOptions,
  EmailWithAttachmentOptions,
  EmailResult,
  EmailProviderType,
} from './email.interface';

/**
 * SMTP Email Provider
 *
 * Production provider that sends emails via SMTP.
 * Compatible with any SMTP server (Gmail, SendGrid, Mailgun, SES, etc.)
 *
 * Configuration:
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false (true for port 465)
 *   SMTP_USER=username
 *   SMTP_PASS=password
 *   SMTP_FROM=noreply@example.com
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly defaultFrom: string;

  constructor(private configService: ConfigService) {
    this.defaultFrom = this.configService.get<string>(
      'SMTP_FROM',
      'noreply@aecms.local',
    );
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      this.logger.warn('SMTP_HOST not configured, email sending will fail');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`SMTP transporter initialized: ${host}:${port}`);
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not configured',
      };
    }

    try {
      const result = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      });

      this.logger.debug(`Email sent: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendWithAttachment(
    options: EmailWithAttachmentOptions,
  ): Promise<EmailResult> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not configured',
      };
    }

    try {
      const attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));

      const result = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments,
      });

      this.logger.debug(
        `Email with ${attachments.length} attachment(s) sent: ${result.messageId}`,
      );
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email with attachment: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error}`);
      return false;
    }
  }

  getProviderType(): EmailProviderType {
    return 'smtp';
  }
}
