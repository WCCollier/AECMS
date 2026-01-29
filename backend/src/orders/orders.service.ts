import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto, UpdateOrderStatusDto, QueryOrdersDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
  ) {}

  /**
   * Create order from cart
   */
  async createFromCart(
    dto: CreateOrderDto,
    userId?: string,
    sessionId?: string,
  ) {
    // Get cart
    const cart = await this.cartService.getCart(userId, sessionId);

    if (!cart.id || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Check if physical products require shipping address
    const hasPhysical = cart.items.some(
      (item: any) => item.product.product_type === 'physical',
    );

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
        throw new BadRequestException(`Product ${item.product.name} is no longer available`);
      }

      if (
        product.stock_status === 'out_of_stock' ||
        (product.stock_quantity < item.quantity && product.stock_status !== 'backorder')
      ) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Calculate totals
    const subtotal = cart.subtotal;
    const tax = 0; // Tax calculation would go here
    const shipping = hasPhysical ? 0 : 0; // Shipping calculation would go here
    const total = subtotal + tax + shipping;

    // Create order
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        user_id: userId,
        email: dto.email,
        status: 'pending',
        subtotal,
        tax,
        shipping,
        total,
        payment_method: dto.payment_method,
        shipping_name: dto.shipping_address?.name,
        shipping_address: dto.shipping_address?.address,
        shipping_city: dto.shipping_address?.city,
        shipping_state: dto.shipping_address?.state,
        shipping_zip: dto.shipping_address?.zip,
        shipping_country: dto.shipping_address?.country,
        items: {
          create: cart.items.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
      include: this.getOrderIncludes(),
    });

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
      if (updated && updated.stock_quantity <= 0) {
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

    // Check access
    if (!isAdmin && order.user_id !== userId) {
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
  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
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
      processing: ['completed', 'cancelled', 'refunded'],
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
              name: true,
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
      items: order.items.map((item: any) => ({
        ...item,
        price: parseFloat(item.price.toString()),
        line_total: parseFloat(item.price.toString()) * item.quantity,
      })),
    };
  }
}
