import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { DigitalProductsService } from '../digital-products/digital-products.service';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';
import {
  CreatePaymentIntentDto,
  CapturePayPalPaymentDto,
  RefundPaymentDto,
} from './dto';
import { PaymentProvider, WebhookEvent } from './providers/payment-provider.interface';
import { AuditLogService } from '../audit/audit.service';
import { OrderEmailService } from './order-email.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private providers: Map<string, PaymentProvider>;

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private digitalProductsService: DigitalProductsService,
    private configService: ConfigService,
    private stripeProvider: StripeProvider,
    private paypalProvider: PayPalProvider,
    private auditLog: AuditLogService,
    private orderEmailService: OrderEmailService,
    private settingsService: SettingsService,
  ) {
    this.providers = new Map();
    this.providers.set('stripe', stripeProvider);
    this.providers.set('paypal', paypalProvider);

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
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    const available: string[] = [];
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
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

    // Get provider
    const provider = this.providers.get(dto.provider);
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException(`Payment provider ${dto.provider} is not available`);
    }

    // Create payment
    const totalInCents = Math.round(parseFloat(order.total.toString()) * 100);

    // Read tax settings from ISM (ship dark — only apply when tax.enabled = true)
    const taxEnabledRaw = await this.settingsService.getEffective('tax.enabled');
    const taxEnabled = taxEnabledRaw === 'true';
    const defaultTaxCode = taxEnabled
      ? (await this.settingsService.getEffective('tax.default_stripe_tax_code') || undefined)
      : undefined;

    const payment = await provider.createPayment({
      amount: totalInCents,
      currency: 'USD',
      orderId: order.id,
      customerEmail: order.email,
      metadata: {
        order_number: order.order_number,
      },
      taxEnabled,
      // Stripe uses Stripe Tax codes; PayPal reuses defaultTaxCode to carry the flat rate %
      defaultTaxCode: dto.provider === 'stripe'
        ? defaultTaxCode
        : taxEnabled ? (await this.settingsService.getEffective('tax.flat_rate') || undefined) : undefined,
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

    // Idempotency: if already captured (e.g. React StrictMode double-fire), return success
    if (order.status === 'processing' && order.payment_intent_id) {
      return {
        success: true,
        order_id: order.id,
        payment_id: order.payment_intent_id,
        status: 'succeeded',
      };
    }

    const provider = this.providers.get('paypal') as PayPalProvider;
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException('PayPal is not available');
    }

    const capture = await provider.capturePayment(dto.paypal_order_id);

    if (capture.status === 'succeeded') {
      await this.ordersService.markAsPaid(order.id, dto.paypal_order_id);
      try {
        await this.digitalProductsService.createDownloadTokensForOrder(order.id);
      } catch (dlErr) {
        this.logger.error(`Failed to create download tokens for order ${order.id}`, dlErr);
      }
      this.orderEmailService.sendOrderConfirmation(order.id).catch((e) =>
        this.logger.error(`Failed to send order confirmation email for ${order.id}`, e),
      );
    }

    return {
      success: capture.status === 'succeeded',
      order_id: order.id,
      payment_id: capture.id,
      status: capture.status,
    };
  }

  /**
   * Complete a zero-total order without payment
   */
  async completeFreeOrder(orderId: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Ownership check — guest orders (no user_id) can be completed by anyone with the order ID
    if (order.user_id && order.user_id !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Verify total is actually zero
    const total = parseFloat(order.total.toString());
    if (total > 0) {
      throw new BadRequestException('Order total is not zero — use a payment provider');
    }

    // Idempotency: already completed
    if (order.status === 'processing' || order.status === 'completed') {
      return { order_id: order.id, order_number: order.order_number };
    }

    if (order.status !== 'pending') {
      throw new ConflictException(`Order cannot be completed in status: ${order.status}`);
    }

    // Free digital products require an authenticated user
    const hasDigital = order.items.some((item) => item.product.product_type === 'digital');
    if (hasDigital && !userId) {
      throw new UnauthorizedException('Log in to claim free digital products');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'processing',
        payment_method: 'free',
        paid_at: new Date(),
      },
    });

    this.logger.log(`Free order ${order.order_number} completed`);

    try {
      await this.digitalProductsService.createDownloadTokensForOrder(orderId);
    } catch (dlErr) {
      this.logger.error(`Failed to create download tokens for free order ${orderId}`, dlErr);
    }
    this.orderEmailService.sendOrderConfirmation(orderId).catch((e) =>
      this.logger.error(`Failed to send confirmation email for free order ${orderId}`, e),
    );

    return { order_id: order.id, order_number: order.order_number };
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

    const provider = this.providers.get(order.payment_method);
    if (!provider || !provider.isAvailable()) {
      throw new BadRequestException(`Payment provider ${order.payment_method} is not available`);
    }

    const refund = await provider.refund(order.payment_intent_id, dto.amount);

    if (refund.status === 'succeeded') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'refunded',
          refunded_at: new Date(),
          refund_id: refund.id ?? null,
          refund_amount: dto.amount != null ? dto.amount / 100 : null,
        },
      });
    }

    await this.auditLog.log({
      event_type: 'order.refund_initiated',
      resource_type: 'order',
      resource_id: orderId,
      metadata: { amount: refund.amount, gateway_refund_id: refund.id, status: refund.status },
    });

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
   * Process webhook event
   */
  private async processWebhookEvent(event: WebhookEvent) {
    this.logger.log(`Processing ${event.provider} webhook: ${event.type}`);

    // Persist webhook event for audit trail (idempotent on duplicate event_id)
    const eventId = event.id ?? `${event.provider}:${event.type}:${Date.now()}`;
    let webhookRow: { id: string } | null = null;
    try {
      const existing = await this.prisma.webhookEvent.findUnique({ where: { event_id: eventId } });
      if (existing) {
        this.logger.log(`Duplicate webhook event ${eventId} — skipping`);
        return { received: true };
      }
      webhookRow = await this.prisma.webhookEvent.create({
        data: { gateway: event.provider, event_id: eventId, event_type: event.type, payload: event.data },
        select: { id: true },
      });
    } catch (err) {
      this.logger.warn('Failed to persist webhook event', err);
    }

    let processingError: string | undefined;
    try {
      switch (event.type) {
        // Stripe Checkout events (checkout.session.completed = payment captured)
        case 'checkout.session.completed':
          await this.handlePaymentSucceeded(event);
          break;
        case 'checkout.session.expired':
          await this.handlePaymentFailed(event);
          break;

        // PayPal events
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentSucceeded(event);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentFailed(event);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${event.type}`);
      }
    } catch (err: any) {
      processingError = err?.message ?? 'Unknown error';
      this.logger.error(`Failed processing webhook ${eventId}`, err);
    }

    // Update processed_at on the webhook row
    if (webhookRow) {
      try {
        await this.prisma.webhookEvent.update({
          where: { id: webhookRow.id },
          data: { processed_at: new Date(), processing_error: processingError ?? null },
        });
      } catch (err) {
        this.logger.warn('Failed to update webhook processed_at', err);
      }
    }

    return { received: true };
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(event: WebhookEvent) {
    let orderId: string;
    let paymentId: string;

    let taxAmountCents: number | undefined;
    let taxDetails: any;

    if (event.provider === 'stripe') {
      orderId = event.data.metadata?.order_id;
      paymentId = event.data.id;
      // Extract Stripe Tax collected amount (only present when automatic_tax was enabled)
      const totalDetails = event.data.total_details;
      if (totalDetails?.amount_tax != null && totalDetails.amount_tax > 0) {
        taxAmountCents = totalDetails.amount_tax;
        taxDetails = totalDetails;
      }
    } else {
      // PayPal
      orderId = event.data.custom_id || event.data.purchase_units?.[0]?.custom_id;
      paymentId = event.data.id;
      // Extract PayPal flat-rate tax from breakdown if present
      const taxTotalValue = event.data.purchase_units?.[0]?.amount?.breakdown?.tax_total?.value;
      if (taxTotalValue && parseFloat(taxTotalValue) > 0) {
        taxAmountCents = Math.round(parseFloat(taxTotalValue) * 100);
        taxDetails = { tax_total: taxTotalValue };
      }
    }

    if (!orderId) {
      this.logger.warn('Payment succeeded but no order ID found');
      return;
    }

    try {
      await this.ordersService.markAsPaid(orderId, paymentId, taxAmountCents, taxDetails);
      this.logger.log(`Order ${orderId} marked as paid`);
      // Create download tokens for any digital items in the order (idempotent)
      try {
        await this.digitalProductsService.createDownloadTokensForOrder(orderId);
      } catch (dlErr) {
        this.logger.error(`Failed to create download tokens for order ${orderId}`, dlErr);
      }
      // Send order confirmation email (failure must never block the webhook response)
      this.orderEmailService.sendOrderConfirmation(orderId).catch((e) =>
        this.logger.error(`Failed to send order confirmation email for ${orderId}`, e),
      );
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
    } else {
      // PayPal
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
   * Reconcile stale pending PayPal orders.
   *
   * Runs automatically every night at 02:00 and can be triggered manually
   * via POST /payments/paypal/reconcile.
   *
   * Finds pending PayPal orders whose redirect window has long passed (>1h old),
   * queries PayPal for the current status of each, and:
   *   APPROVED   → attempts capture; marks paid on success (zombie recovery)
   *   COMPLETED  → marks paid without another capture (already captured elsewhere)
   *   VOIDED/CREATED → leaves pending; logs for manual review
   */
  @Cron('0 2 * * *', { name: 'paypal-reconcile', timeZone: 'America/Chicago' })
  async reconcilePayPalOrders(): Promise<{ checked: number; recovered: number; errors: number }> {
    this.logger.log('[paypal-reconcile] Starting reconciliation run');

    const provider = this.providers.get('paypal') as PayPalProvider;
    if (!provider?.isAvailable()) {
      this.logger.warn('[paypal-reconcile] PayPal not configured — skipping');
      return { checked: 0, recovered: 0, errors: 0 };
    }

    // Orders that are pending, paid via PayPal, have a payment_intent_id,
    // and were created more than 1 hour ago (well past any redirect window).
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: 'pending',
        payment_method: 'paypal',
        payment_intent_id: { not: null },
        created_at: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: { id: true, payment_intent_id: true, order_number: true },
    });

    this.logger.log(`[paypal-reconcile] Found ${staleOrders.length} stale pending PayPal order(s)`);

    let recovered = 0;
    let errors = 0;

    for (const order of staleOrders) {
      const paypalId = order.payment_intent_id!;
      try {
        const { rawStatus } = await provider.getOrderRawStatus(paypalId);
        this.logger.log(`[paypal-reconcile] ${order.order_number}: PayPal status = ${rawStatus}`);

        if (rawStatus === 'APPROVED') {
          // User approved on PayPal but never completed the redirect — attempt capture now.
          const capture = await provider.capturePayment(paypalId);
          if (capture.status === 'succeeded') {
            await this.ordersService.markAsPaid(order.id, capture.id);
            try { await this.digitalProductsService.createDownloadTokensForOrder(order.id); } catch (_) {}
            await this.auditLog.log({
              event_type: 'order.status_changed',
              resource_type: 'order',
              resource_id: order.id,
              changes: { before: { status: 'pending' }, after: { status: 'processing' } },
              metadata: { reconciled: true, paypal_order_id: paypalId },
            });
            this.logger.log(`[paypal-reconcile] ${order.order_number}: recovered (captured ${capture.id})`);
            recovered++;
          }
        } else if (rawStatus === 'COMPLETED') {
          // Already captured (maybe by a late webhook) — sync our side.
          await this.ordersService.markAsPaid(order.id, paypalId);
          try { await this.digitalProductsService.createDownloadTokensForOrder(order.id); } catch (_) {}
          await this.auditLog.log({
            event_type: 'order.status_changed',
            resource_type: 'order',
            resource_id: order.id,
            changes: { before: { status: 'pending' }, after: { status: 'processing' } },
            metadata: { reconciled: true, reason: 'already_completed_at_paypal' },
          });
          recovered++;
        } else {
          // VOIDED, CREATED, PAYER_ACTION_REQUIRED — log for manual review; leave in pending.
          await this.auditLog.log({
            event_type: 'order.status_changed',
            resource_type: 'order',
            resource_id: order.id,
            metadata: { reconcile_skipped: true, paypal_status: rawStatus },
          });
        }
      } catch (err: any) {
        this.logger.error(`[paypal-reconcile] ${order.order_number}: error — ${err?.message}`);
        errors++;
      }
    }

    this.logger.log(`[paypal-reconcile] Done — checked ${staleOrders.length}, recovered ${recovered}, errors ${errors}`);
    return { checked: staleOrders.length, recovered, errors };
  }

  async verifyStripe(): Promise<{ success: boolean; message: string }> {
    try {
      await this.stripeProvider.verifyConnection();
      return { success: true, message: 'Stripe connection verified' };
    } catch (err: any) {
      const msg = err?.message ?? 'Stripe verification failed';
      return { success: false, message: msg };
    }
  }

  async verifyPayPal(): Promise<{ success: boolean; message: string }> {
    try {
      await (this.paypalProvider as any).getAccessToken();
      return { success: true, message: 'PayPal connection verified' };
    } catch (err: any) {
      const msg = err?.message ?? 'PayPal verification failed';
      return { success: false, message: msg };
    }
  }
}
