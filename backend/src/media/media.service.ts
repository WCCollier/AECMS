import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { Media } from '@prisma/client';
import sharp from 'sharp';
import * as path from 'path';
import { UpdateMediaDto, QueryMediaDto } from './dto';
import { STORAGE_PROVIDER } from '../storage';
import type { StorageProvider } from '../storage';

@Injectable()
export class MediaService {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10 MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
    altText?: string,
    caption?: string,
  ): Promise<Media> {
    this.validateFile(file);

    try {
      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFilename(file.originalname);
      const filename = `${timestamp}-${sanitizedName}`;

      await this.storageProvider.upload(file.buffer, filename, {
        contentType: file.mimetype,
        metadata: { originalName: file.originalname, uploadedBy: userId },
      });

      let thumbnailPath: string | null = null;
      const isImage = file.mimetype.startsWith('image/');

      if (isImage && file.mimetype !== 'image/svg+xml') {
        thumbnailPath = await this.generateThumbnail(file.buffer, filename);
      }

      const dimensions = isImage ? await this.getImageDimensions(file.buffer) : null;

      const media = await this.prisma.media.create({
        data: {
          filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          file_path: filename,
          thumbnail_path: thumbnailPath,
          alt_text: altText || null,
          caption: caption || null,
          uploaded_by: userId,
          width: dimensions?.width,
          height: dimensions?.height,
        },
      });

      await this.auditLog.log({
        event_type: 'media.uploaded',
        user_id: userId,
        resource_type: 'media',
        resource_id: media.id,
        metadata: { filename: file.originalname, mime_type: file.mimetype, size: file.size },
      });

      return this.transformMedia(media);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  async findAll(query: QueryMediaDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { original_name: { contains: search, mode: 'insensitive' as const } },
            { alt_text: { contains: search, mode: 'insensitive' as const } },
            { caption: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where, skip, take: limit,
        orderBy: { uploaded_at: 'desc' },
        include: {
          uploader: { select: { id: true, email: true, first_name: true, last_name: true } },
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: media.map((m) => this.transformMedia(m)),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, email: true, first_name: true, last_name: true } },
      },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.transformMedia(media);
  }

  async update(id: string, dto: UpdateMediaDto): Promise<Media> {
    const media = await this.findOne(id);
    return this.prisma.media.update({
      where: { id },
      data: {
        alt_text: dto.alt_text !== undefined ? dto.alt_text : media.alt_text,
        caption: dto.caption !== undefined ? dto.caption : media.caption,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const media = await this.findOne(id);
    try {
      await this.storageProvider.delete(this.storagePath(media.file_path));
      if (media.thumbnail_path) {
        await this.storageProvider.delete(this.storagePath(media.thumbnail_path)).catch(() => {});
      }
      await this.prisma.media.delete({ where: { id } });
      await this.auditLog.log({
        event_type: 'media.deleted',
        resource_type: 'media',
        resource_id: id,
        metadata: { filename: media.original_name, mime_type: media.mime_type },
      });
    } catch (error) {
      throw new InternalServerErrorException(`Failed to delete media: ${error.message}`);
    }
  }

  async getFileBuffer(id: string): Promise<{ buffer: Buffer; media: Media }> {
    const media = await this.findOne(id);
    try {
      const buffer = await this.storageProvider.download(this.storagePath(media.file_path));
      return { buffer, media };
    } catch {
      throw new NotFoundException('Media file not found in storage');
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Resolve a stored file_path to a storage key.
   * Legacy records (before ESM) stored absolute filesystem paths; new records store
   * the relative filename. The local provider serves both correctly since it
   * computes its own basePath internally.
   */
  private storagePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.basename(filePath);
    }
    return filePath;
  }

  private mediaUrl(filePath: string): string {
    const storagePath = this.storagePath(filePath);
    // getUrl is async but transformMedia is sync — local provider URLs are
    // deterministic so we compute them inline. Cloud providers store public URLs
    // directly from upload() response, but for now we replicate the same logic.
    // Full async URL resolution is available via storageProvider.getUrl(storagePath).
    const providerType = this.storageProvider.getProviderType();
    if (providerType === 'local') {
      return `/uploads/${storagePath}`;
    }
    // For cloud providers, callers that need a full URL should call
    // storageProvider.getUrl() directly. The stored file_path is the storage key.
    return storagePath;
  }

  transformMedia(media: any) {
    return {
      ...media,
      url: this.mediaUrl(media.file_path),
    };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.+/g, '.')
      .substring(0, 200);
  }

  private async generateThumbnail(fileBuffer: Buffer, originalFilename: string): Promise<string | null> {
    try {
      const thumbBuffer = await sharp(fileBuffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const thumbFilename = `thumb-${originalFilename.replace(/\.[^.]+$/, '.jpg')}`;
      await this.storageProvider.upload(thumbBuffer, thumbFilename, { contentType: 'image/jpeg' });
      return thumbFilename;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  private async getImageDimensions(
    buffer: Buffer,
  ): Promise<{ width: number | undefined; height: number | undefined } | null> {
    try {
      const meta = await sharp(buffer).metadata();
      return { width: meta.width, height: meta.height };
    } catch {
      return null;
    }
  }
}
