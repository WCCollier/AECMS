import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { EMAIL_PROVIDER, EmailProviderType } from './email.interface';

/**
 * Email Module
 *
 * Provides email sending abstraction.
 * Uses console provider in development, SMTP in production.
 *
 * Configuration:
 *   EMAIL_PROVIDER=console|smtp (default: console)
 *
 * For SMTP:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const providerType = configService.get<EmailProviderType>(
          'EMAIL_PROVIDER_TYPE',
          'console',
        );

        switch (providerType) {
          case 'smtp':
            return new SmtpEmailProvider(configService);
          case 'console':
          default:
            return new ConsoleEmailProvider();
        }
      },
      inject: [ConfigService],
    },
    ConsoleEmailProvider,
    SmtpEmailProvider,
  ],
  exports: [EMAIL_PROVIDER, ConsoleEmailProvider, SmtpEmailProvider],
})
export class EmailModule {}
