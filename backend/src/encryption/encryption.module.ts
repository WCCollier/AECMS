import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalKeyProvider } from '../settings/local-key.provider';
import { GcpKeyProvider } from '../settings/gcp-key.provider';
import { EncryptionService, ENCRYPTION_KEY_PROVIDER } from './encryption.service';

const encryptionKeyProviderFactory = {
  provide: ENCRYPTION_KEY_PROVIDER,
  useFactory: (config: ConfigService) => {
    const providerType = config.get<string>('SETTINGS_KMS_PROVIDER', 'local');
    switch (providerType) {
      case 'gcp':
        return new GcpKeyProvider(
          config.get<string>('GCP_PROJECT_ID', ''),
          config.get<string>('SETTINGS_KMS_SECRET_ID', 'aecms-sek'),
        );
      default:
        return new LocalKeyProvider(config.get<string>('SETTINGS_ENCRYPTION_KEY', ''));
    }
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [encryptionKeyProviderFactory, EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
