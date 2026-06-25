import {
  Body,
  Controller,
  Get,
  Logger,
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
import { MulConverterService } from './mul-converter.service';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';

@ApiTags('mul-converter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('mul.convert')
@Controller('mul')
export class MulConverterController {
  private readonly logger = new Logger(MulConverterController.name);
  constructor(private readonly mulService: MulConverterService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get Mul Converter AI provider settings (keys redacted)' })
  async getSettings() {
    return this.mulService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Save Mul Converter AI provider settings' })
  async saveSettings(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    await this.mulService.saveSettings(dto.updates, req.user.id);
    return { message: 'Settings saved' };
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a URL and return palette + page scaffold' })
  async analyze(@Body() body: { url: string; generateImages?: boolean }, @Request() req: any) {
    this.logger.log(`analyze called: url=${body?.url} generateImages=${body?.generateImages} userId=${req.user?.id}`);
    if (!body.url) {
      throw new Error('url is required');
    }
    try {
      const result = await this.mulService.analyze(body.url, req.user.id, body.generateImages ?? true);
      this.logger.log('analyze completed successfully');
      return result;
    } catch (err) {
      this.logger.error(`analyze error: ${err.message}`, err.stack);
      throw err;
    }
  }
}
