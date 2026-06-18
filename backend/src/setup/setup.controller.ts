import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if first-run setup is required' })
  async getStatus(): Promise<{ required: boolean }> {
    const required = await this.setupService.isSetupRequired();
    return { required };
  }

  @Post('complete')
  @HttpCode(201)
  @ApiOperation({ summary: 'Complete first-run setup: create Owner account and set site identity' })
  async complete(@Body() dto: CompleteSetupDto): Promise<{ message: string }> {
    await this.setupService.completeSetup(dto);
    return { message: 'Setup complete. You can now log in to the backstage.' };
  }
}
