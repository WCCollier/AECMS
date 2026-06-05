import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or create cart for user or session
   */
  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new BadRequestException('Either userId or sessionId is required');
    }

    // Try to find existing cart
    let cart = await this.prisma.cart.findFirst({
      where: userId ? { user_id: userId } : { session_id: sessionId },
      include: this.getCartIncludes(),
    });

    // Create new cart if not found
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: userId ? { user_id: userId } : { session_id: sessionId },
        include: this.getCartIncludes(),
      });
    }

    return this.transformCart(cart);
  }

  /**
   * Get cart
   */
  async getCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      return { id: null, items: [], item_count: 0, subtotal: 0 };
    }

    const cart = await this.prisma.cart.findFirst({
      where: userId ? { user_id: userId } : { session_id: sessionId },
      include: this.getCartIncludes(),
    });

    if (!cart) {
      // Return empty cart structure
      return {
        id: null,
        items: [],
        item_count: 0,
        subtotal: 0,
      };
    }

    return this.transformCart(cart);
  }

  /**
   * Add item to cart
   */
  async addItem(dto: AddToCartDto, userId?: string, sessionId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.product_id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }
    if (product.status !== 'published') {
      throw new BadRequestException('Product is not available');
    }
    if (!userId && !product.guest_purchaseable) {
      throw new ForbiddenException('Login required to purchase this product');
    }

    const cart = await this.getOrCreateCart(userId, sessionId);

    const existingItem = await this.prisma.cartItem.findFirst({
      where: { cart_id: cart.id, product_id: dto.product_id },
    });

    // Service and digital products are non-quantifiable — always qty 1 per cart.
    const isNonQuantifiable = product.product_type !== 'physical';
    const quantity = isNonQuantifiable ? 1 : (dto.quantity || 1);
    // Non-quantifiable: always 1 regardless of existing; physical: accumulate.
    const newQuantity = isNonQuantifiable ? 1 : (existingItem ? existingItem.quantity + quantity : quantity);

    // If a non-quantifiable item is already in the cart at qty 1, nothing to do.
    if (isNonQuantifiable && existingItem) {
      return this.getCart(userId, sessionId);
    }

    // Virtual stock check — physical products only.
    if (
      !isNonQuantifiable &&
      product.stock_quantity != null &&
      product.stock_status !== 'backorder'
    ) {
      const available = await this.getVirtualAvailableStock(
        dto.product_id,
        product.stock_quantity,
        cart.id,
      );
      if (newQuantity > available) {
        if (available <= 0) {
          throw new ConflictException('This item is out of stock');
        }
        const alreadyInCart = existingItem?.quantity ?? 0;
        const canAddMore = available - alreadyInCart;
        if (canAddMore <= 0) {
          throw new ConflictException(
            `You already have all available stock in your cart (${available} unit${available !== 1 ? 's' : ''})`,
          );
        }
        throw new ConflictException(
          `Only ${available} available — you can add ${canAddMore} more`,
        );
      }
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: dto.product_id,
          user_id: userId,
          quantity,
        },
      });
    }

    return this.getCart(userId, sessionId);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string,
    sessionId?: string,
  ) {
    // Get cart item
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    // Verify ownership
    if (userId && item.cart.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (sessionId && item.cart.session_id !== sessionId) {
      throw new ForbiddenException('Access denied');
    }

    const isNonQuantifiable = item.product.product_type !== 'physical';

    // Service and digital products are always qty 1 — reject any other value.
    if (isNonQuantifiable && dto.quantity !== 1) {
      throw new BadRequestException('Quantity must be 1 for service and digital products');
    }

    // Virtual stock check for physical products only.
    if (
      !isNonQuantifiable &&
      item.product.stock_quantity != null &&
      item.product.stock_status !== 'backorder'
    ) {
      const available = await this.getVirtualAvailableStock(
        item.product_id,
        item.product.stock_quantity,
        item.cart_id,
      );
      if (dto.quantity > available) {
        if (available <= 0) {
          throw new ConflictException('This item is out of stock');
        }
        throw new ConflictException(`Only ${available} available`);
      }
    }

    // Update quantity
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    // Return updated cart
    return this.getCart(userId, sessionId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    // Get cart item
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    // Verify ownership
    if (userId && item.cart.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (sessionId && item.cart.session_id !== sessionId) {
      throw new ForbiddenException('Access denied');
    }

    // Delete item
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Return updated cart
    return this.getCart(userId, sessionId);
  }

  /**
   * Clear cart
   */
  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { user_id: userId } : { session_id: sessionId },
    });

    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cart_id: cart.id },
      });
    }

    return this.getCart(userId, sessionId);
  }

  /**
   * Merge guest cart into user cart (on login)
   */
  async mergeCart(userId: string, sessionId: string) {
    // Get both carts, including product type so we can handle non-quantifiable items
    const itemInclude = { items: { include: { product: { select: { product_type: true } } } } };
    const [guestCart, userCart] = await Promise.all([
      this.prisma.cart.findFirst({ where: { session_id: sessionId }, include: itemInclude }),
      this.prisma.cart.findFirst({ where: { user_id: userId }, include: itemInclude }),
    ]);

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge
      return this.getCart(userId);
    }

    // Create user cart if doesn't exist (use same include so types align)
    const targetCart = userCart ?? await this.prisma.cart.create({
      data: { user_id: userId },
      include: itemInclude,
    });

    // Merge items
    for (const guestItem of guestCart.items) {
      const existingItem = targetCart.items.find(
        (i) => i.product_id === guestItem.product_id,
      );

      if (existingItem) {
        // Physical: sum quantities. Service/digital: already 1 in both carts — nothing to do.
        if (guestItem.product.product_type === 'physical') {
          await this.prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + guestItem.quantity },
          });
        }
        // Non-physical guest item stays in guest cart and is deleted with it below
      } else {
        // Move item to user cart
        await this.prisma.cartItem.update({
          where: { id: guestItem.id },
          data: {
            cart_id: targetCart.id,
            user_id: userId,
          },
        });
      }
    }

    // Delete guest cart
    await this.prisma.cart.delete({
      where: { id: guestCart.id },
    });

    return this.getCart(userId);
  }

  /**
   * Validate cart stock before checkout.
   * Corrects any over-limit quantities in place and returns what changed.
   */
  async validateCart(userId?: string, sessionId?: string) {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { user_id: userId } : { session_id: sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                product_type: true,
                stock_quantity: true,
                stock_status: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return { adjusted: false, changes: [] };
    }

    const changes: Array<{
      product_name: string;
      action: 'removed' | 'reduced';
      from: number;
      to: number;
    }> = [];

    for (const item of cart.items) {
      const { product } = item;
      if (
        product.product_type === 'service' ||
        product.stock_quantity == null ||
        product.stock_status === 'backorder'
      ) {
        continue;
      }

      const available = await this.getVirtualAvailableStock(
        product.id,
        product.stock_quantity,
        cart.id,
      );

      if (item.quantity > available) {
        if (available <= 0) {
          await this.prisma.cartItem.delete({ where: { id: item.id } });
          changes.push({ product_name: product.name, action: 'removed', from: item.quantity, to: 0 });
        } else {
          await this.prisma.cartItem.update({
            where: { id: item.id },
            data: { quantity: available },
          });
          changes.push({ product_name: product.name, action: 'reduced', from: item.quantity, to: available });
        }
      }
    }

    return { adjusted: changes.length > 0, changes };
  }

  /**
   * Compute stock available to a specific cart, excluding its own existing reservation.
   * excludeCartId: the current cart — its reservations don't count against itself.
   */
  private async getVirtualAvailableStock(
    productId: string,
    stockQuantity: number,
    excludeCartId: string,
  ): Promise<number> {
    const result = await this.prisma.cartItem.aggregate({
      where: { product_id: productId, cart_id: { not: excludeCartId } },
      _sum: { quantity: true },
    });
    const reserved = result._sum.quantity ?? 0;
    return stockQuantity - reserved;
  }

  /**
   * Get cart includes
   */
  private getCartIncludes() {
    return {
      items: {
        include: {
          product: {
            include: {
              media: {
                include: { media: true },
                orderBy: { order: 'asc' as const },
                take: 1, // Just the primary image
              },
            },
          },
        },
      },
    };
  }

  /**
   * Transform cart response.
   *
   * user_id, session_id, created_at, updated_at are intentionally retained in the
   * response even though no current UI component reads them. They are audit-trail
   * fields required for future abandoned-cart detection and recovery (identifying
   * stale carts by updated_at, joining to user records for recovery emails, tracking
   * anonymous sessions). Stripping them would force a non-trivial backend change when
   * that feature is built. See docs/Shape_Audit.md Item 6 for full rationale.
   */
  private transformCart(cart: any) {
    const items = cart.items.map((item: any) => {
      const unitPrice = parseFloat(item.product.price.toString());
      const fp = item.product.media?.[0]?.media?.file_path ?? null;
      const featured_image_url = fp
        ? fp.startsWith('/uploads/') ? fp
          : fp.includes('/uploads/') ? fp.replace(/.*\/uploads\//, '/uploads/')
          : `/uploads/${fp}`
        : null;
      return {
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: unitPrice,
          product_type: item.product.product_type,
          stock_status: item.product.stock_status,
          stock_quantity: item.product.stock_quantity,
          featured_image_url,
        },
        line_total: unitPrice * item.quantity,
      };
    });

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.line_total,
      0,
    );

    return {
      id: cart.id,
      user_id: cart.user_id,
      session_id: cart.session_id,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
      items,
      item_count: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      subtotal: Math.round(subtotal * 100) / 100,
    };
  }
}
