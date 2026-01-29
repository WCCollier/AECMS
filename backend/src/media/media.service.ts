import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Media } from '@prisma/client';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UpdateMediaDto, QueryMediaDto } from './dto';

@Injectable()
export class MediaService {
  private readonly uploadsDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
    ];
  }

  /**
   * Process and save uploaded file
   */
  async upload(
    file: Express.Multer.File,
    userId: string,
    altText?: string,
    caption?: string,
  ): Promise<Media> {
    // Validate file
    this.validateFile(file);

    try {
      // Ensure uploads directory exists
      await this.ensureUploadsDirExists();

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFilename(file.originalname);
      const filename = `${timestamp}-${sanitizedName}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Save original file
      await fs.writeFile(filepath, file.buffer);

      // Process image if it's an image type
      let thumbnailPath: string | null = null;
      const isImage = file.mimetype.startsWith('image/');

      if (isImage && file.mimetype !== 'image/svg+xml') {
        thumbnailPath = await this.generateThumbnail(filepath, filename);
      }

      // Get file metadata
      const metadata = isImage ? await this.getImageMetadata(filepath) : null;

      // Create database record
      const media = await this.prisma.media.create({
        data: {
          filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          file_path: filepath,
          thumbnail_path: thumbnailPath,
          alt_text: altText || null,
          caption: caption || null,
          uploaded_by: userId,
          width: metadata?.width,
          height: metadata?.height,
        },
      });

      return media;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message}`,
      );
    }
  }

  /**
   * Find all media with pagination and search
   */
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
        where,
        skip,
        take: limit,
        orderBy: { uploaded_at: 'desc' },
        include: {
          uploader: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: media,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one media by ID
   */
  async findOne(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  /**
   * Update media metadata
   */
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

  /**
   * Delete media file and database record
   */
  async remove(id: string): Promise<void> {
    const media = await this.findOne(id);

    try {
      // Delete files from filesystem
      await fs.unlink(media.file_path);
      if (media.thumbnail_path) {
        await fs.unlink(media.thumbnail_path).catch(() => {
          // Ignore if thumbnail doesn't exist
        });
      }

      // Delete database record
      await this.prisma.media.delete({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete media: ${error.message}`,
      );
    }
  }

  /**
   * Get file buffer for download
   */
  async getFileBuffer(id: string): Promise<{ buffer: Buffer; media: Media }> {
    const media = await this.findOne(id);

    try {
      const buffer = await fs.readFile(media.file_path);
      return { buffer, media };
    } catch (error) {
      throw new NotFoundException('Media file not found on disk');
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

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

  /**
   * Sanitize filename to prevent path traversal
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.+/g, '.')
      .substring(0, 200);
  }

  /**
   * Ensure uploads directory exists
   */
  private async ensureUploadsDirExists(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Generate thumbnail for image
   */
  private async generateThumbnail(
    filepath: string,
    filename: string,
  ): Promise<string | null> {
    try {
      const thumbnailFilename = `thumb-${filename}`;
      const thumbnailPath = path.join(this.uploadsDir, thumbnailFilename);

      await sharp(filepath)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      // If thumbnail generation fails, return null (not critical)
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * Get image metadata (dimensions)
   */
  private async getImageMetadata(
    filepath: string,
  ): Promise<{ width: number | undefined; height: number | undefined } | null> {
    try {
      const metadata = await sharp(filepath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      return null;
    }
  }
}
