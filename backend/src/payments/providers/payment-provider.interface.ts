/**
 * Payment Provider Interface
 * Abstract interface for payment providers (Stripe, PayPal, etc.)
 */

export interface PaymentIntent {
  id: string;
  clientSecret?: string; // For frontend SDK
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata?: Record<string, string>;
}

export interface PaymentCapture {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
}

export interface RefundResult {
  id: string;
  paymentId: string;
  amount: number;
  status: 'succeeded' | 'pending' | 'failed';
}

export type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface CreatePaymentParams {
  amount: number; // In cents
  currency: string;
  orderId: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  type: string;
  data: any;
  provider: 'stripe' | 'paypal';
}

export interface PaymentProvider {
  /**
   * Provider name
   */
  readonly name: 'stripe' | 'paypal' | 'amazon_pay';

  /**
   * Check if provider is configured and available
   */
  isAvailable(): boolean;

  /**
   * Create a payment intent/order
   */
  createPayment(params: CreatePaymentParams): Promise<PaymentIntent>;

  /**
   * Capture a payment (for PayPal two-step flow)
   */
  capturePayment(paymentId: string): Promise<PaymentCapture>;

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;

  /**
   * Process refund
   */
  refund(paymentId: string, amount?: number): Promise<RefundResult>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent>;
}
