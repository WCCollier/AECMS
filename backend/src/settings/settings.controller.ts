import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

  @Get('fonts')
  @ApiOperation({ summary: 'Get custom font library entries (curated fonts are client-side constants)' })
  async getFonts() {
    const raw = await this.settingsService.get('appearance.fonts');
    if (!raw) return { customFonts: [] };
    try { return { customFonts: JSON.parse(raw) }; } catch { return { customFonts: [] }; }
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

  @Get('captcha')
  @ApiOperation({ summary: 'Get CAPTCHA config (site key only — secret never exposed)' })
  async getCaptcha() {
    const turnstile_site_key = await this.settingsService.getEffective('security.turnstile_site_key');
    return { turnstile_site_key: turnstile_site_key || null };
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

  // Any one of the configure.* or shop.configure or broadcast.config caps grants read access to all settings.
  @Get()
  @RequiresCapability(
    'system.configure.general',
    'system.configure.email',
    'system.configure.payments',
    'system.configure.storage',
    'shop.configure',
    'broadcast.config',
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
      Object.entries(dto.updates).filter(([k]) => k.startsWith('general.') || k.startsWith('identity.') || k.startsWith('security.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Settings saved' };
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

  // ── Shop Config (business identity, shipping origin) ──────────────────────

  @Get('shop')
  @RequiresCapability('shop.configure')
  @ApiOperation({ summary: 'Get shop configuration settings (business identity, shipping origin)' })
  async getShop() {
    const keys = [
      'shop.legal_name', 'shop.ein_enc', 'shop.tax_registration_number',
      'shop.address_street', 'shop.address_city', 'shop.address_state',
      'shop.address_postal_code', 'shop.address_country',
      'shop.shipping_same_as_business',
      'shop.shipping_street', 'shop.shipping_city', 'shop.shipping_state',
      'shop.shipping_postal_code', 'shop.shipping_country',
    ];
    const values = await Promise.all(keys.map((k) => this.settingsService.getEffective(k)));
    return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? '']));
  }

  @Patch('shop')
  @RequiresCapability('shop.configure')
  @ApiOperation({ summary: 'Update shop configuration settings' })
  async updateShop(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('shop.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Shop settings saved' };
  }

  // ── Notifications (subscription defaults — broadcast.config) ──────────────

  @Patch('notifications')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('broadcast.config')
  @ApiOperation({ summary: 'Update default subscription preferences for new sign-ups' })
  async updateNotifications(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    const allowed = Object.fromEntries(
      Object.entries(dto.updates).filter(([k]) => k.startsWith('subscription.')),
    );
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Notification settings saved' };
  }

  // ── Appearance (separate capability — delegatable to Admin) ────────────────

  @Patch('appearance')
  @RequiresCapability('system.appearance')
  @ApiOperation({ summary: 'Update appearance settings (theme, fonts, customPalettes) — requires system.appearance' })
  async updateAppearance(@Body() dto: UpdateSettingsDto & { customPalettes?: unknown[] }, @Request() req: any) {
    const ALLOWED_KEYS = new Set(['theme', 'appearance.fonts']);
    const allowed = Object.fromEntries(
      Object.entries(dto.updates ?? {}).filter(([k]) => ALLOWED_KEYS.has(k)),
    );
    if (dto.customPalettes !== undefined) {
      allowed['appearance.custom_palettes'] = JSON.stringify(dto.customPalettes);
    }
    await this.settingsService.set(allowed, req.user.id);
    return { message: 'Appearance saved' };
  }
}
