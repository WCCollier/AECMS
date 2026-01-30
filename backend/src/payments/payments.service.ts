import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { AmazonPayProvider } from './providers/amazon-pay.provider';
import {
  CreatePaymentIntentDto,
  CapturePayPalPaymentDto,
  CaptureAmazonPayPaymentDto,
  RefundPaymentDto,
} from './dto';
import { PaymentProvider, WebhookEvent } from './providers/payment-provider.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private providers: Map<string, PaymentProvider>;
  private testMode: boolean;

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private configService: ConfigService,
    private stripeProvider: StripeProvider,
    private paypalProvider: PayPalProvider,
    private amazonPayProvider: AmazonPayProvider,
  ) {
    this.testMode = this.configService.get<string>('PAYMENT_TEST_MODE') === 'true';

    this.providers = new Map();
    this.providers.set('stripe', stripeProvider);
    this.providers.set('paypal', paypalProvider);
    this.providers.set('amazon_pay', amazonPayProvider);

    this.logAvailableProviders();
  }

  private logAvailableProviders() {
    const available = [];
    const unavailable = [];

    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        available.push(name);
      } else {
        unavailable.push(name);
      }
    }

    if (available.length > 0) {
      this.logger.log(`Available payment providers: ${available.join(', ')}`);
    }
    if (unavailable.length > 0) {
      this.logger.warn(`Unavailable payment providers (not configured): ${unavailable.join(', ')}`);
    }
    if (this.testMode) {
      this.logger.warn('Payment test mode enabled - payments will be simulated');
    }
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    const available: string[] = [];
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable() || this.testMode) {
        available.push(name);
      }
    }
    return available;
  }

  /**
   * Create payment intent for an order
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto, userId?: string) {
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.order_id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify ownership
    if (order.user_id && order.user_id !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Verify order is pending
    if (order.status !== 'pending') {
      throw new BadRequestException('Order is not in pending status');
    }

    // Check if already paid
    if (order.payment_intent_id) {
      throw new BadRequestException('Order already has a payment intent');
    }

    // Test mode - return mock response
    if (this.testMode) {
      const mockPaymentId = `test_${dto.provider}_${Date.now()}`;

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          payment_method: dto.provider,
          payment_intent_id: mockPaymentId,
        },
      });

      let clientSecret: string;
      switch (dto.provider) {
        case 'stripe':
          clientSecret = `test_secret_${mockPaymentId}`;
          break;
        case 'paypal':
          clientSecret = `https://sandbox.paypal.com/checkoutnow?token=${mockPaymentId}`;
          break;
        case 'amazon_pay':
          clientSecret = mockPaymentId; // Checkout session ID
          break;
        default:
          clientSecret = `test_secret_${mockPaymentId}`;
      }

      return {
        payment_id: mockPaymentId,
        client_secret: clientSecret,
        provider: dto.provider,
        status: 'requires_action',
        test_mode: true,
      };
    }

    // Get provider
    const provider = this.providers.get(dto.provider);
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException(`Payment provider ${dto.provider} is not available`);
    }

    // Create payment
    const totalInCents = Math.round(parseFloat(order.total.toString()) * 100);

    const payment = await provider.createPayment({
      amount: totalInCents,
      currency: 'USD',
      orderId: order.id,
      customerEmail: order.email,
      metadata: {
        order_number: order.order_number,
      },
    });

    // Update order with payment intent
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payment_method: dto.provider,
        payment_intent_id: payment.id,
      },
    });

    return {
      payment_id: payment.id,
      client_secret: payment.clientSecret,
      provider: dto.provider,
      status: payment.status,
    };
  }

  /**
   * Capture PayPal payment after user approval
   */
  async capturePayPalPayment(dto: CapturePayPalPaymentDto, userId?: string) {
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.order_id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify ownership
    if (order.user_id && order.user_id !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Test mode
    if (this.testMode) {
      await this.ordersService.markAsPaid(order.id, dto.paypal_order_id);
      return {
        success: true,
        order_id: order.id,
        payment_id: dto.paypal_order_id,
        test_mode: true,
      };
    }

    const provider = this.providers.get('paypal') as PayPalProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('PayPal is not available');
    }

    const capture = await provider.capturePayment(dto.paypal_order_id);

    if (capture.status === 'succeeded') {
      await this.ordersService.markAsPaid(order.id, dto.paypal_order_id);
    }

    return {
      success: capture.status === 'succeeded',
      order_id: order.id,
      payment_id: capture.id,
      status: capture.status,
    };
  }

  /**
   * Capture Amazon Pay payment after user approval
   */
  async captureAmazonPayPayment(dto: CaptureAmazonPayPaymentDto, userId?: string) {
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.order_id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify ownership
    if (order.user_id && order.user_id !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Test mode
    if (this.testMode) {
      await this.ordersService.markAsPaid(order.id, dto.checkout_session_id);
      return {
        success: true,
        order_id: order.id,
        payment_id: dto.checkout_session_id,
        test_mode: true,
      };
    }

    const provider = this.providers.get('amazon_pay') as AmazonPayProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('Amazon Pay is not available');
    }

    const capture = await provider.capturePayment(dto.checkout_session_id);

    if (capture.status === 'succeeded') {
      await this.ordersService.markAsPaid(order.id, capture.id);
    }

    return {
      success: capture.status === 'succeeded',
      order_id: order.id,
      payment_id: capture.id,
      status: capture.status,
    };
  }

  /**
   * Get Amazon Pay button configuration for frontend
   */
  getAmazonPayButtonConfig() {
    const provider = this.providers.get('amazon_pay') as AmazonPayProvider;
    if (!provider) {
      return null;
    }
    return provider.getButtonConfig();
  }

  /**
   * Process refund
   */
  async refund(orderId: string, dto: RefundPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment_intent_id) {
      throw new BadRequestException('Order has no payment to refund');
    }

    if (order.status === 'refunded') {
      throw new BadRequestException('Order is already refunded');
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot refund cancelled order');
    }

    // Test mode
    if (this.testMode) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'refunded' },
      });

      return {
        success: true,
        refund_id: `test_refund_${Date.now()}`,
        amount: dto.amount || Math.round(parseFloat(order.total.toString()) * 100),
        test_mode: true,
      };
    }

    const provider = this.providers.get(order.payment_method);
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException(`Payment provider ${order.payment_method} is not available`);
    }

    const refund = await provider.refund(order.payment_intent_id, dto.amount);

    if (refund.status === 'succeeded') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'refunded' },
      });
    }

    return {
      success: refund.status === 'succeeded',
      refund_id: refund.id,
      amount: refund.amount,
      status: refund.status,
    };
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(payload: string | Buffer, signature: string) {
    const provider = this.providers.get('stripe') as StripeProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const event = await provider.verifyWebhook(payload, signature);
    return this.processWebhookEvent(event);
  }

  /**
   * Handle PayPal webhook
   */
  async handlePayPalWebhook(payload: string | Buffer, signature: string) {
    const provider = this.providers.get('paypal') as PayPalProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('PayPal is not configured');
    }

    const event = await provider.verifyWebhook(payload, signature);
    return this.processWebhookEvent(event);
  }

  /**
   * Handle Amazon Pay webhook (IPN)
   */
  async handleAmazonPayWebhook(payload: string | Buffer, signature: string) {
    const provider = this.providers.get('amazon_pay') as AmazonPayProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('Amazon Pay is not configured');
    }

    const event = await provider.verifyWebhook(payload, signature);
    return this.processWebhookEvent(event);
  }

  /**
   * Process webhook event
   */
  private async processWebhookEvent(event: WebhookEvent) {
    this.logger.log(`Processing ${event.provider} webhook: ${event.type}`);

    switch (event.type) {
      // Stripe events
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event);
        break;

      // PayPal events
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePaymentSucceeded(event);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePaymentFailed(event);
        break;

      // Amazon Pay events
      case 'CHARGE.COMPLETED':
        await this.handlePaymentSucceeded(event);
        break;
      case 'CHARGE.DECLINED':
        await this.handlePaymentFailed(event);
        break;
      case 'REFUND.COMPLETED':
        this.logger.log('Amazon Pay refund completed');
        break;

      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(event: WebhookEvent) {
    let orderId: string;
    let paymentId: string;

    if (event.provider === 'stripe') {
      orderId = event.data.metadata?.order_id;
      paymentId = event.data.id;
    } else if (event.provider === 'amazon_pay') {
      // Amazon Pay - extract from merchant metadata
      const customInfo = event.data.merchantMetadata?.customInformation;
      const metadata = customInfo ? JSON.parse(customInfo) : {};
      orderId = event.data.merchantMetadata?.merchantReferenceId || metadata.order_id;
      paymentId = event.data.chargeId || event.data.id;
    } else {
      // PayPal
      orderId = event.data.custom_id || event.data.purchase_units?.[0]?.custom_id;
      paymentId = event.data.id;
    }

    if (!orderId) {
      this.logger.warn('Payment succeeded but no order ID found');
      return;
    }

    try {
      await this.ordersService.markAsPaid(orderId, paymentId);
      this.logger.log(`Order ${orderId} marked as paid`);
    } catch (error) {
      this.logger.error(`Failed to mark order ${orderId} as paid`, error);
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(event: WebhookEvent) {
    let orderId: string;

    if (event.provider === 'stripe') {
      orderId = event.data.metadata?.order_id;
    } else if (event.provider === 'amazon_pay') {
      const customInfo = event.data.merchantMetadata?.customInformation;
      const metadata = customInfo ? JSON.parse(customInfo) : {};
      orderId = event.data.merchantMetadata?.merchantReferenceId || metadata.order_id;
    } else {
      orderId = event.data.custom_id || event.data.purchase_units?.[0]?.custom_id;
    }

    if (!orderId) {
      this.logger.warn('Payment failed but no order ID found');
      return;
    }

    this.logger.warn(`Payment failed for order ${orderId}`);
    // Order remains in pending status - user can retry
  }

  /**
   * Simulate payment completion (test mode only)
   */
  async simulatePaymentCompletion(orderId: string) {
    if (!this.testMode) {
      throw new BadRequestException('This endpoint is only available in test mode');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.ordersService.markAsPaid(orderId, order.payment_intent_id || `test_${Date.now()}`);

    return {
      success: true,
      message: 'Payment simulated successfully',
      order_id: orderId,
    };
  }
}
