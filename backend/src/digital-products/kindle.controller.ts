import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KindleService } from './kindle.service';
import {
  CreateKindleDeviceDto,
  UpdateKindleDeviceDto,
  SendToKindleDto,
} from './dto/kindle.dto';

@Controller('kindle')
@UseGuards(JwtAuthGuard)
export class KindleController {
  constructor(private readonly kindleService: KindleService) {}

  /**
   * Get all Kindle devices for current user
   */
  @Get('devices')
  async getDevices(@CurrentUser() user: any) {
    return this.kindleService.getUserDevices(user.id);
  }

  /**
   * Get current user's default Kindle device
   */
  @Get('devices/default')
  async getDefaultDevice(@CurrentUser() user: any) {
    return this.kindleService.getDefaultDevice(user.id);
  }

  /**
   * Get a specific Kindle device
   */
  @Get('devices/:id')
  async getDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.kindleService.getDevice(id, user.id);
  }

  /**
   * Add a new Kindle device
   */
  @Post('devices')
  async addDevice(
    @Body() dto: CreateKindleDeviceDto,
    @CurrentUser() user: any,
  ) {
    return this.kindleService.addDevice(user.id, dto);
  }

  /**
   * Update a Kindle device
   */
  @Put('devices/:id')
  async updateDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKindleDeviceDto,
    @CurrentUser() user: any,
  ) {
    return this.kindleService.updateDevice(id, user.id, dto);
  }

  /**
   * Delete a Kindle device
   */
  @Delete('devices/:id')
  async deleteDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    await this.kindleService.deleteDevice(id, user.id);
    return { message: 'Kindle device deleted successfully' };
  }

  /**
   * Send a purchased file to Kindle
   */
  @Post('send')
  async sendToKindle(
    @Body() dto: SendToKindleDto,
    @CurrentUser() user: any,
  ) {
    return this.kindleService.sendToKindle(user.id, dto);
  }
}
