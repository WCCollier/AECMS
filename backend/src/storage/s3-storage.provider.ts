import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SettingsService } from '../settings/settings.service';
import {
  StorageProvider,
  UploadOptions,
  FileMetadata,
  StorageProviderType,
} from './storage.interface';

/**
 * S3-protocol storage provider (ESM — S3 protocol).
 *
 * Works with AWS S3 and any S3-compatible service:
 *   Cloudflare R2, Backblaze B2, DigitalOcean Spaces, MinIO, Linode Object Storage, etc.
 * For non-AWS providers, set storage.s3_endpoint to the provider's S3-compatible endpoint URL.
 *
 * Routes files to two buckets based on path prefix:
 *   digital-products/**  → private digital bucket (signed URLs)
 *   everything else      → public media bucket (permanent public URLs)
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly settingsService: SettingsService) {}

  private isDigitalPath(filePath: string): boolean {
    return filePath.startsWith('digital-products/');
  }

  private async buildClient(): Promise<S3Client> {
    const [region, endpoint, accessKeyId, secretAccessKey] = await Promise.all([
      this.settingsService.getEffective('storage.s3_region'),
      this.settingsService.getEffective('storage.s3_endpoint'),
      this.settingsService.getEffective('storage.s3_access_key_id'),
      this.settingsService.getEffective('storage.s3_secret_access_key_enc'),
    ]);

    const config: ConstructorParameters<typeof S3Client>[0] = {
      region: region || 'us-east-1',
    };
    if (endpoint) {
      config.endpoint = endpoint;
      config.forcePathStyle = true; // required for most S3-compatible providers
    }
    if (accessKeyId && secretAccessKey) {
      config.credentials = { accessKeyId, secretAccessKey };
    }
    return new S3Client(config);
  }

  private async getBucketName(filePath: string): Promise<string> {
    const key = this.isDigitalPath(filePath)
      ? 'storage.s3_bucket_digital'
      : 'storage.s3_bucket_media';
    const name = await this.settingsService.getEffective(key);
    if (!name) throw new Error(`S3 bucket not configured (${key})`);
    return name;
  }

  async upload(file: Buffer, filePath: string, options?: UploadOptions): Promise<string> {
    const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: file,
      ContentType: options?.contentType ?? 'application/octet-stream',
      Metadata: options?.metadata,
    }));
    this.logger.debug(`S3 upload: s3://${bucket}/${filePath}`);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: filePath }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(filePath: string): Promise<void> {
    const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: filePath }));
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: filePath }));
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(filePath: string, expiresIn?: number): Promise<string> {
    if (expiresIn) {
      const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: filePath }), { expiresIn });
    }

    const cdnBase = await this.settingsService.getEffective('storage.cdn_base_url');
    if (cdnBase) {
      return `${cdnBase.replace(/\/$/, '')}/${filePath}`;
    }

    const [region, bucket] = await Promise.all([
      this.settingsService.getEffective('storage.s3_region'),
      this.getBucketName(filePath),
    ]);
    return `https://${bucket}.s3.${region || 'us-east-1'}.amazonaws.com/${filePath}`;
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    const [client, bucket] = await Promise.all([this.buildClient(), this.getBucketName(filePath)]);
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: filePath }));
    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType,
      lastModified: response.LastModified ?? new Date(),
      metadata: response.Metadata,
    };
  }

  getProviderType(): StorageProviderType {
    return 's3';
  }
}
