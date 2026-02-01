import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { STORAGE_PROVIDER, StorageProviderType } from './storage.interface';

/**
 * Storage Module
 *
 * Provides file storage abstraction.
 * Currently supports local filesystem storage.
 * Future: S3, GCS, Azure Blob Storage providers.
 *
 * Configuration:
 *   STORAGE_PROVIDER=local (default)
 *   STORAGE_PATH=/app/uploads (for local provider)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const providerType = configService.get<StorageProviderType>(
          'STORAGE_PROVIDER_TYPE',
          'local',
        );

        switch (providerType) {
          case 'local':
          default:
            return new LocalStorageProvider(configService);
          // Future providers:
          // case 's3':
          //   return new S3StorageProvider(configService);
          // case 'gcs':
          //   return new GcsStorageProvider(configService);
          // case 'azure':
          //   return new AzureBlobStorageProvider(configService);
        }
      },
      inject: [ConfigService],
    },
    LocalStorageProvider,
  ],
  exports: [STORAGE_PROVIDER, LocalStorageProvider],
})
export class StorageModule {}
