import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';

// NOTE: Amazon Pay is NOT a separate provider here. Amazon Pay is natively
// available as a payment method inside Stripe Checkout — no additional backend
// integration is required. Stripe surfaces it automatically when the customer's
// browser/country supports it.

@Module({
  imports: [PrismaModule, OrdersModule, CapabilitiesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeProvider, PayPalProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
