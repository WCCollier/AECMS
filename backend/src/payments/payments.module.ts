import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';

@Module({
  imports: [PrismaModule, OrdersModule, CapabilitiesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeProvider, PayPalProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
