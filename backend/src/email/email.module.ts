import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { ResendBroadcastService } from './resend-broadcast.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { EMAIL_PROVIDER, EmailProviderType } from './email.interface';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';

@Global()
@Module({
  imports: [ConfigModule, forwardRef(() => SettingsModule)],
  controllers: [ResendWebhookController],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService, settingsService: SettingsService) => {
        const providerType = configService.get<EmailProviderType>(
          'EMAIL_PROVIDER_TYPE',
          'console',
        );
        switch (providerType) {
          case 'smtp':
            return new SmtpEmailProvider(settingsService);
          case 'console':
          default:
            return new ConsoleEmailProvider();
        }
      },
      inject: [ConfigService, SettingsService],
    },
    ConsoleEmailProvider,
    SmtpEmailProvider,
    ResendBroadcastService,
  ],
  exports: [EMAIL_PROVIDER, ConsoleEmailProvider, SmtpEmailProvider, ResendBroadcastService],
})
export class EmailModule {}
