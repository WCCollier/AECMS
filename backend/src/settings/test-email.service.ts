import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailProvider } from '../email/email.interface';
import { EMAIL_PROVIDER } from '../email/email.interface';
import { SettingsService } from './settings.service';

@Injectable()
export class TestEmailService {
  private readonly logger = new Logger(TestEmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private emailProvider: EmailProvider,
    private settingsService: SettingsService,
  ) {}

  async send(recipientEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      const siteTitle = await this.settingsService.getEffective('general.site_title') || 'AECMS';
      const fromAddress = await this.settingsService.getEffective('email.system_from');
      const fromName = await this.settingsService.getEffective('email.from_name') || siteTitle;

      const result = await this.emailProvider.send({
        to: recipientEmail,
        from: fromAddress ? `${fromName} <${fromAddress}>` : undefined,
        subject: `Test email from ${siteTitle}`,
        text: `This is a test email from ${siteTitle}. Your SMTP configuration is working correctly.`,
        html: `<p>This is a test email from <strong>${siteTitle}</strong>. Your SMTP configuration is working correctly.</p>`,
      });

      if (result.success) {
        return { success: true, message: `Test email sent to ${recipientEmail}` };
      } else {
        return { success: false, message: result.error ?? 'Email send failed' };
      }
    } catch (err: any) {
      this.logger.error('Test email failed', err);
      return { success: false, message: err?.message ?? 'Unknown error' };
    }
  }

  // Send a test email using config values from the request body (not saved ISM config).
  // Builds a temporary transporter so the user can test before saving.
  async sendWithConfig(
    recipientEmail: string,
    config: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    const host = config['email.smtp_host'] || config['smtp_host'];
    if (!host) {
      return { success: false, message: 'SMTP host is required' };
    }

    const port    = parseInt(config['email.smtp_port'] || config['smtp_port'] || '587', 10);
    const secure  = (config['email.smtp_security'] || config['smtp_security']) === 'ssl';
    const user    = config['email.smtp_user'] || config['smtp_user'];
    const pass    = config['email.smtp_pass_enc'] || config['smtp_pass'];
    const from    = config['email.system_from'] || config['from_address'] || 'noreply@aecms.local';
    const fromName = config['email.from_name'] || config['from_name'] || 'AECMS';

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });

      const result = await transporter.sendMail({
        from: `${fromName} <${from}>`,
        to: recipientEmail,
        subject: `SMTP test from AECMS`,
        text: `SMTP is configured correctly. Host: ${host}:${port}`,
        html: `<p>SMTP is configured correctly.</p><p>Host: <strong>${host}:${port}</strong></p>`,
      });

      this.logger.log(`Preview test email sent: ${result.messageId}`);
      return { success: true, message: `Test email sent to ${recipientEmail}` };
    } catch (err: any) {
      this.logger.error('Preview test email failed', err);
      return { success: false, message: err?.message ?? 'Unknown error' };
    }
  }
}
