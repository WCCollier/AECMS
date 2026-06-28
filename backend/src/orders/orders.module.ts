import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, CartModule, CapabilitiesModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
