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
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeProvider.name);

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    const envKey = process.env.STRIPE_SECRET_KEY || this.configService.get<string>('STRIPE_SECRET_KEY');
    if (envKey) {
      this.logger.log('Stripe provider ready (env key present; ISM takes precedence at runtime)');
    } else {
      this.logger.warn('Stripe secret key not found in env — must be configured via Admin Settings');
    }
  }

  isAvailable(): boolean {
    // Optimistic: env var present, or assume ISM may have it. Actual availability
    // is confirmed when getStripe() succeeds on first real operation.
    return !!(process.env.STRIPE_SECRET_KEY || this.configService.get<string>('STRIPE_SECRET_KEY'));
  }

  private async getStripe(): Promise<Stripe> {
    const key = await this.settingsService.getEffective('payment.stripe_secret_key_enc');
    if (!key) throw new Error('Stripe secret key is not configured');
    return new Stripe(key);
  }

  private async getWebhookSecret(): Promise<string> {
    return this.settingsService.getEffective('payment.stripe_webhook_secret_enc');
  }

  private getFrontendUrl(): string {
    // In GitHub Codespaces, auto-detect the public URL from injected env vars.
    // Falls back to FRONTEND_URL for local Docker / production deployments.
    const codespaceName = process.env.CODESPACE_NAME;
    const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (codespaceName && codespaceDomain) {
      return `https://${codespaceName}-3000.${codespaceDomain}`;
    }
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentIntent> {
    const stripe = await this.getStripe();
    const frontendUrl = this.getFrontendUrl();
    // Use Stripe Checkout (hosted page). Apple Pay, Google Pay, and Amazon Pay
    // are automatically enabled by Stripe for eligible customers — no extra work needed.
    const session = await stripe.checkout.sessions.create({
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
      success_url: `${frontendUrl}/order-confirmation?order=${params.orderId}`,
      cancel_url: `${frontendUrl}/checkout/cancel?order=${params.orderId}`,
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
    const stripe = await this.getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    return this.mapStripeStatus(paymentIntent.status);
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    const stripe = await this.getStripe();
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentId,
    };

    if (amount) {
      refundParams.amount = amount;
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      id: refund.id,
      paymentId: paymentId,
      amount: refund.amount,
      status: refund.status === 'succeeded' ? 'succeeded' :
              refund.status === 'pending' ? 'pending' : 'failed',
    };
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent> {
    const stripe = await this.getStripe();
    const webhookSecret = await this.getWebhookSecret();
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return {
      id: event.id,
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
