import { Inject, Injectable, Logger } from '@nestjs/common';
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
      const fromAddress = await this.settingsService.getEffective('email.from_address');
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
}
