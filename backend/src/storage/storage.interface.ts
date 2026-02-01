/**
 * Storage Provider Interface
 *
 * Abstraction for file storage operations.
 * Implementations: LocalStorageProvider, S3StorageProvider (future), etc.
 */
export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param file - File buffer to upload
   * @param path - Destination path (relative to storage root)
   * @param options - Additional options (content type, etc.)
   * @returns The storage path/key of the uploaded file
   */
  upload(
    file: Buffer,
    path: string,
    options?: UploadOptions,
  ): Promise<string>;

  /**
   * Download a file from storage
   * @param path - Storage path/key
   * @returns File buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param path - Storage path/key
   */
  delete(path: string): Promise<void>;

  /**
   * Check if a file exists
   * @param path - Storage path/key
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get a URL for accessing the file
   * For local storage, this returns a relative path
   * For cloud storage, this could return a signed URL
   * @param path - Storage path/key
   * @param expiresIn - Optional expiry time in seconds (for signed URLs)
   */
  getUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Get file metadata
   * @param path - Storage path/key
   */
  getMetadata(path: string): Promise<FileMetadata>;

  /**
   * Get the provider type identifier
   */
  getProviderType(): StorageProviderType;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FileMetadata {
  size: number;
  contentType?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export type StorageProviderType = 'local' | 's3' | 'gcs' | 'azure';

/**
 * Storage provider injection token
 */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
