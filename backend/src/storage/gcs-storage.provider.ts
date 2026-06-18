import { Injectable, Logger } from '@nestjs/common';
import { Storage, Bucket } from '@google-cloud/storage';
import { SettingsService } from '../settings/settings.service';
import {
  StorageProvider,
  UploadOptions,
  FileMetadata,
  StorageProviderType,
} from './storage.interface';

/**
 * Google Cloud Storage provider (ESM — GCS protocol).
 *
 * Routes files to two buckets based on path prefix:
 *   digital-products/**  → private digital bucket (signed URLs)
 *   everything else      → public media bucket (permanent public URLs)
 *
 * Authentication: Application Default Credentials (Cloud Run Workload Identity)
 * or a service account JSON supplied via storage.gcs_credentials_json_enc in ISM.
 *
 * Also covers any GCS-compatible endpoint via storage.gcs_endpoint override.
 */
@Injectable()
export class GcsStorageProvider implements StorageProvider {
  private readonly logger = new Logger(GcsStorageProvider.name);

  constructor(private readonly settingsService: SettingsService) {}

  private isDigitalPath(filePath: string): boolean {
    return filePath.startsWith('digital-products/');
  }

  private async buildStorage(): Promise<Storage> {
    const [projectId, credentialsJson, endpoint] = await Promise.all([
      this.settingsService.getEffective('storage.gcs_project_id'),
      this.settingsService.getEffective('storage.gcs_credentials_json_enc'),
      this.settingsService.getEffective('storage.gcs_endpoint'),
    ]);
    const opts: ConstructorParameters<typeof Storage>[0] = {};
    if (projectId) opts.projectId = projectId;
    if (endpoint) opts.apiEndpoint = endpoint;
    if (credentialsJson) {
      try {
        opts.credentials = JSON.parse(credentialsJson);
      } catch {
        throw new Error('storage.gcs_credentials_json_enc is not valid JSON');
      }
    }
    return new Storage(opts);
  }

  private async getBucket(filePath: string): Promise<Bucket> {
    const bucketKey = this.isDigitalPath(filePath)
      ? 'storage.gcs_bucket_digital'
      : 'storage.gcs_bucket_media';
    const [storage, bucketName] = await Promise.all([
      this.buildStorage(),
      this.settingsService.getEffective(bucketKey),
    ]);
    if (!bucketName) {
      throw new Error(`GCS bucket not configured (${bucketKey})`);
    }
    return storage.bucket(bucketName);
  }

  async upload(file: Buffer, filePath: string, options?: UploadOptions): Promise<string> {
    const bucket = await this.getBucket(filePath);
    await bucket.file(filePath).save(file, {
      metadata: {
        contentType: options?.contentType ?? 'application/octet-stream',
        metadata: options?.metadata,
      },
    });
    this.logger.debug(`GCS upload: gs://${bucket.name}/${filePath}`);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const bucket = await this.getBucket(filePath);
    const [contents] = await bucket.file(filePath).download();
    return Buffer.from(contents);
  }

  async delete(filePath: string): Promise<void> {
    const bucket = await this.getBucket(filePath);
    await bucket.file(filePath).delete({ ignoreNotFound: true });
  }

  async exists(filePath: string): Promise<boolean> {
    const bucket = await this.getBucket(filePath);
    const [exists] = await bucket.file(filePath).exists();
    return exists;
  }

  async getUrl(filePath: string, expiresIn?: number): Promise<string> {
    const bucket = await this.getBucket(filePath);

    if (expiresIn) {
      const [url] = await bucket.file(filePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });
      return url;
    }

    const cdnBase = await this.settingsService.getEffective('storage.cdn_base_url');
    if (cdnBase) {
      return `${cdnBase.replace(/\/$/, '')}/${filePath}`;
    }
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    const bucket = await this.getBucket(filePath);
    const [meta] = await bucket.file(filePath).getMetadata();
    return {
      size: parseInt(meta.size as string, 10),
      contentType: meta.contentType as string | undefined,
      lastModified: new Date(meta.updated as string),
      metadata: meta.metadata as Record<string, string> | undefined,
    };
  }

  getProviderType(): StorageProviderType {
    return 'gcs';
  }
}
