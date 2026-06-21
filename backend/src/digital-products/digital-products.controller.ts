import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { DigitalProductsService } from './digital-products.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import {
  CreateDigitalFileDto,
  UpdateDigitalFileDto,
  PersonalizationOptionsDto,
  TestPersonalizationDto,
  ExtendExpiryDto,
} from './dto/digital-product.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('digital-products')
export class DigitalProductsController {
  constructor(
    private readonly digitalProductsService: DigitalProductsService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  /**
   * List all digital files across all products — for the backstage Digital Storage panel
   */
  @Get('files/all')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('digital.deliver')
  async listAllFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.digitalProductsService.listAllFiles(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
    );
  }

  /**
   * Upload a digital file for a product (Admin only)
   */
  @Post('files')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Body() dto: CreateDigitalFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    return this.digitalProductsService.uploadDigitalFile(
      dto,
      file.buffer,
      file.originalname,
    );
  }

  /**
   * Get all digital files for a product
   */
  @Get('products/:productId/files')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  async getProductFiles(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.digitalProductsService.getProductFiles(productId);
  }

  /**
   * Get a specific digital file
   */
  @Get('files/:id')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  async getDigitalFile(@Param('id', ParseUUIDPipe) id: string) {
    return this.digitalProductsService.getDigitalFile(id);
  }

  /**
   * Update digital file settings
   */
  @Put('files/:id')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  async updateDigitalFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDigitalFileDto,
  ) {
    return this.digitalProductsService.updateDigitalFile(id, dto);
  }

  /**
   * Delete a digital file
   */
  @Delete('files/:id')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.delete')
  async deleteDigitalFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.digitalProductsService.deleteDigitalFile(id);
    return { message: 'Digital file deleted successfully' };
  }

  /**
   * Create download tokens for an order (Admin or system use)
   */
  @Post('orders/:orderId/downloads')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('digital.deliver')
  async createOrderDownloads(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('expiryDays') expiryDays?: string,
  ) {
    const days = expiryDays ? parseInt(expiryDays, 10) : 30;
    return this.digitalProductsService.createDownloadTokensForOrder(orderId, days);
  }

  /**
   * Get download tokens for an order — owner of the order or digital.deliver cap required
   */
  @Get('orders/:orderId/downloads')
  @UseGuards(JwtAuthGuard)
  async getOrderDownloads(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: any,
  ) {
    const canAdmin = await this.capabilitiesService.userHasCapability(user.id, 'digital.deliver');
    return this.digitalProductsService.getOrderDownloads(orderId, user.id, canAdmin);
  }

  /**
   * Get current user's downloads
   */
  @Get('my-downloads')
  @UseGuards(JwtAuthGuard)
  async getMyDownloads(@CurrentUser() user: any) {
    return this.digitalProductsService.getUserDownloads(user.id);
  }

  /**
   * Validate a download token (public endpoint)
   */
  @Get('validate/:token')
  async validateToken(@Param('token') token: string) {
    return this.digitalProductsService.validateToken(token);
  }

  /**
   * Download a file using token (public endpoint)
   */
  @Get('download/:token')
  async downloadFile(
    @Param('token') token: string,
    @Query('customerName') customerName: string | undefined,
    @Res() res: Response,
  ) {
    const personalizationOptions: PersonalizationOptionsDto = {};
    if (customerName) {
      personalizationOptions.customerName = customerName;
    }

    const { buffer, filename, contentType } =
      await this.digitalProductsService.downloadFile(token, personalizationOptions);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  /**
   * Regenerate a download token (digital.deliver required)
   */
  @Post('downloads/:id/regenerate')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('digital.deliver')
  async regenerateToken(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expiryDays') expiryDays?: string,
  ) {
    const days = expiryDays ? parseInt(expiryDays, 10) : 30;
    return this.digitalProductsService.regenerateToken(id, days);
  }

  /**
   * Extend a download token's expiry (digital.deliver required)
   */
  @Post('downloads/:id/extend')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('digital.deliver')
  async extendExpiry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendExpiryDto,
  ) {
    return this.digitalProductsService.extendExpiry(id, dto.days);
  }

  /**
   * Test personalization — generates a sample personalized file (Admin only)
   */
  @Post('files/test-personalization')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  async testPersonalization(
    @Body() dto: TestPersonalizationDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } =
      await this.digitalProductsService.testPersonalization(dto);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
