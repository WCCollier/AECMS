import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { EMAIL_PROVIDER, EmailProviderType } from './email.interface';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';

@Global()
@Module({
  imports: [ConfigModule, forwardRef(() => SettingsModule)],
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
  ],
  exports: [EMAIL_PROVIDER, ConsoleEmailProvider, SmtpEmailProvider],
})
export class EmailModule {}
