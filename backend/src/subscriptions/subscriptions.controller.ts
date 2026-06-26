import { Controller, Get, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { BroadcastDto } from './dto/broadcast.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  getPreferences(@CurrentUser() user: any) {
    return this.subscriptionsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.subscriptionsService.updatePreferences(user.id, dto);
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string, @Query('category') category: string) {
    return this.subscriptionsService.unsubscribeByToken(token, category);
  }

  @Get('counts')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('broadcast.send')
  getSubscriberCounts() {
    return this.subscriptionsService.getSubscriberCount();
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('broadcast.send')
  sendBroadcast(@Body() dto: BroadcastDto) {
    return this.subscriptionsService.sendBroadcast(dto.subject, dto.body);
  }
}
