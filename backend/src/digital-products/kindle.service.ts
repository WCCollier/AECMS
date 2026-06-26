import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from '../storage';
import { STORAGE_PROVIDER } from '../storage';
import type { EmailProvider } from '../email';
import { EMAIL_PROVIDER, isKindleEmail } from '../email';
import { SettingsService } from '../settings/settings.service';
import { PersonalizationService } from './personalization.service';
import {
  CreateKindleDeviceDto,
  UpdateKindleDeviceDto,
  SendToKindleDto,
  KindleDeviceResponseDto,
  SendToKindleResultDto,
} from './dto/kindle.dto';
import { FileFormat, PersonalizationOptionsDto } from './dto/digital-product.dto';

/**
 * Kindle Service
 *
 * Manages Kindle devices and Send to Kindle functionality.
 *
 * Features:
 * - Add/manage Kindle device emails
 * - Send purchased EPUB files to Kindle
 * - Personalize files before sending
 *
 * Note: Kindle supports EPUB, PDF, and other formats.
 * EPUB is recommended for best reading experience.
 */
@Injectable()
export class KindleService {
  private readonly logger = new Logger(KindleService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private storageProvider: StorageProvider,
    @Inject(EMAIL_PROVIDER)
    private emailProvider: EmailProvider,
    private personalizationService: PersonalizationService,
    private settingsService: SettingsService,
  ) {}

  // ============================================================================
  // KINDLE DEVICE MANAGEMENT
  // ============================================================================

