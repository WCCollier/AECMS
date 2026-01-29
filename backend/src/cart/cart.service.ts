import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
      throw new BadRequestException('Either userId or sessionId is required');
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
    // Validate product exists and is purchaseable
    const product = await this.prisma.product.findUnique({
      where: { id: dto.product_id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== 'published') {
      throw new BadRequestException('Product is not available');
    }

    if (product.stock_status === 'out_of_stock') {
      throw new BadRequestException('Product is out of stock');
    }

    // Check guest purchase permissions
    if (!userId && !product.guest_purchaseable) {
      throw new ForbiddenException('Login required to purchase this product');
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId, sessionId);

    // Check if item already in cart
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        product_id: dto.product_id,
      },
    });

    const quantity = dto.quantity || 1;

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      // Check stock
      if (newQuantity > product.stock_quantity && product.stock_status !== 'backorder') {
        throw new BadRequestException(
          `Only ${product.stock_quantity} items available in stock`,
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      // Check stock
      if (quantity > product.stock_quantity && product.stock_status !== 'backorder') {
        throw new BadRequestException(
          `Only ${product.stock_quantity} items available in stock`,
        );
      }

      // Add new item
      await this.prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: dto.product_id,
          user_id: userId,
          quantity,
        },
      });
    }

    // Return updated cart
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

    // Check stock
    if (
      dto.quantity > item.product.stock_quantity &&
      item.product.stock_status !== 'backorder'
    ) {
      throw new BadRequestException(
        `Only ${item.product.stock_quantity} items available in stock`,
      );
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
    // Get both carts
    const [guestCart, userCart] = await Promise.all([
      this.prisma.cart.findFirst({
        where: { session_id: sessionId },
        include: { items: true },
      }),
      this.prisma.cart.findFirst({
        where: { user_id: userId },
        include: { items: true },
      }),
    ]);

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge
      return this.getCart(userId);
    }

    // Create user cart if doesn't exist
    let targetCart = userCart;
    if (!targetCart) {
      targetCart = await this.prisma.cart.create({
        data: { user_id: userId },
        include: { items: true },
      });
    }

    // Merge items
    for (const guestItem of guestCart.items) {
      const existingItem = targetCart.items.find(
        (i) => i.product_id === guestItem.product_id,
      );

      if (existingItem) {
        // Add quantities
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + guestItem.quantity },
        });
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
   * Transform cart response
   */
  private transformCart(cart: any) {
    const items = cart.items.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: parseFloat(item.product.price.toString()),
        stock_status: item.product.stock_status,
        stock_quantity: item.product.stock_quantity,
        image: item.product.media?.[0]?.media || null,
      },
      line_total: parseFloat(item.product.price.toString()) * item.quantity,
    }));

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.line_total,
      0,
    );

    return {
      id: cart.id,
      items,
      item_count: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
    };
  }
}
