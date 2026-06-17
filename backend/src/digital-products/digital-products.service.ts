import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from '../storage';
import { STORAGE_PROVIDER } from '../storage';
import { PersonalizationService } from './personalization.service';
import {
  CreateDigitalFileDto,
  UpdateDigitalFileDto,
  CreateDownloadTokenDto,
  DigitalFileResponseDto,
  DigitalDownloadResponseDto,
  PersonalizationOptionsDto,
  FileFormat,
  TestPersonalizationDto,
} from './dto/digital-product.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class DigitalProductsService {
  private readonly logger = new Logger(DigitalProductsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private storageProvider: StorageProvider,
    private personalizationService: PersonalizationService,
  ) {}

  /**
   * Upload a digital file for a product
   */
  async uploadDigitalFile(
    dto: CreateDigitalFileDto,
    fileBuffer: Buffer,
    originalFilename: string,
  ): Promise<DigitalFileResponseDto> {
    // Verify product exists and is digital
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.product_type !== 'digital') {
      throw new BadRequestException('Product must be a digital product');
    }

    // Check if file for this format already exists (upsert: replace if so)
    const existing = await this.prisma.digitalProductFile.findUnique({
      where: {
        product_id_format: {
          product_id: dto.productId,
          format: dto.format,
        },
      },
    });

    // Validate file format
    const extension = originalFilename.toLowerCase().split('.').pop();
    if (extension !== dto.format) {
      throw new BadRequestException(
        `File extension does not match format. Expected .${dto.format}`,
      );
    }

    // Store the file
    const storagePath = `digital-products/${dto.productId}/${dto.format}/${Date.now()}-${originalFilename}`;
    await this.storageProvider.upload(fileBuffer, storagePath, {
      contentType: this.getContentType(dto.format),
      metadata: {
        productId: dto.productId,
        format: dto.format,
        originalFilename,
      },
    });

    // Upsert database record — replace existing slot if present
    const digitalFile = existing
      ? await this.prisma.digitalProductFile.update({
          where: { id: existing.id },
          data: {
            file_id: storagePath,
            personalization_enabled: dto.personalizationEnabled ?? existing.personalization_enabled,
            max_downloads: dto.maxDownloads ?? existing.max_downloads,
            personalization_tested: false,
          },
        })
      : await this.prisma.digitalProductFile.create({
          data: {
            product_id: dto.productId,
            format: dto.format,
            file_id: storagePath,
            personalization_enabled: dto.personalizationEnabled ?? false,
            max_downloads: dto.maxDownloads ?? 5,
          },
        });

    this.logger.log(
      `Uploaded ${dto.format} file for product ${dto.productId}`,
    );

    return this.mapToFileResponse(digitalFile);
  }

  /**
   * Get all digital files for a product
   */
  async getProductFiles(productId: string): Promise<DigitalFileResponseDto[]> {
    const files = await this.prisma.digitalProductFile.findMany({
      where: { product_id: productId },
      orderBy: { format: 'asc' },
    });

    return files.map((f) => this.mapToFileResponse(f));
  }

  /**
   * Get a specific digital file
   */
  async getDigitalFile(id: string): Promise<DigitalFileResponseDto> {
    const file = await this.prisma.digitalProductFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('Digital file not found');
    }

    return this.mapToFileResponse(file);
  }

  /**
   * Update digital file settings
   */
  async updateDigitalFile(
    id: string,
    dto: UpdateDigitalFileDto,
  ): Promise<DigitalFileResponseDto> {
    const file = await this.prisma.digitalProductFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('Digital file not found');
    }

    const updated = await this.prisma.digitalProductFile.update({
      where: { id },
      data: {
        personalization_enabled: dto.personalizationEnabled,
        max_downloads: dto.maxDownloads,
      },
    });

    return this.mapToFileResponse(updated);
  }

  /**
   * Delete a digital file
   */
  async deleteDigitalFile(id: string): Promise<void> {
    const file = await this.prisma.digitalProductFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('Digital file not found');
    }

    // Delete from storage
    try {
      await this.storageProvider.delete(file.file_id);
    } catch (error) {
      this.logger.error(`Failed to delete file from storage: ${error}`);
    }

    // Delete database record
    await this.prisma.digitalProductFile.delete({
      where: { id },
    });

    this.logger.log(`Deleted digital file ${id}`);
  }

  /**
   * Create download tokens for an order
   * Called after successful payment
   */
  async createDownloadTokensForOrder(
    orderId: string,
    expiryDays: number = 30,
  ): Promise<DigitalDownloadResponseDto[]> {
    // Get order with items
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                digital_files: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const downloads: DigitalDownloadResponseDto[] = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create download tokens for each digital file in the order
    for (const item of order.items) {
      if (item.product.product_type !== 'digital') continue;

      for (const digitalFile of item.product.digital_files) {
        const token = this.generateDownloadToken();

        const download = await this.prisma.digitalDownload.create({
          data: {
            digital_file_id: digitalFile.id,
            order_id: orderId,
            user_id: order.user_id,
            download_token: token,
            max_downloads: digitalFile.max_downloads,
            expires_at: expiresAt,
          },
          include: {
            digital_file: {
              include: {
                product: true,
              },
            },
          },
        });

        downloads.push(this.mapToDownloadResponse(download));
      }
    }

    this.logger.log(
      `Created ${downloads.length} download tokens for order ${order.order_number}`,
    );

    return downloads;
  }

  /**
   * Get download tokens for a user
   */
  async getUserDownloads(userId: string): Promise<DigitalDownloadResponseDto[]> {
    const downloads = await this.prisma.digitalDownload.findMany({
      where: { user_id: userId },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return downloads.map((d) => this.mapToDownloadResponse(d));
  }

  /**
   * Get download tokens for an order
   */
  async getOrderDownloads(orderId: string): Promise<DigitalDownloadResponseDto[]> {
    const downloads = await this.prisma.digitalDownload.findMany({
      where: { order_id: orderId },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
      },
    });

    return downloads.map((d) => this.mapToDownloadResponse(d));
  }

  /**
   * Download a digital file using a token
   */
  async downloadFile(
    token: string,
    personalizationOptions?: PersonalizationOptionsDto,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const download = await this.prisma.digitalDownload.findUnique({
      where: { download_token: token },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
        order: true,
      },
    });

    if (!download) {
      throw new NotFoundException('Download token not found');
    }

    // Check expiry
    if (download.expires_at < new Date()) {
      throw new ForbiddenException('Download link has expired');
    }

    // Check download count
    if (download.download_count >= download.max_downloads) {
      throw new ForbiddenException('Maximum downloads reached');
    }

    // Get file from storage
    let fileBuffer = await this.storageProvider.download(
      download.digital_file.file_id,
    );

    // Apply personalization if enabled
    if (download.digital_file.personalization_enabled) {
      // Resolve customer name: explicit param → order.customer_name → user record → order email
      let resolvedName = personalizationOptions?.customerName;
      if (!resolvedName) {
        if ((download.order as any).customer_name) {
          resolvedName = (download.order as any).customer_name;
        } else if (download.user_id) {
          const user = await this.prisma.user.findUnique({ where: { id: download.user_id } });
          resolvedName = user
            ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
            : download.order.email;
        } else {
          resolvedName = download.order.email;
        }
      }

      const options: PersonalizationOptionsDto = {
        customerName: resolvedName || undefined,
        orderNumber: download.order.order_number,
        purchaseDate: download.order.created_at.toLocaleDateString(),
      };

      fileBuffer = await this.personalizationService.personalize(
        fileBuffer,
        download.digital_file.format as FileFormat,
        options,
      );
    }

    // Update download count
    await this.prisma.digitalDownload.update({
      where: { id: download.id },
      data: {
        download_count: download.download_count + 1,
        last_downloaded_at: new Date(),
      },
    });

    const filename = `${download.digital_file.product.name}.${download.digital_file.format}`;
    const contentType = this.getContentType(
      download.digital_file.format as FileFormat,
    );

    this.logger.log(
      `Download: ${filename} (token: ${token.substring(0, 8)}..., count: ${download.download_count + 1}/${download.max_downloads})`,
    );

    return { buffer: fileBuffer, filename, contentType };
  }

  /**
   * Validate a download token without downloading
   */
  async validateToken(token: string): Promise<DigitalDownloadResponseDto> {
    const download = await this.prisma.digitalDownload.findUnique({
      where: { download_token: token },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!download) {
      throw new NotFoundException('Download token not found');
    }

    if (download.expires_at < new Date()) {
      throw new ForbiddenException('Download link has expired');
    }

    if (download.download_count >= download.max_downloads) {
      throw new ForbiddenException('Maximum downloads reached');
    }

    return this.mapToDownloadResponse(download);
  }

  /**
   * Test personalization — generate a sample personalized file using dummy data.
   * Admin only — used to verify personalization before publishing.
   */
  async testPersonalization(
    dto: TestPersonalizationDto,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    let file: any;

    if (dto.fileId) {
      file = await this.prisma.digitalProductFile.findUnique({
        where: { id: dto.fileId },
        include: { product: true },
      });
    } else if (dto.productId && dto.format) {
      file = await this.prisma.digitalProductFile.findUnique({
        where: {
          product_id_format: {
            product_id: dto.productId,
            format: dto.format,
          },
        },
        include: { product: true },
      });
    }

    if (!file) {
      throw new NotFoundException('Digital file not found');
    }

    const fileBuffer = await this.storageProvider.download(file.file_id);
    const dummyOptions: PersonalizationOptionsDto = {
      customerName: 'Test Customer',
      orderNumber: 'TEST-00000',
      purchaseDate: new Date().toLocaleDateString(),
    };

    const personalizedBuffer = await this.personalizationService.personalize(
      fileBuffer,
      file.format as FileFormat,
      dummyOptions,
    );

    // Mark as tested
    await this.prisma.digitalProductFile.update({
      where: { id: file.id },
      data: { personalization_tested: true },
    });

    const productName = file.product?.name || 'document';
    const filename = `TEST-${productName}.${file.format}`;
    const contentType = this.getContentType(file.format as FileFormat);

    this.logger.log(`Test personalization generated for file ${file.id}`);

    return { buffer: personalizedBuffer, filename, contentType };
  }

  /**
   * Extend download token expiry by N days.
   * Admin only.
   */
  async extendExpiry(
    downloadId: string,
    days: number,
  ): Promise<DigitalDownloadResponseDto> {
    const download = await this.prisma.digitalDownload.findUnique({
      where: { id: downloadId },
      include: { digital_file: { include: { product: true } } },
    });

    if (!download) {
      throw new NotFoundException('Download not found');
    }

    const base = download.expires_at > new Date() ? download.expires_at : new Date();
    const newExpiresAt = new Date(base);
    newExpiresAt.setDate(newExpiresAt.getDate() + days);

    const updated = await this.prisma.digitalDownload.update({
      where: { id: downloadId },
      data: { expires_at: newExpiresAt },
      include: { digital_file: { include: { product: true } } },
    });

    this.logger.log(`Extended download ${downloadId} expiry by ${days} days`);

    return this.mapToDownloadResponse(updated);
  }

  /**
   * Regenerate download token (extend expiry, reset count)
   * Admin only
   */
  async regenerateToken(
    downloadId: string,
    expiryDays: number = 30,
  ): Promise<DigitalDownloadResponseDto> {
    const download = await this.prisma.digitalDownload.findUnique({
      where: { id: downloadId },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!download) {
      throw new NotFoundException('Download not found');
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + expiryDays);

    const updated = await this.prisma.digitalDownload.update({
      where: { id: downloadId },
      data: {
        download_token: this.generateDownloadToken(),
        download_count: 0,
        expires_at: newExpiresAt,
      },
      include: {
        digital_file: {
          include: {
            product: true,
          },
        },
      },
    });

    this.logger.log(`Regenerated download token for ${downloadId}`);

    return this.mapToDownloadResponse(updated);
  }

  private generateDownloadToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getContentType(format: FileFormat): string {
    switch (format) {
      case FileFormat.EPUB:
        return 'application/epub+zip';
      case FileFormat.PDF:
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  private mapToFileResponse(file: any): DigitalFileResponseDto {
    return {
      id: file.id,
      productId: file.product_id,
      format: file.format,
      fileId: file.file_id,
      personalizationEnabled: file.personalization_enabled,
      personalizationTested: file.personalization_tested ?? false,
      maxDownloads: file.max_downloads,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
    };
  }

  private mapToDownloadResponse(download: any): DigitalDownloadResponseDto {
    return {
      id: download.id,
      digitalFileId: download.digital_file_id,
      orderId: download.order_id,
      downloadToken: download.download_token,
      downloadCount: download.download_count,
      kindleSendCount: download.kindle_send_count ?? 0,
      maxDownloads: download.max_downloads,
      expiresAt: download.expires_at,
      createdAt: download.created_at,
      lastDownloadedAt: download.last_downloaded_at,
      format: download.digital_file?.format || 'unknown',
      productName: download.digital_file?.product?.name || 'Unknown Product',
    };
  }
}
