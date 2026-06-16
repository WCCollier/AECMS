import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentIntent,
  PaymentCapture,
  RefundResult,
  PaymentStatus,
  CreatePaymentParams,
  WebhookEvent,
} from './payment-provider.interface';

interface PayPalAccessToken {
  access_token: string;
  expires_at: number;
}

@Injectable()
export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal' as const;
  private readonly logger = new Logger(PayPalProvider.name);
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private baseUrl: string;
  private accessToken: PayPalAccessToken | null = null;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID') || null;
    this.clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET') || null;
    const mode = this.configService.get<string>('PAYPAL_MODE') || 'sandbox';

    this.baseUrl = mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    if (this.clientId && this.clientSecret) {
      this.logger.log(`PayPal provider initialized (${mode} mode)`);
    } else {
      this.logger.warn('PayPal provider not configured - credentials missing');
    }
  }

  private getFrontendUrl(): string {
    const codespaceName = process.env.CODESPACE_NAME;
    const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (codespaceName && codespaceDomain) {
      return `https://${codespaceName}-3000.${codespaceDomain}`;
    }
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  isAvailable(): boolean {
    return this.clientId !== null && this.clientSecret !== null;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentIntent> {
    if (!this.isAvailable()) {
      throw new Error('PayPal is not configured');
    }

    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': params.orderId, // Idempotency key
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.orderId,
            amount: {
              currency_code: params.currency.toUpperCase(),
              value: (params.amount / 100).toFixed(2), // Convert cents to dollars
            },
            custom_id: params.orderId,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'AECMS Store',
              locale: 'en-US',
              user_action: 'PAY_NOW',
              // order param carries the AECMS order ID back to our success/cancel pages
              return_url: `${this.getFrontendUrl()}/checkout/success?order=${params.orderId}`,
              cancel_url: `${this.getFrontendUrl()}/checkout/cancel?order=${params.orderId}`,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.logger.error('PayPal create order failed', error);
      throw new Error(`PayPal error: ${error.message || 'Unknown error'}`);
    }

    const order = await response.json();

    // Find approval URL for redirect
    const approvalLink = order.links?.find((link: any) => link.rel === 'payer-action');

    return {
      id: order.id,
      clientSecret: approvalLink?.href, // URL to redirect user to PayPal
      amount: params.amount,
      currency: params.currency,
      status: this.mapPayPalStatus(order.status),
      metadata: { order_id: params.orderId },
    };
  }

  async capturePayment(paymentId: string): Promise<PaymentCapture> {
    if (!this.isAvailable()) {
      throw new Error('PayPal is not configured');
    }

    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      this.logger.error('PayPal capture failed', error);

      // PayPal sandbox sometimes returns INTERNAL_SERVICE_ERROR even when the
      // payment was already captured (e.g. duplicate capture from React StrictMode
      // double-firing useEffect). Fall back to fetching the order status and treat
      // COMPLETED as success rather than surfacing a misleading error.
      try {
        const { rawStatus, captureId } = await this.getOrderRawStatus(paymentId);
        if (rawStatus === 'COMPLETED' && captureId) {
          this.logger.warn(`PayPal capture endpoint errored but order ${paymentId} is COMPLETED — treating as success`);
          return {
            id: captureId,
            orderId: '',
            amount: 0,
            currency: 'USD',
            status: 'succeeded',
            paidAt: new Date(),
          };
        }
      } catch (statusErr) {
        this.logger.error('Failed to fetch PayPal order status after capture error', statusErr);
      }

      throw new Error(`PayPal capture error: ${error.message || 'Unknown error'}`);
    }

    const capture = await response.json();
    const purchaseUnit = capture.purchase_units?.[0];
    const captureDetails = purchaseUnit?.payments?.captures?.[0];

    return {
      id: captureDetails?.id || capture.id,
      orderId: purchaseUnit?.custom_id || purchaseUnit?.reference_id || '',
      amount: Math.round(parseFloat(captureDetails?.amount?.value || '0') * 100),
      currency: captureDetails?.amount?.currency_code || 'USD',
      status: this.mapPayPalStatus(capture.status),
      paidAt: capture.status === 'COMPLETED' ? new Date() : undefined,
    };
  }

  async getOrderRawStatus(paypalOrderId: string): Promise<{ rawStatus: string; captureId?: string }> {
    if (!this.isAvailable()) throw new Error('PayPal is not configured');
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`PayPal order fetch failed: ${response.status}`);
    const order = await response.json();
    const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined;
    return { rawStatus: order.status as string, captureId };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!this.isAvailable()) {
      throw new Error('PayPal is not configured');
    }

    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to get PayPal order status');
    }

    const order = await response.json();
    return this.mapPayPalStatus(order.status);
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    if (!this.isAvailable()) {
      throw new Error('PayPal is not configured');
    }

    const accessToken = await this.getAccessToken();

    // First, get the capture ID from the order
    const orderResponse = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    );

    const order = await orderResponse.json();
    const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    if (!captureId) {
      throw new Error('No capture found for this payment');
    }

    // Now process the refund
    const refundBody: any = {};
    if (amount) {
      refundBody.amount = {
        value: (amount / 100).toFixed(2),
        currency_code: order.purchase_units?.[0]?.amount?.currency_code || 'USD',
      };
    }

    const response = await fetch(
      `${this.baseUrl}/v2/payments/captures/${captureId}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(refundBody),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      this.logger.error('PayPal refund failed', error);
      throw new Error(`PayPal refund error: ${error.message || 'Unknown error'}`);
    }

    const refund = await response.json();

    return {
      id: refund.id,
      paymentId: paymentId,
      amount: Math.round(parseFloat(refund.amount?.value || '0') * 100),
      status: refund.status === 'COMPLETED' ? 'succeeded' :
              refund.status === 'PENDING' ? 'pending' : 'failed',
    };
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent> {
    // PayPal webhook verification is more complex and requires
    // the webhook ID from the dashboard
    // For now, we'll parse the event and trust it (in production, implement full verification)

    const event = JSON.parse(payload.toString());

    this.logger.warn('PayPal webhook verification not fully implemented - trusting event');

    return {
      id: event.id,
      type: event.event_type,
      data: event.resource,
      provider: 'paypal',
    };
  }

  /**
   * Get or refresh access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.accessToken.expires_at) {
      return this.accessToken.access_token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const data = await response.json();

    this.accessToken = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in - 60) * 1000, // Expire 1 minute early
    };

    return this.accessToken.access_token;
  }

  /**
   * Map PayPal status to our status
   */
  private mapPayPalStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      CREATED: 'requires_action',
      SAVED: 'requires_action',
      APPROVED: 'requires_confirmation',
      VOIDED: 'cancelled',
      COMPLETED: 'succeeded',
      PAYER_ACTION_REQUIRED: 'requires_action',
    };

    return statusMap[status] || 'failed';
  }
}
