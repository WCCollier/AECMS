import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdateFulfillmentDto, QueryOrdersDto } from './dto';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private auditLog: AuditLogService,
    private capabilitiesService: CapabilitiesService,
  ) {}

  /**
   * Create order from cart
   */
  async createFromCart(
    dto: CreateOrderDto,
    userId?: string,
    sessionId?: string,
    userEmail?: string,
  ) {
    // Get cart
    const cart = await this.cartService.getCart(userId, sessionId);

    if (!cart.id || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Determine product types in the cart
    const hasPhysical = cart.items.some((item: any) => item.product.product_type === 'physical');
    const hasDigital = cart.items.some((item: any) => item.product.product_type === 'digital');
    const hasService = cart.items.some((item: any) => item.product.product_type === 'service');

    // Enforce purchase capabilities
    if (!userId) {
      // Guest checkout
      if (!await this.capabilitiesService.guestHasCapability('checkout.guest')) {
        throw new ForbiddenException('Guest checkout is not enabled on this site');
      }
      if (hasPhysical && !await this.capabilitiesService.guestHasCapability('purchase.physical')) {
        throw new ForbiddenException('An account is required to purchase physical products');
      }
      if (hasDigital && !await this.capabilitiesService.guestHasCapability('purchase.digital')) {
        throw new ForbiddenException('An account is required to purchase digital products');
      }
      if (hasService && !await this.capabilitiesService.guestHasCapability('purchase.service')) {
        throw new ForbiddenException('An account is required to purchase service products');
      }
    } else {
      if (hasPhysical && !await this.capabilitiesService.userHasCapability(userId, 'purchase.physical')) {
        throw new ForbiddenException('You do not have permission to purchase physical products');
      }
      if (hasDigital && !await this.capabilitiesService.userHasCapability(userId, 'purchase.digital')) {
        throw new ForbiddenException('You do not have permission to purchase digital products');
      }
      if (hasService && !await this.capabilitiesService.userHasCapability(userId, 'purchase.service')) {
        throw new ForbiddenException('You do not have permission to purchase service products');
      }
    }

    if (hasPhysical && !dto.shipping_address) {
      throw new BadRequestException(
        'Shipping address required for physical products',
      );
    }

    // Validate stock availability
    for (const item of cart.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.product_id },
      });

      if (!product || product.deleted_at) {
        throw new BadRequestException(`Product ${item.product.title} is no longer available`);
      }

      // When 'digital' is added to product_type, change to: product_type === 'physical'
      // See docs/Shape_Audit.md Item 5.
      if (
        product.product_type !== 'service' && (
          product.stock_status === 'out_of_stock' ||
          (product.stock_quantity != null && product.stock_quantity < item.quantity && product.stock_status !== 'backorder')
        )
      ) {
        throw new BadRequestException(`Insufficient stock for ${product.title}`);
      }
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Calculate totals
    const subtotal = cart.subtotal;
    const tax = 0; // Tax calculation would go here
    const shipping = hasPhysical ? 0 : 0; // Shipping calculation would go here
    const total = subtotal + tax + shipping;

    // Compose customer name from checkout form (first+last) or shipping address name
    const customerName = dto.customer_first_name
      ? `${dto.customer_first_name}${dto.customer_last_name ? ' ' + dto.customer_last_name : ''}`.trim()
      : dto.shipping_address?.name ?? undefined;

    // Create order
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        user_id: userId,
        email: userEmail ?? dto.guest_email ?? '',
        customer_name: customerName,
        status: 'pending',
        subtotal,
        tax,
        shipping,
        total,
        payment_method: dto.payment_method ?? 'stripe',
        shipping_name: dto.shipping_address?.name ?? customerName,
        shipping_address: dto.shipping_address?.street,
        shipping_city: dto.shipping_address?.city,
        shipping_state: dto.shipping_address?.state,
        shipping_zip: dto.shipping_address?.postal_code,
        shipping_country: dto.shipping_address?.country,
        items: {
          create: cart.items.map((item: any) => ({
            product_id: item.product_id,
            product_title: item.product.title ?? '',
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
      include: this.getOrderIncludes(),
    });

    // Back-fill first/last name on user record if they didn't have one yet
    if (userId && dto.customer_first_name) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { first_name: true },
      });
      if (!userRecord?.first_name) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            first_name: dto.customer_first_name,
            last_name: dto.customer_last_name ?? null,
          },
        });
      }
    }

    // Update stock quantities
    for (const item of cart.items) {
      await this.prisma.product.update({
        where: { id: item.product_id },
        data: {
          stock_quantity: {
            decrement: item.quantity,
          },
        },
      });

      // Update stock status if needed
      const updated = await this.prisma.product.findUnique({
        where: { id: item.product_id },
      });
      // When 'digital' is added to product_type, change to: product_type === 'physical'. See docs/Shape_Audit.md Item 5.
      if (updated && updated.product_type !== 'service' && updated.stock_quantity != null && updated.stock_quantity <= 0) {
        await this.prisma.product.update({
          where: { id: item.product_id },
          data: { stock_status: 'out_of_stock' },
        });
      }
    }

    // Clear cart
    await this.cartService.clearCart(userId, sessionId);

    return this.transformOrder(order);
  }

  /**
   * Find all orders (admin)
   */
  async findAll(query: QueryOrdersDto) {
    const {
      status,
      user_id,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (user_id) {
      where.user_id = user_id;
    }

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: this.getOrderIncludes(),
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => this.transformOrder(order)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find user's orders
   */
  async findUserOrders(userId: string, query: QueryOrdersDto) {
    return this.findAll({ ...query, user_id: userId });
  }

  /**
   * Find order by ID
   */
  async findById(id: string, userId?: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.getOrderIncludes(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Guests (no userId) can view orders that have no user_id (guest orders)
    if (!isAdmin && userId && order.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (!isAdmin && !userId && order.user_id !== null) {
      throw new ForbiddenException('Access denied');
    }

    return this.transformOrder(order);
  }

  /**
   * Find order by order number
   */
  async findByOrderNumber(orderNumber: string, userId?: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: this.getOrderIncludes(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    if (!isAdmin && order.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.transformOrder(order);
  }

  /**
   * Update order status (admin)
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, dto.status);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: this.getOrderIncludes(),
    });

    await this.auditLog.log({
      event_type: 'order.status_changed',
      user_id: actorId ?? undefined,
      resource_type: 'order',
      resource_id: id,
      changes: { before: { status: order.status }, after: { status: dto.status } },
      metadata: undefined,
    });

    return this.transformOrder(updated);
  }

  /**
   * Mark order as paid (called after payment confirmation)
   */
  async markAsPaid(id: string, paymentIntentId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'processing',
        payment_intent_id: paymentIntentId,
        paid_at: new Date(),
      },
      include: this.getOrderIncludes(),
    });

    await this.auditLog.log({
      event_type: 'order.status_changed',
      resource_type: 'order',
      resource_id: id,
      changes: { before: { status: order.status }, after: { status: 'processing' } },
      metadata: { payment_intent_id: paymentIntentId },
    });

    return this.transformOrder(updated);
  }

  /**
   * Cancel order
   */
  async cancel(id: string, userId?: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    if (!isAdmin && order.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Only pending orders can be cancelled
    if (order.status !== 'pending') {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    // Restore stock
    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.product_id },
        data: {
          stock_quantity: {
            increment: item.quantity,
          },
          stock_status: 'in_stock',
        },
      });
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'cancelled' },
      include: this.getOrderIncludes(),
    });

    return this.transformOrder(updated);
  }

  /**
   * Update fulfillment info for a physical order (tracking number, carrier, mark shipped)
   */
  async updateFulfillment(id: string, dto: UpdateFulfillmentDto, actorId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const data: any = {};
    if (dto.tracking_number !== undefined) data.tracking_number = dto.tracking_number;
    if (dto.tracking_carrier !== undefined) data.tracking_carrier = dto.tracking_carrier;
    if (dto.mark_shipped && order.status === 'processing') {
      this.validateStatusTransition(order.status, 'shipped');
      data.status = 'shipped';
      data.shipped_at = new Date();
    }
    if (dto.scheduled_note !== undefined) data.scheduled_note = dto.scheduled_note;
    if (dto.mark_scheduled && order.status === 'processing') {
      this.validateStatusTransition(order.status, 'scheduled');
      data.status = 'scheduled';
      data.scheduled_at = dto.scheduled_at ? new Date(dto.scheduled_at) : new Date();
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: this.getOrderIncludes(),
    });

    if (data.status) {
      await this.auditLog.log({
        event_type: 'order.status_changed',
        user_id: actorId ?? undefined,
        resource_type: 'order',
        resource_id: id,
        changes: { before: { status: order.status }, after: { status: data.status } },
        metadata: undefined,
      });
    }

    return this.transformOrder(updated);
  }


  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'scheduled', 'completed', 'cancelled', 'refunded'],
      shipped: ['completed', 'refunded'],
      scheduled: ['completed', 'cancelled', 'refunded'],
      completed: ['refunded'],
      cancelled: [],
      refunded: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Get order includes
   */
  private getOrderIncludes() {
    return {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              product_type: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      },
    };
  }

  /**
   * Transform order response
   */
  private transformOrder(order: any) {
    return {
      ...order,
      subtotal: parseFloat(order.subtotal.toString()),
      tax: parseFloat(order.tax.toString()),
      shipping: parseFloat(order.shipping.toString()),
      total: parseFloat(order.total.toString()),
      // Remap flat DB shipping columns → nested object the frontend expects
      shipping_address: order.shipping_address ? {
        street: order.shipping_address,
        city: order.shipping_city ?? '',
        state: order.shipping_state ?? '',
        postal_code: order.shipping_zip ?? '',
        country: order.shipping_country ?? '',
      } : null,
      items: order.items.map((item: any) => {
        const unitPrice = parseFloat(item.price.toString());
        return {
          ...item,
          product_name: item.product?.title ?? '',
          product_sku: item.product?.sku ?? '',
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
        };
      }),
    };
  }

  async exportCsv(from: Date, to: Date): Promise<string> {
    // Include day boundary on 'to' date
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: from, lte: toEnd },
        status: { not: 'pending' },
      },
      include: {
        items: {
          include: { product: { select: { title: true } } },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const rows: string[] = [
      [
        'date', 'type', 'order_number', 'customer_email', 'customer_name',
        'payment_method', 'payment_reference', 'items',
        'subtotal', 'tax', 'shipping', 'total', 'status', 'notes',
      ].join(','),
    ];

    const csvVal = (v: string | number | null | undefined) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const formatMoney = (d: any) =>
      d != null ? parseFloat(d.toString()).toFixed(2) : '0.00';

    for (const order of orders) {
      const itemsStr = order.items
        .map((i: any) => {
          const title = (i.product_title && i.product_title.length > 0)
            ? i.product_title
            : (i.product?.title ?? i.product_id);
          return `${title} × ${i.quantity}`;
        })
        .join('; ');

      // Sale row
      rows.push([
        csvVal(order.paid_at ? order.paid_at.toISOString() : order.created_at.toISOString()),
        csvVal('sale'),
        csvVal(order.order_number),
        csvVal(order.email),
        csvVal(order.customer_name ?? ''),
        csvVal(order.payment_method),
        csvVal(order.payment_intent_id ?? ''),
        csvVal(itemsStr),
        csvVal(formatMoney(order.subtotal)),
        csvVal(formatMoney(order.tax)),
        csvVal(formatMoney(order.shipping)),
        csvVal(formatMoney(order.total)),
        csvVal(order.status),
        csvVal(''),
      ].join(','));

      // Refund row (if applicable)
      if (order.status === 'refunded') {
        const refundDate = order.refunded_at ?? order.updated_at;
        const refundTotal = order.refund_amount != null
          ? `-${parseFloat(order.refund_amount.toString()).toFixed(2)}`
          : `-${formatMoney(order.total)}`;
        const notes = order.refunded_at ? '' : 'refunded_at unavailable — using updated_at';

        rows.push([
          csvVal(refundDate.toISOString()),
          csvVal('refund'),
          csvVal(order.order_number),
          csvVal(order.email),
          csvVal(order.customer_name ?? ''),
          csvVal(order.payment_method),
          csvVal(order.refund_id ?? order.payment_intent_id ?? ''),
          csvVal(itemsStr),
          csvVal(`-${formatMoney(order.subtotal)}`),
          csvVal(`-${formatMoney(order.tax)}`),
          csvVal(`-${formatMoney(order.shipping)}`),
          csvVal(refundTotal),
          csvVal('refunded'),
          csvVal(notes),
        ].join(','));
      }
    }

    return rows.join('\n');
  }
}
