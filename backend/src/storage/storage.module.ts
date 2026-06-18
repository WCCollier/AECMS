import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { LocalStorageProvider } from './local-storage.provider';
import { GcsStorageProvider } from './gcs-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageController } from './storage.controller';
import { STORAGE_PROVIDER, StorageProviderType } from './storage.interface';

/**
 * External Storage Manager (ESM)
 *
 * Provider-agnostic file storage abstraction. Select a provider via STORAGE_PROVIDER_TYPE:
 *   local  — local filesystem (default; dev and single-server deployments)
 *   gcs    — Google Cloud Storage (GCS protocol; also covers GCS-compatible endpoints)
 *   s3     — AWS S3 (S3 protocol; also covers R2, B2, DO Spaces, MinIO, etc.)
 *   azure  — Azure Blob Storage (future)
 *
 * Provider-specific credentials are read lazily from the ISM (SettingsService.getEffective())
 * so changes made via Admin Settings take effect on the next file operation, without restart.
 */
@Global()
@Module({
  imports: [ConfigModule, SettingsModule],
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService, settingsService: SettingsService) => {
        const providerType = configService.get<StorageProviderType>(
          'STORAGE_PROVIDER_TYPE',
          'local',
        );
        switch (providerType) {
          case 'gcs':
            return new GcsStorageProvider(settingsService);
          case 's3':
            return new S3StorageProvider(settingsService);
          case 'azure':
            // Future: return new AzureBlobStorageProvider(settingsService);
            throw new Error('Azure Blob Storage provider not yet implemented. Use local, gcs, or s3.');
          case 'local':
          default:
            return new LocalStorageProvider(configService);
        }
      },
      inject: [ConfigService, SettingsService],
    },
    LocalStorageProvider,
    GcsStorageProvider,
    S3StorageProvider,
  ],
  exports: [STORAGE_PROVIDER, LocalStorageProvider, GcsStorageProvider, S3StorageProvider],
})
export class StorageModule {}
