import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  StorageProvider,
  UploadOptions,
  FileMetadata,
  StorageProviderType,
} from './storage.interface';

/**
 * Local Filesystem Storage Provider
 *
 * Stores files on the local filesystem.
 * Suitable for development and single-server deployments.
 *
 * Configuration:
 *   STORAGE_PATH=/app/uploads (default)
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor(private configService: ConfigService) {
    this.basePath = this.configService.get<string>(
      'STORAGE_PATH',
      path.join(process.cwd(), 'uploads'),
    );
    this.ensureBaseDirectory();
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      this.logger.log(`Storage directory ensured: ${this.basePath}`);
    } catch (error) {
      this.logger.error(`Failed to create storage directory: ${error}`);
    }
  }

  private getFullPath(relativePath: string): string {
    // Prevent directory traversal attacks
    const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.basePath, normalized);
  }

  async upload(
    file: Buffer,
    filePath: string,
    options?: UploadOptions,
  ): Promise<string> {
    const fullPath = this.getFullPath(filePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file);

    // Store metadata if provided
    if (options?.metadata) {
      const metaPath = `${fullPath}.meta.json`;
      await fs.writeFile(
        metaPath,
        JSON.stringify({
          contentType: options.contentType,
          metadata: options.metadata,
          uploadedAt: new Date().toISOString(),
        }),
      );
    }

    this.logger.debug(`File uploaded: ${filePath}`);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    const metaPath = `${fullPath}.meta.json`;

    try {
      await fs.unlink(fullPath);
      // Also delete metadata file if it exists
      try {
        await fs.unlink(metaPath);
      } catch {
        // Metadata file may not exist, ignore
      }
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, consider delete successful
        return;
      }
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(filePath: string, _expiresIn?: number): Promise<string> {
    // For local storage, return a relative URL path
    // The application should serve these files via a static route or controller
    return `/files/${filePath}`;
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    const fullPath = this.getFullPath(filePath);
    const metaPath = `${fullPath}.meta.json`;

    const stats = await fs.stat(fullPath);

    let additionalMeta: any = {};
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      additionalMeta = JSON.parse(metaContent);
    } catch {
      // Metadata file may not exist
    }

    return {
      size: stats.size,
      contentType: additionalMeta.contentType,
      lastModified: stats.mtime,
      metadata: additionalMeta.metadata,
    };
  }

  getProviderType(): StorageProviderType {
    return 'local';
  }

  /**
   * Get the absolute base path (for debugging/admin purposes)
   */
  getBasePath(): string {
    return this.basePath;
  }
}
