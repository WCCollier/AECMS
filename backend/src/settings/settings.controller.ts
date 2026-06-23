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
  @ApiOperation({ summary: 'Get current theme settings (palette, font pairing, custom palettes)' })
  async getTheme() {
    const [themeRaw, customRaw] = await Promise.all([
      this.settingsService.get('theme'),
      this.settingsService.get('appearance.custom_palettes'),
    ]);
    const theme = themeRaw ? (() => { try { return JSON.parse(themeRaw); } catch { return {}; } })() : {};
    const customPalettes = customRaw ? (() => { try { return JSON.parse(customRaw); } catch { return []; } })() : [];
    return {
      palette: theme.palette ?? 'midnight',
      fontPairing: theme.fontPairing ?? 'default',
      customPalettes,
    };
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

  @Get('seo')
  @ApiOperation({ summary: 'Get public SEO settings (site name, author, canonical domain)' })
  async getSeoPublic() {
    const keys = [
      'seo.site_name', 'seo.site_description', 'seo.og_default_image',
      'seo.author_name', 'seo.author_url', 'seo.author_twitter',
      'seo.author_same_as', 'seo.canonical_domain',
      'seo.google_verification', 'seo.robots_additional',
    ];
    const values = await Promise.all(keys.map((k) => this.settingsService.getEffective(k)));
    return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? '']));
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private testEmailService: TestEmailService,
  ) {}

  // Any one of the four configure.* caps grants read access to all settings.
  // Note: when caps are delegated (Phase 21+), this endpoint should filter
  // returned keys to the caller's granted namespaces.
  @Get()
  @RequiresCapability(
    'system.configure.general',
    'system.configure.email',
    'system.configure.payments',
    'system.configure.storage',
  )
  @ApiOperation({ summary: 'Get all site settings (encrypted fields redacted)' })
  async getAll() {
    return this.settingsService.getAll();
  }

  // ── General + Identity ─────────────────────────────────────────────────────

  @Patch('general')
  @RequiresCapability('system.configure.general')
  @ApiOperation({ summary: 'Update general and site identity settings' })
  async updateGeneral(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('general.') || k.startsWith('identity.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Settings saved' };
  }

  @Post('favicon')
  @RequiresCapability('system.configure.general')
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

  // ── Email / SMTP ───────────────────────────────────────────────────────────

  @Patch('email')
  @RequiresCapability('system.configure.email')
  @ApiOperation({ summary: 'Update email / SMTP settings' })
  async updateEmail(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('email.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Settings saved' };
  }

  @Post('test-email')
  @RequiresCapability('system.configure.email')
  @ApiOperation({ summary: 'Send a test email using current SMTP config' })
  async testEmail(@Request() req: any) {
    return this.testEmailService.send(req.user.email);
  }

  @Post('test-email-preview')
  @RequiresCapability('system.configure.email')
  @ApiOperation({ summary: 'Send a test email using config values from the request body (not saved config)' })
  async testEmailPreview(@Body() body: Record<string, string>, @Request() req: any) {
    return this.testEmailService.sendWithConfig(req.user.email, body);
  }

  // ── Payment Providers ──────────────────────────────────────────────────────

  @Patch('payments')
  @RequiresCapability('system.configure.payments')
  @ApiOperation({ summary: 'Update payment provider settings' })
  async updatePayments(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('payment.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Settings saved' };
  }

  // ── File Storage ───────────────────────────────────────────────────────────

  @Patch('storage')
  @RequiresCapability('system.configure.storage')
  @ApiOperation({ summary: 'Update file storage provider settings' })
  async updateStorage(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('storage.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Settings saved' };
  }

  // ── SEO ────────────────────────────────────────────────────────────────────

  @Patch('seo')
  @RequiresCapability('system.configure.general')
  @ApiOperation({ summary: 'Update SEO settings' })
  async updateSeo(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('seo.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'SEO settings saved' };
  }

  // ── Appearance (separate capability — delegatable to Admin) ────────────────

  @Patch('appearance')
  @RequiresCapability('system.appearance')
  @ApiOperation({ summary: 'Update appearance settings (theme, customPalettes) — requires system.appearance' })
  async updateAppearance(@Body() dto: UpdateSettingsDto & { customPalettes?: unknown[] }, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates ?? {}).filter(([k]) => k === 'theme'),
    );
    if (dto.customPalettes !== undefined) {
      allowed['appearance.custom_palettes'] = JSON.stringify(dto.customPalettes);
    }
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Appearance saved' };
  }
}
