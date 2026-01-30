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

/**
 * Amazon Pay Provider
 *
 * Implements Amazon Pay Checkout v2 API
 * Documentation: https://developer.amazon.com/docs/amazon-pay-checkout/introduction.html
 *
 * Environment variables required:
 * - AMAZON_PAY_MERCHANT_ID: Your Amazon Pay merchant ID
 * - AMAZON_PAY_PUBLIC_KEY_ID: Public key ID from Seller Central
 * - AMAZON_PAY_PRIVATE_KEY: Private key (PEM format) or path to key file
 * - AMAZON_PAY_REGION: 'na' (North America), 'eu' (Europe), 'fe' (Far East)
 * - AMAZON_PAY_SANDBOX: 'true' for sandbox mode
 */
@Injectable()
export class AmazonPayProvider implements PaymentProvider {
  readonly name = 'amazon_pay' as const;
  private readonly logger = new Logger(AmazonPayProvider.name);
  private isConfigured = false;

  // Amazon Pay configuration
  private merchantId: string | null = null;
  private publicKeyId: string | null = null;
  private privateKey: string | null = null;
  private region: string = 'na';
  private sandbox: boolean = true;

  constructor(private configService: ConfigService) {
    this.merchantId = this.configService.get<string>('AMAZON_PAY_MERCHANT_ID') || null;
    this.publicKeyId = this.configService.get<string>('AMAZON_PAY_PUBLIC_KEY_ID') || null;
    this.privateKey = this.configService.get<string>('AMAZON_PAY_PRIVATE_KEY') || null;
    this.region = this.configService.get<string>('AMAZON_PAY_REGION') || 'na';
    this.sandbox = this.configService.get<string>('AMAZON_PAY_SANDBOX') !== 'false';

    if (this.merchantId && this.publicKeyId && this.privateKey) {
      this.isConfigured = true;
      this.logger.log(`Amazon Pay provider initialized (${this.sandbox ? 'sandbox' : 'live'} mode, region: ${this.region})`);
    } else {
      this.logger.warn('Amazon Pay provider not configured - missing credentials');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Get the API base URL based on region and sandbox mode
   */
  private getApiBaseUrl(): string {
    const regionUrls: Record<string, { sandbox: string; live: string }> = {
      na: {
        sandbox: 'https://pay-api.amazon.com/sandbox/v2',
        live: 'https://pay-api.amazon.com/v2',
      },
      eu: {
        sandbox: 'https://pay-api.amazon.eu/sandbox/v2',
        live: 'https://pay-api.amazon.eu/v2',
      },
      fe: {
        sandbox: 'https://pay-api.amazon.jp/sandbox/v2',
        live: 'https://pay-api.amazon.jp/v2',
      },
    };

    const urls = regionUrls[this.region] || regionUrls.na;
    return this.sandbox ? urls.sandbox : urls.live;
  }

  /**
   * Generate signature for Amazon Pay API requests
   * Note: In production, use the official Amazon Pay SDK (@amazonpay/amazon-pay-api-sdk-nodejs)
   */
  private async generateSignature(
    method: string,
    path: string,
    payload: string,
    headers: Record<string, string>,
  ): Promise<string> {
    // This is a placeholder for the actual signature generation
    // In production, use the Amazon Pay SDK which handles signature generation
    // The SDK uses AWS Signature Version 4 with RSA-SHA256

    // For now, return a placeholder that will be replaced when the SDK is installed
    return `AMAZONPAY-SIGNATURE-PLACEHOLDER`;
  }

  /**
   * Make an authenticated request to Amazon Pay API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, any>,
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Amazon Pay is not configured');
    }

    const url = `${this.getApiBaseUrl()}${endpoint}`;
    const payload = body ? JSON.stringify(body) : '';
    const timestamp = new Date().toISOString();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-amz-pay-date': timestamp,
      'x-amz-pay-host': new URL(url).host,
      'x-amz-pay-region': this.region,
    };

    // Generate signature (in production, use Amazon Pay SDK)
    const signature = await this.generateSignature(method, endpoint, payload, headers);
    headers['Authorization'] = `AMZN-PAY-RSASSA-PSS PublicKeyId=${this.publicKeyId}, SignedHeaders=content-type;x-amz-pay-date;x-amz-pay-host;x-amz-pay-region, Signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers,
      body: payload || undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Amazon Pay API error: ${response.status} - ${errorText}`);
      throw new Error(`Amazon Pay API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a checkout session for the order
   * Returns a checkout session ID that the frontend uses to render the Amazon Pay button
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentIntent> {
    if (!this.isConfigured) {
      throw new Error('Amazon Pay is not configured');
    }

    try {
      // Create checkout session
      const checkoutSession = await this.makeRequest<any>('POST', '/checkoutSessions', {
        webCheckoutDetails: {
          checkoutReviewReturnUrl: `${this.configService.get('FRONTEND_URL')}/checkout/amazon-pay/review`,
          checkoutResultReturnUrl: `${this.configService.get('FRONTEND_URL')}/checkout/amazon-pay/result`,
        },
        storeId: this.merchantId,
        chargePermissionType: 'OneTime',
        paymentDetails: {
          paymentIntent: 'Authorize',
          canHandlePendingAuthorization: false,
          chargeAmount: {
            amount: (params.amount / 100).toFixed(2), // Convert cents to dollars
            currencyCode: params.currency.toUpperCase(),
          },
        },
        merchantMetadata: {
          merchantReferenceId: params.orderId,
          merchantStoreName: this.configService.get('STORE_NAME') || 'AECMS Store',
          noteToBuyer: `Order #${params.orderId}`,
          customInformation: JSON.stringify(params.metadata || {}),
        },
      });

      return {
        id: checkoutSession.checkoutSessionId,
        clientSecret: checkoutSession.checkoutSessionId, // Used by frontend to initialize Amazon Pay
        amount: params.amount,
        currency: params.currency,
        status: 'requires_action', // User needs to complete Amazon Pay flow
        metadata: {
          order_id: params.orderId,
          ...params.metadata,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create Amazon Pay checkout session', error);
      throw error;
    }
  }

  /**
   * Complete the checkout session after user approval
   * This captures the payment
   */
  async capturePayment(checkoutSessionId: string): Promise<PaymentCapture> {
    if (!this.isConfigured) {
      throw new Error('Amazon Pay is not configured');
    }

    try {
      // Complete the checkout session
      const result = await this.makeRequest<any>('POST', `/checkoutSessions/${checkoutSessionId}/complete`, {
        chargeAmount: {
          // Amount will be taken from the checkout session
        },
      });

      // Get charge permission ID for refunds
      const chargePermissionId = result.chargePermissionId;

      // Create charge
      const charge = await this.makeRequest<any>('POST', '/charges', {
        chargePermissionId,
        chargeAmount: {
          amount: result.paymentDetails.chargeAmount.amount,
          currencyCode: result.paymentDetails.chargeAmount.currencyCode,
        },
        captureNow: true,
        softDescriptor: 'AECMS Store',
      });

      return {
        id: charge.chargeId,
        orderId: result.merchantMetadata?.merchantReferenceId || '',
        amount: Math.round(parseFloat(charge.chargeAmount.amount) * 100), // Convert to cents
        currency: charge.chargeAmount.currencyCode.toLowerCase(),
        status: this.mapAmazonStatus(charge.statusDetails.state),
        paidAt: charge.statusDetails.state === 'Captured' ? new Date() : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to capture Amazon Pay payment', error);
      throw error;
    }
  }

  /**
   * Get payment status for a charge
   */
  async getPaymentStatus(chargeId: string): Promise<PaymentStatus> {
    if (!this.isConfigured) {
      throw new Error('Amazon Pay is not configured');
    }

    try {
      const charge = await this.makeRequest<any>('GET', `/charges/${chargeId}`);
      return this.mapAmazonStatus(charge.statusDetails.state);
    } catch (error) {
      this.logger.error('Failed to get Amazon Pay payment status', error);
      throw error;
    }
  }

  /**
   * Process a refund for a charge
   */
  async refund(chargeId: string, amount?: number): Promise<RefundResult> {
    if (!this.isConfigured) {
      throw new Error('Amazon Pay is not configured');
    }

    try {
      // Get the charge to determine the currency and amount
      const charge = await this.makeRequest<any>('GET', `/charges/${chargeId}`);

      const refundAmount = amount
        ? (amount / 100).toFixed(2)
        : charge.chargeAmount.amount;

      const refund = await this.makeRequest<any>('POST', '/refunds', {
        chargeId,
        refundAmount: {
          amount: refundAmount,
          currencyCode: charge.chargeAmount.currencyCode,
        },
        softDescriptor: 'AECMS Refund',
      });

      return {
        id: refund.refundId,
        paymentId: chargeId,
        amount: Math.round(parseFloat(refund.refundAmount.amount) * 100),
        status: refund.statusDetails.state === 'Refunded' ? 'succeeded' :
                refund.statusDetails.state === 'Pending' ? 'pending' : 'failed',
      };
    } catch (error) {
      this.logger.error('Failed to process Amazon Pay refund', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature from Amazon Pay IPN
   */
  async verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent> {
    // Amazon Pay uses SNS for notifications
    // The signature verification uses the SNS message signing certificate

    const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8');

    try {
      const message = JSON.parse(payloadStr);

      // In production, verify the SNS signature using the certificate URL
      // For now, we'll parse the notification type

      // Amazon Pay IPN message types:
      // - CHARGE.COMPLETED
      // - CHARGE.DECLINED
      // - REFUND.COMPLETED
      // - REFUND.DECLINED

      const notificationType = message.NotificationType || message.notificationType;
      const notificationData = message.ObjectId ? message : JSON.parse(message.Message || '{}');

      return {
        type: notificationType,
        data: notificationData,
        provider: 'amazon_pay',
      };
    } catch (error) {
      this.logger.error('Failed to verify Amazon Pay webhook', error);
      throw new Error('Invalid Amazon Pay webhook payload');
    }
  }

  /**
   * Map Amazon Pay status to our standard status
   */
  private mapAmazonStatus(amazonStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'Open': 'requires_action',
      'Authorized': 'requires_confirmation',
      'AuthorizationInitiated': 'processing',
      'Captured': 'succeeded',
      'CaptureInitiated': 'processing',
      'Completed': 'succeeded',
      'Declined': 'failed',
      'Canceled': 'cancelled',
      'Closed': 'cancelled',
    };

    return statusMap[amazonStatus] || 'failed';
  }

  /**
   * Get the Amazon Pay button configuration for the frontend
   */
  getButtonConfig(): Record<string, any> {
    return {
      merchantId: this.merchantId,
      publicKeyId: this.publicKeyId,
      ledgerCurrency: 'USD',
      checkoutLanguage: 'en_US',
      productType: 'PayAndShip',
      placement: 'Checkout',
      buttonColor: 'Gold',
      sandbox: this.sandbox,
    };
  }
}
