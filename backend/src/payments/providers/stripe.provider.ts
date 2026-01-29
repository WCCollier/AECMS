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

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount, // Amount in cents
      currency: params.currency.toLowerCase(),
      metadata: {
        order_id: params.orderId,
        ...params.metadata,
      },
      receipt_email: params.customerEmail,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: this.mapStripeStatus(paymentIntent.status),
      metadata: paymentIntent.metadata as Record<string, string>,
    };
  }

  async capturePayment(paymentId: string): Promise<PaymentCapture> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // For Stripe, capture is usually automatic with PaymentIntents
    // This is mainly for manual capture scenarios
    const paymentIntent = await this.stripe.paymentIntents.capture(paymentId);

    return {
      id: paymentIntent.id,
      orderId: paymentIntent.metadata?.order_id || '',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: this.mapStripeStatus(paymentIntent.status),
      paidAt: paymentIntent.status === 'succeeded' ? new Date() : undefined,
    };
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
