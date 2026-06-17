import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { EmailModule } from '../email/email.module';
import { SettingsService } from './settings.service';
import { SettingsController, PublicSettingsController } from './settings.controller';
import { TestEmailService } from './test-email.service';
import { KEY_PROVIDER } from './key-provider.interface';
import { LocalKeyProvider } from './local-key.provider';

const keyProviderFactory = {
  provide: KEY_PROVIDER,
  useFactory: (config: ConfigService) => {
    const providerType = config.get<string>('SETTINGS_KMS_PROVIDER', 'local');
    switch (providerType) {
      // Future: 'gcp', 'aws', 'vault' providers go here
      default:
        return new LocalKeyProvider(config.get<string>('SETTINGS_ENCRYPTION_KEY', ''));
    }
  },
  inject: [ConfigService],
};

@Module({
  imports: [PrismaModule, AuditModule, CapabilitiesModule, EmailModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [keyProviderFactory, SettingsService, TestEmailService],
  exports: [SettingsService],
})
export class SettingsModule {}