  /**
   * Add a Kindle device for a user
   */
  async addDevice(
    userId: string,
    dto: CreateKindleDeviceDto,
  ): Promise<KindleDeviceResponseDto> {
    // Validate Kindle email format
    if (!isKindleEmail(dto.kindleEmail)) {
      throw new BadRequestException('Invalid Kindle email address');
    }

    // If this should be default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.kindleDevice.updateMany({
        where: { user_id: userId },
        data: { is_default: false },
      });
    }

    // Check for duplicate email
    const existing = await this.prisma.kindleDevice.findFirst({
      where: {
        user_id: userId,
        kindle_email: dto.kindleEmail.toLowerCase(),
      },
    });

    if (existing) {
      throw new BadRequestException('This Kindle email is already registered');
    }

    // Get count to determine if this is the first device
    const count = await this.prisma.kindleDevice.count({
      where: { user_id: userId },
    });

    const device = await this.prisma.kindleDevice.create({
      data: {
        user_id: userId,
        friendly_name: dto.friendlyName,
        kindle_email: dto.kindleEmail.toLowerCase(),
        is_default: dto.isDefault ?? count === 0, // First device is default
      },
    });

    this.logger.log(`Kindle device added for user ${userId}: ${dto.friendlyName}`);

    return this.mapToDeviceResponse(device);
  }

  /**
   * Get all Kindle devices for a user
   */
  async getUserDevices(userId: string): Promise<KindleDeviceResponseDto[]> {
    const devices = await this.prisma.kindleDevice.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return devices.map((d) => this.mapToDeviceResponse(d));
  }

  /**
   * Get a specific Kindle device
   */
  async getDevice(
    deviceId: string,
    userId: string,
  ): Promise<KindleDeviceResponseDto> {
    const device = await this.prisma.kindleDevice.findFirst({
      where: { id: deviceId, user_id: userId },
    });

    if (!device) {
      throw new NotFoundException('Kindle device not found');
    }

    return this.mapToDeviceResponse(device);
  }

  /**
   * Update a Kindle device
   */
  async updateDevice(
    deviceId: string,
    userId: string,
    dto: UpdateKindleDeviceDto,
  ): Promise<KindleDeviceResponseDto> {
    const device = await this.prisma.kindleDevice.findFirst({
      where: { id: deviceId, user_id: userId },
    });

    if (!device) {
      throw new NotFoundException('Kindle device not found');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.kindleDevice.updateMany({
        where: { user_id: userId, id: { not: deviceId } },
        data: { is_default: false },
      });
    }

    const updated = await this.prisma.kindleDevice.update({
      where: { id: deviceId },
      data: {
        friendly_name: dto.friendlyName,
        is_default: dto.isDefault,
      },
    });

    return this.mapToDeviceResponse(updated);
  }

  /**
   * Delete a Kindle device
   */
  async deleteDevice(deviceId: string, userId: string): Promise<void> {
    const device = await this.prisma.kindleDevice.findFirst({
      where: { id: deviceId, user_id: userId },
    });

    if (!device) {
      throw new NotFoundException('Kindle device not found');
    }

    await this.prisma.kindleDevice.delete({
      where: { id: deviceId },
    });

    // If this was the default, make another one default
    if (device.is_default) {
      const nextDevice = await this.prisma.kindleDevice.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      });

      if (nextDevice) {
        await this.prisma.kindleDevice.update({
          where: { id: nextDevice.id },
          data: { is_default: true },
        });
      }
    }

    this.logger.log(`Kindle device deleted: ${device.friendly_name}`);
  }

  /**
   * Get user's default Kindle device
   */
  async getDefaultDevice(userId: string): Promise<KindleDeviceResponseDto | null> {
    const device = await this.prisma.kindleDevice.findFirst({
      where: { user_id: userId, is_default: true },
    });

    return device ? this.mapToDeviceResponse(device) : null;
  }

  // ============================================================================
  // SEND TO KINDLE
  // ============================================================================

  /**
   * Send a purchased digital file to Kindle
   */
  async sendToKindle(
    userId: string,
    dto: SendToKindleDto,
  ): Promise<SendToKindleResultDto> {
    // Get the download record
    const download = await this.prisma.digitalDownload.findUnique({
      where: { id: dto.downloadId },
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
      throw new NotFoundException('Download not found');
    }

    // Verify ownership
    if (download.user_id !== userId) {
      throw new ForbiddenException('You do not own this download');
    }

    // Check if download is still valid
    if (download.expires_at < new Date()) {
      throw new ForbiddenException('Download has expired');
    }

    if (download.download_count >= download.max_downloads) {
      throw new ForbiddenException('Maximum downloads reached');
    }

    // Determine Kindle email
    let kindleEmail: string;

    if (dto.kindleEmail) {
      // Use provided email
      if (!isKindleEmail(dto.kindleEmail)) {
        throw new BadRequestException('Invalid Kindle email address');
      }
      kindleEmail = dto.kindleEmail.toLowerCase();
    } else if (dto.kindleDeviceId) {
      // Use device email
      const device = await this.prisma.kindleDevice.findFirst({
        where: { id: dto.kindleDeviceId, user_id: userId },
      });
      if (!device) {
        throw new NotFoundException('Kindle device not found');
      }
      kindleEmail = device.kindle_email;
    } else {
      // Use default device
      const defaultDevice = await this.prisma.kindleDevice.findFirst({
        where: { user_id: userId, is_default: true },
      });
      if (!defaultDevice) {
        throw new BadRequestException(
          'No Kindle device specified and no default device configured',
        );
      }
      kindleEmail = defaultDevice.kindle_email;
    }

    // Check format - Kindle supports EPUB and PDF
    const format = download.digital_file.format as FileFormat;
    if (format !== FileFormat.EPUB && format !== FileFormat.PDF) {
      throw new BadRequestException(
        `Format ${format} is not supported for Send to Kindle`,
      );
    }

    // Get the file
    let fileBuffer = await this.storageProvider.download(
      download.digital_file.file_id,
    );

    // Personalize if enabled
    if (download.digital_file.personalization_enabled) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const options: PersonalizationOptionsDto = {
        customerName: user
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
          : undefined,
        orderNumber: download.order.order_number,
        purchaseDate: download.order.created_at.toLocaleDateString(),
      };

      fileBuffer = await this.personalizationService.personalize(
        fileBuffer,
        format,
        options,
      );
    }

    // Get content type
    const contentType =
      format === FileFormat.EPUB ? 'application/epub+zip' : 'application/pdf';

    // Send email with attachment
    // from must be the address the customer has whitelisted in their Amazon account
    const kindleFrom = await this.settingsService.getEffective('email.kindle_from');
    const filename = `${download.digital_file.product.title}.${format}`;

    const emailResult = await this.emailProvider.sendWithAttachment({
      to: kindleEmail,
      from: kindleFrom || undefined,
      subject: download.digital_file.product.title,
      text: `Your purchased book: ${download.digital_file.product.title}`,
      attachments: [
        {
          filename,
          content: fileBuffer,
          contentType,
        },
      ],
    });

    if (!emailResult.success) {
      this.logger.error(`Failed to send to Kindle: ${emailResult.error}`);
      return {
        success: false,
        message: `Failed to send: ${emailResult.error}`,
        kindleEmail,
        productName: download.digital_file.product.title,
        format,
      };
    }

    // Increment download count + kindle_send_count (Kindle send counts as a download)
    await this.prisma.digitalDownload.update({
      where: { id: dto.downloadId },
      data: {
        download_count: download.download_count + 1,
        kindle_send_count: (download.kindle_send_count ?? 0) + 1,
        last_downloaded_at: new Date(),
      },
    });

    // Update last used on device if applicable
    if (dto.kindleDeviceId) {
      await this.prisma.kindleDevice.update({
        where: { id: dto.kindleDeviceId },
        data: { last_used_at: new Date() },
      });
    }

    this.logger.log(
      `Sent ${filename} to Kindle: ${kindleEmail} (user: ${userId})`,
    );

    return {
      success: true,
      message: `Successfully sent ${download.digital_file.product.title} to ${kindleEmail}`,
      kindleEmail,
      productName: download.digital_file.product.title,
      format,
    };
  }

  private mapToDeviceResponse(device: any): KindleDeviceResponseDto {
    return {
      id: device.id,
      userId: device.user_id,
      friendlyName: device.friendly_name,
      kindleEmail: device.kindle_email,
      isDefault: device.is_default,
      lastUsedAt: device.last_used_at,
      createdAt: device.created_at,
      updatedAt: device.updated_at,
    };
  }
}
