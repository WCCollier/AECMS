import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentIntent,
  PaymentCapture,
  RefundResult,
  PaymentStatus,
  CreatePaymentParams,
  WebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || null;

    if (secretKey) {
      this.stripe = new Stripe(secretKey);
      this.logger.log('Stripe provider initialized');
    } else {
      this.logger.warn('Stripe provider not configured - STRIPE_SECRET_KEY missing');
    }
  }

  isAvailable(): boolean {
    return this.stripe !== null;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Use Stripe Checkout (hosted page). Apple Pay, Google Pay, and Amazon Pay
    // are automatically enabled by Stripe for eligible customers — no extra work needed.
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: params.customerEmail,
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: `Order #${params.metadata?.order_number || params.orderId}`,
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: params.orderId,
        ...params.metadata,
      },
      success_url: `${this.configService.get('FRONTEND_URL')}/order-confirmation?order=${params.orderId}`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/checkout/cancel?order=${params.orderId}`,
    });

    return {
      id: session.id,
      clientSecret: session.url ?? undefined, // The Checkout page URL — redirect the browser here
      amount: params.amount,
      currency: params.currency,
      status: 'requires_action',
      metadata: { order_id: params.orderId },
    };
  }

  async capturePayment(_sessionId: string): Promise<PaymentCapture> {
    // Stripe Checkout auto-captures on completion — no manual capture step needed.
    // Payment confirmation arrives via the checkout.session.completed webhook.
    throw new Error('Manual capture not used with Stripe Checkout');
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
    return this.mapStripeStatus(paymentIntent.status);
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentId,
    };

    if (amount) {
      refundParams.amount = amount;
    }

    const refund = await this.stripe.refunds.create(refundParams);

    return {
      id: refund.id,
      paymentId: paymentId,
      amount: refund.amount,
      status: refund.status === 'succeeded' ? 'succeeded' :
              refund.status === 'pending' ? 'pending' : 'failed',
    };
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!this.webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );

    return {
      type: event.type,
      data: event.data.object,
      provider: 'stripe',
    };
  }

  /**
   * Map Stripe payment intent status to our status
   */
  private mapStripeStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
      requires_payment_method: 'requires_payment_method',
      requires_confirmation: 'requires_confirmation',
      requires_action: 'requires_action',
      processing: 'processing',
      requires_capture: 'processing',
      canceled: 'cancelled',
      succeeded: 'succeeded',
    };

    return statusMap[status] || 'failed';
  }
}
