import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TestEmailService } from './test-email.service';

// Public read-only settings endpoint (no auth) — used by root layout for theme injection
@ApiTags('settings-public')
@Controller('settings-public')
export class PublicSettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('theme')
  @ApiOperation({ summary: 'Get current theme settings (palette, font pairing)' })
  async getTheme() {
    const raw = await this.settingsService.get('theme');
    if (!raw) return { palette: 'midnight', fontPairing: 'default' };
    try { return JSON.parse(raw); } catch { return { palette: 'midnight', fontPairing: 'default' }; }
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general site settings (title, tagline, homepage mode)' })
  async getGeneral() {
    const [site_title, tagline, homepage_mode, homepage_page_id] = await Promise.all([
      this.settingsService.getEffective('general.site_title'),
      this.settingsService.getEffective('general.tagline'),
      this.settingsService.getEffective('general.homepage_mode'),
      this.settingsService.getEffective('general.homepage_page_id'),
    ]);
    return { site_title, tagline, homepage_mode, homepage_page_id };
  }

  @Get('identity')
  @ApiOperation({ summary: 'Get site identity settings (favicon, logo, brand color)' })
  async getIdentity() {
    const [favicon_url, logo_url, brand_color] = await Promise.all([
      this.settingsService.getEffective('identity.favicon_url'),
      this.settingsService.getEffective('identity.logo_url'),
      this.settingsService.getEffective('identity.brand_color'),
    ]);
    return { favicon_url, logo_url, brand_color };
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('system.configure')
@Controller('settings')
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private testEmailService: TestEmailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all site settings (encrypted fields redacted)' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update site settings' })
  async update(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    await this.settingsService.set(dto.updates, req.user.id);
    return { message: 'Settings saved' };
  }

  @Patch('appearance')
  @RequiresCapability('system.appearance')
  @ApiOperation({ summary: 'Update appearance settings (theme key only) — requires system.appearance' })
  async updateAppearance(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k === 'theme'),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Appearance saved' };
  }

  @Post('favicon')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload site favicon (ICO, PNG, JPG, or SVG)' })
  async uploadFavicon(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const allowed = [
      'image/x-icon', 'image/vnd.microsoft.icon',
      'image/png', 'image/jpeg', 'image/svg+xml', 'image/gif',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Favicon must be an image file (ICO, PNG, JPG, or SVG)');
    }
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `system-favicon-${Date.now()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, filename), file.buffer);
    const url = `/uploads/${filename}`;
    await this.settingsService.set({ 'identity.favicon_url': url }, req.user.id);
    return { url };
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Send a test email using current SMTP config' })
  async testEmail(@Request() req: any) {
    const result = await this.testEmailService.send(req.user.email);
    return result;
  }
}
