import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailModule } from '../email/email.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, SettingsModule, EmailModule, CapabilitiesModule, ConfigModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
