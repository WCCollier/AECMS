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
