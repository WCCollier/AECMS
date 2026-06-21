import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { STORAGE_PROVIDER } from './storage.interface';
import type { StorageProvider } from './storage.interface';
import { GcsStorageProvider } from './gcs-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import type { SettingsService } from '../settings/settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('system.configure.storage')
@Controller('settings')
export class StorageController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  @Post('test-storage')
  @ApiOperation({ summary: 'Test the active storage provider with a round-trip write/read/delete' })
  async testStorage(): Promise<{ success: boolean; provider: string; message: string }> {
    const testPath = `_system/storage-test-${Date.now()}.txt`;
    const testContent = Buffer.from('ESM storage connectivity test');
    const provider = this.storage.getProviderType();
    try {
      await this.storage.upload(testContent, testPath, { contentType: 'text/plain' });
      const downloaded = await this.storage.download(testPath);
      if (downloaded.toString() !== testContent.toString()) {
        throw new Error('Round-trip content mismatch');
      }
      await this.storage.delete(testPath);
      return { success: true, provider, message: `${provider} storage is working` };
    } catch (err: any) {
      return { success: false, provider, message: err?.message ?? 'Storage test failed' };
    }
  }

  @Post('test-storage-preview')
  @ApiOperation({ summary: 'Test a storage provider using config from the request body (not saved config)' })
  async testStoragePreview(
    @Body() config: Record<string, string>,
  ): Promise<{ success: boolean; provider: string; message: string }> {
    const providerType = config['storage.provider_type'] ?? process.env.STORAGE_PROVIDER_TYPE ?? 'local';
    const testPath = `_system/storage-test-${Date.now()}.txt`;
    const testContent = Buffer.from('ESM storage connectivity test');

    let provider: StorageProvider;
    if (providerType === 'local') {
      provider = this.storage;
    } else {
      // Duck-typed adapter: providers call getEffective(key) lazily, so we satisfy just that method
      const adHoc = { getEffective: async (key: string) => config[key] ?? '' } as unknown as SettingsService;
      provider = providerType === 'gcs'
        ? new GcsStorageProvider(adHoc)
        : new S3StorageProvider(adHoc);
    }

    try {
      await provider.upload(testContent, testPath, { contentType: 'text/plain' });
      const downloaded = await provider.download(testPath);
      if (downloaded.toString() !== testContent.toString()) {
        throw new Error('Round-trip content mismatch');
      }
      await provider.delete(testPath);
      return { success: true, provider: providerType, message: `${providerType} storage is working` };
    } catch (err: any) {
      return { success: false, provider: providerType, message: err?.message ?? 'Storage test failed' };
    }
  }
}
