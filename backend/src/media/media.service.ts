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
import AdmZip from 'adm-zip';
import { UpdateMediaDto, QueryMediaDto } from './dto';
import { STORAGE_PROVIDER } from '../storage';
import type { StorageProvider } from '../storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024;       // 10 MB per file
const MAX_ZIP_SIZE = 50 * 1024 * 1024;         // 50 MB per zip
const MAX_ZIP_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB total uncompressed
const MAX_ZIP_ENTRIES = 500;

@Injectable()
export class MediaService {
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
    return this.uploadBuffer(file.buffer, file.originalname, file.mimetype, file.size, userId, altText, caption);
  }

  private async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    size: number,
    userId: string,
    altText?: string,
    caption?: string,
  ): Promise<Media> {
    try {
      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFilename(originalName);
      const filename = `${timestamp}-${sanitizedName}`;

      await this.storageProvider.upload(buffer, filename, {
        contentType: mimeType,
        metadata: { originalName, uploadedBy: userId },
      });

      let thumbnailPath: string | null = null;
      const isImage = mimeType.startsWith('image/');

      if (isImage && mimeType !== 'image/svg+xml') {
        thumbnailPath = await this.generateThumbnail(buffer, filename);
      }

      const dimensions = isImage ? await this.getImageDimensions(buffer) : null;

      const media = await this.prisma.media.create({
        data: {
          filename,
          original_name: originalName,
          mime_type: mimeType,
          size,
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
        metadata: { filename: originalName, mime_type: mimeType, size },
      });

      return await this.transformMedia(media);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  async bulkUpload(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<{ succeeded: Media[]; failed: { name: string; error: string }[] }> {
    const succeeded: Media[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const file of files) {
      const isZip = file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip');

      if (isZip) {
        if (file.size > MAX_ZIP_SIZE) {
          failed.push({ name: file.originalname, error: `Zip exceeds 50 MB limit` });
          continue;
        }
        const zipResults = await this.extractAndUploadZip(file, userId);
        succeeded.push(...zipResults.succeeded);
        failed.push(...zipResults.failed);
      } else {
        try {
          this.validateFile(file);
          const media = await this.uploadBuffer(file.buffer, file.originalname, file.mimetype, file.size, userId);
          succeeded.push(media);
        } catch (err) {
          failed.push({ name: file.originalname, error: err.message });
        }
      }
    }

    await this.auditLog.log({
      event_type: 'media.bulk_uploaded',
      user_id: userId,
      resource_type: 'media',
      metadata: { count: succeeded.length, failed: failed.length },
    });

    return { succeeded, failed };
  }

  private async extractAndUploadZip(
    zipFile: Express.Multer.File,
    userId: string,
  ): Promise<{ succeeded: Media[]; failed: { name: string; error: string }[] }> {
    const succeeded: Media[] = [];
    const failed: { name: string; error: string }[] = [];

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipFile.buffer);
    } catch {
      return { succeeded, failed: [{ name: zipFile.originalname, error: 'Invalid or corrupt zip file' }] };
    }

    const entries = zip.getEntries();

    if (entries.length > MAX_ZIP_ENTRIES) {
      return { succeeded, failed: [{ name: zipFile.originalname, error: `Zip contains more than ${MAX_ZIP_ENTRIES} entries` }] };
    }

    const totalUncompressed = entries.reduce((sum, e) => sum + e.header.size, 0);
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED) {
      return { succeeded, failed: [{ name: zipFile.originalname, error: `Zip uncompressed size exceeds 100 MB` }] };
    }

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const entryName = path.basename(entry.entryName);
      if (entryName.startsWith('.') || entryName.startsWith('__MACOSX')) continue;

      if (entry.header.size > MAX_FILE_SIZE) {
        failed.push({ name: entryName, error: `Exceeds 10 MB per-file limit` });
        continue;
      }

      const buffer = entry.getData();
      const mimeType = this.inferMimeType(entryName);

      if (!this.allowedMimeTypes.includes(mimeType)) {
        failed.push({ name: entryName, error: `File type not allowed` });
        continue;
      }

      try {
        const media = await this.uploadBuffer(buffer, entryName, mimeType, buffer.length, userId);
        succeeded.push(media);
      } catch (err) {
        failed.push({ name: entryName, error: err.message });
      }
    }

    return { succeeded, failed };
  }

  async replace(
    id: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<Media> {
    const existing = await this.findOne(id);

    this.validateFile(file);

    const oldSize = existing.size;
    const oldMime = existing.mime_type;

    // Overwrite bytes at same storage key — URL stays stable
    await this.storageProvider.upload(file.buffer, this.storagePath(existing.file_path), {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname, replacedBy: userId },
    });

    // Regenerate thumbnail at same key
    const isImage = file.mimetype.startsWith('image/');
    if (isImage && file.mimetype !== 'image/svg+xml' && existing.thumbnail_path) {
      await this.generateThumbnailToPath(file.buffer, this.storagePath(existing.thumbnail_path));
    }

    const dimensions = isImage ? await this.getImageDimensions(file.buffer) : null;

    const updated = await this.prisma.media.update({
      where: { id },
      data: {
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
      },
    });

    await this.auditLog.log({
      event_type: 'media.replaced',
      user_id: userId,
      resource_type: 'media',
      resource_id: id,
      metadata: {
        filename: file.originalname,
        old_size: oldSize,
        new_size: file.size,
        old_mime: oldMime,
        new_mime: file.mimetype,
      },
    });

    return await this.transformMedia(updated);
  }

  async bulkRemove(
    ids: string[],
    userId: string,
  ): Promise<{ deleted: string[]; failed: { id: string; error: string }[] }> {
    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        await this.remove(id);
        deleted.push(id);
      } catch (err) {
        failed.push({ id, error: err.message });
      }
    }

    await this.auditLog.log({
      event_type: 'media.bulk_deleted',
      user_id: userId,
      resource_type: 'media',
      metadata: { count: deleted.length, failed: failed.length },
    });

    return { deleted, failed };
  }

  async getUsage(id: string): Promise<{
    total_uses: number;
    articles: { id: string; title: string; slug: string }[];
    products: { id: string; title: string; slug: string }[];
    pages: { id: string; title: string; slug: string }[];
  }> {
    await this.findOne(id); // 404 if not found

    const [articleRows, productRows, pageRows] = await Promise.all([
      this.prisma.articleMedia.findMany({
        where: { media_id: id },
        include: { article: { select: { id: true, title: true, slug: true } } },
      }),
      this.prisma.productMedia.findMany({
        where: { media_id: id },
        include: { product: { select: { id: true, title: true, slug: true } } },
      }),
      this.prisma.pageMedia.findMany({
        where: { media_id: id },
        include: { page: { select: { id: true, title: true, slug: true } } },
      }),
    ]);

    const articles = articleRows.map((r) => r.article);
    const products = productRows.map((r) => r.product);
    const pages = pageRows.map((r) => r.page);

    return {
      total_uses: articles.length + products.length + pages.length,
      articles,
      products,
      pages,
    };
  }

  async findAll(query: QueryMediaDto) {
    const { page = 1, limit = 20, search, mime_type, in_use, sort = 'date' } = query as any;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { original_name: { contains: search, mode: 'insensitive' } },
        { alt_text: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (mime_type) {
      if (mime_type.endsWith('/*')) {
        where.mime_type = { startsWith: mime_type.replace('/*', '/') };
      } else {
        where.mime_type = mime_type;
      }
    }

    if (in_use === true || in_use === 'true') {
      where.OR = [
        ...(where.OR ?? []),
        { article_media: { some: {} } },
        { product_media: { some: {} } },
        { page_media: { some: {} } },
      ];
      // in_use=true: must have at least one join table row
      where.AND = [
        {
          OR: [
            { article_media: { some: {} } },
            { product_media: { some: {} } },
            { page_media: { some: {} } },
          ],
        },
      ];
      delete where.OR;
    } else if (in_use === false || in_use === 'false') {
      where.article_media = { none: {} };
      where.product_media = { none: {} };
      where.page_media = { none: {} };
    }

    const orderBy = sort === 'name'
      ? { original_name: 'asc' as const }
      : sort === 'size'
      ? { size: 'desc' as const }
      : { uploaded_at: 'desc' as const };

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where, skip, take: limit, orderBy,
        include: {
          uploader: { select: { id: true, email: true, first_name_enc: true, last_name_enc: true } },
          _count: { select: { article_media: true, product_media: true, page_media: true } },
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: await Promise.all(media.map(async (m) => ({
        ...await this.transformMedia(m),
        total_uses: m._count.article_media + m._count.product_media + m._count.page_media,
      }))),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, email: true, first_name_enc: true, last_name_enc: true } },
      },
    });
    if (!media) throw new NotFoundException('Media not found');
    return await this.transformMedia(media);
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

  private storagePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.basename(filePath);
    }
    return filePath;
  }

  private async mediaUrl(filePath: string): Promise<string> {
    return this.storageProvider.getUrl(this.storagePath(filePath));
  }

  async transformMedia(media: any) {
    return {
      ...media,
      url: await this.mediaUrl(media.file_path),
      thumbnail_url: media.thumbnail_path
        ? await this.storageProvider.getUrl(this.storagePath(media.thumbnail_path))
        : null,
    };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.+/g, '.')
      .substring(0, 200);
  }

  private inferMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  private async generateThumbnail(fileBuffer: Buffer, originalFilename: string): Promise<string | null> {
    const thumbFilename = `thumb-${originalFilename.replace(/\.[^.]+$/, '.jpg')}`;
    return this.generateThumbnailToPath(fileBuffer, thumbFilename);
  }

  private async generateThumbnailToPath(fileBuffer: Buffer, thumbFilename: string): Promise<string | null> {
    try {
      const thumbBuffer = await sharp(fileBuffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
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
