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
  @ApiOperation({ summary: 'Get current theme settings (palette, font pairing)' })
  async getTheme() {
    const raw = await this.settingsService.get('theme');
    if (!raw) return { palette: 'midnight', fontPairing: 'default' };
    try { return JSON.parse(raw); } catch { return { palette: 'midnight', fontPairing: 'default' }; }
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general site settings (title, tagline)' })
  async getGeneral() {
    const [site_title, tagline] = await Promise.all([
      this.settingsService.getEffective('general.site_title'),
      this.settingsService.getEffective('general.tagline'),
    ]);
    return { site_title, tagline };
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

  @Post('test-email')
  @ApiOperation({ summary: 'Send a test email using current SMTP config' })
  async testEmail(@Request() req: any) {
    const result = await this.testEmailService.send(req.user.email);
    return result;
  }
}
