import { Injectable, Logger, Optional } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  EmailProvider,
  EmailOptions,
  EmailWithAttachmentOptions,
  EmailResult,
  EmailProviderType,
} from './email.interface';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(@Optional() private settingsService?: SettingsService) {}

  private async buildTransporter(): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
    const host = await this.getEffective('email.smtp_host', 'SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP host not configured');
      return null;
    }

    const portStr = await this.getEffective('email.smtp_port', 'SMTP_PORT');
    const port = parseInt(portStr || '587', 10);
    const security = await this.getEffective('email.smtp_security', 'SMTP_SECURITY');
    const secure = security === 'ssl' || process.env.SMTP_SECURE === 'true';
    const user = await this.getEffective('email.smtp_user', 'SMTP_USER');
    const pass = await this.getEffective('email.smtp_pass_enc', 'SMTP_PASS');
    const from = await this.getEffective('email.from_address', 'SMTP_FROM') || 'noreply@aecms.local';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    return { transporter, from };
  }

  private async getEffective(ismKey: string, envFallback: string): Promise<string> {
    if (this.settingsService) {
      return this.settingsService.getEffective(ismKey);
    }
    return process.env[envFallback] ?? '';
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const config = await this.buildTransporter();
    if (!config) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      const result = await config.transporter.sendMail({
        from: options.from || config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      });
      this.logger.debug(`Email sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendWithAttachment(options: EmailWithAttachmentOptions): Promise<EmailResult> {
    const config = await this.buildTransporter();
    if (!config) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      const attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));

      const result = await config.transporter.sendMail({
        from: options.from || config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments,
      });

      this.logger.debug(`Email with ${attachments.length} attachment(s) sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email with attachment: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async verify(): Promise<boolean> {
    const config = await this.buildTransporter();
    if (!config) return false;
    try {
      await config.transporter.verify();
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
