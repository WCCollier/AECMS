import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, QueryProductsDto } from './dto';
import { Prisma, ContentVisibility } from '@prisma/client';
import { AuditLogService, diffChanges } from '../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Create a new product
   */
  async create(dto: CreateProductDto) {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Product with slug "${slug}" already exists`);
    }

    // Resolve SKU: use provided value, or auto-generate from slug
    const sku = dto.sku ? dto.sku : await this.generateUniqueSku(slug, dto.product_type || 'physical');

    // Check if SKU already exists (only relevant when explicitly provided)
    if (dto.sku) {
      const existingSku = await this.prisma.product.findUnique({ where: { sku } });
      if (existingSku) {
        throw new ConflictException(`Product with SKU "${sku}" already exists`);
      }
    }

    // Validate categories exist
    if (dto.category_ids && dto.category_ids.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: dto.category_ids } },
      });
      if (categories.length !== dto.category_ids.length) {
        throw new BadRequestException('One or more categories not found');
      }
    }

    // Validate tags exist
    if (dto.tag_ids && dto.tag_ids.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: dto.tag_ids } },
      });
      if (tags.length !== dto.tag_ids.length) {
        throw new BadRequestException('One or more tags not found');
      }
    }

    // Create product with relationships
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        short_description: dto.short_description,
        price: dto.price,
        compare_at_price: dto.compare_at_price ?? null,
        sku,
        stock_quantity: dto.product_type === 'service' ? null : (dto.stock_quantity ?? 0),
        stock_status: dto.stock_status || (dto.product_type === 'service' ? 'available' : 'in_stock'),
        status: dto.status || 'draft',
        visibility: dto.visibility || 'public',
        guest_purchaseable: dto.guest_purchaseable ?? false,
        product_type: dto.product_type || 'physical',
        author_id: dto.author_id ?? null,
        meta_title: dto.meta_title,
        meta_description: dto.meta_description,
        author_can_edit: dto.author_can_edit ?? true,
        author_can_delete: dto.author_can_delete ?? true,
        admin_can_edit: dto.admin_can_edit ?? true,
        admin_can_delete: dto.admin_can_delete ?? true,
        published_at: dto.status === 'published' ? new Date() : null,
        categories: dto.category_ids
          ? {
              create: dto.category_ids.map((categoryId) => ({
                category: { connect: { id: categoryId } },
              })),
            }
          : undefined,
        tags: dto.tag_ids
          ? {
              create: dto.tag_ids.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
      },
      include: this.getProductIncludes(),
    });

    if (dto.media_ids?.length) {
      await this.setProductMedia(product.id, dto.media_ids);
      const fresh = await this.prisma.product.findUnique({
        where: { id: product.id },
        include: this.getProductIncludes(),
      });
      return this.transformProduct(fresh!);
    }

    return this.transformProduct(product);
  }

  private async createProductVersion(product: any, userId: string, summary?: string) {
    const last = await this.prisma.productVersion.findFirst({
      where: { product_id: product.id },
      orderBy: { version_number: 'desc' },
    });
    await this.prisma.productVersion.create({
      data: {
        product_id: product.id,
        version_number: (last?.version_number ?? 0) + 1,
        name: product.name,
        description: product.description ?? null,
        price: product.price,
        compare_at_price: product.compare_at_price ?? null,
        sku: product.sku ?? null,
        stock_quantity: product.stock_quantity ?? null,
        stock_status: product.stock_status,
        change_summary: summary ?? null,
        created_by: userId,
      },
    });
  }

  /**
   * Find all products with filtering and pagination
   */
  async findAll(
    query: QueryProductsDto,
    userId?: string,
    isAdmin = false,
    canDeleteOwn = false,
    canDeleteAny = false,
  ) {
    const {
      status,
      visibility,
      stock_status,
      product_type,
      category_id,
      tag_id,
      min_price,
      max_price,
      guest_purchaseable,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      include_deleted,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (isAdmin && include_deleted) {
      if (canDeleteAny) {
        where.deleted_at = { not: null };
      } else if (canDeleteOwn && userId) {
        where.deleted_at = { not: null };
        where.author_id = userId;
      } else {
        where.deleted_at = null;
      }
    } else {
      where.deleted_at = null;
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Visibility filter based on user permissions
    if (!isAdmin) {
      if (userId) {
        where.visibility = {
          in: [ContentVisibility.public, ContentVisibility.logged_in_only],
        };
      } else {
        where.visibility = ContentVisibility.public;
      }
      // Non-admin users only see published products
      where.status = 'published';
    }

    // Additional visibility filter if specified
    if (visibility && isAdmin) {
      where.visibility = visibility;
    }

    // Stock status filter
    if (stock_status) {
      where.stock_status = stock_status;
    }

    // Product type filter
    if (product_type) {
      where.product_type = product_type;
    }

    // Category filter
    if (category_id) {
      where.categories = {
        some: {
          category_id,
        },
      };
    }

    // Tag filter
    if (tag_id) {
      where.tags = {
        some: {
          tag_id,
        },
      };
    }

    // Price range filter
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) {
        where.price.gte = min_price;
      }
      if (max_price !== undefined) {
        where.price.lte = max_price;
      }
    }

    // Guest purchaseable filter
    if (guest_purchaseable !== undefined) {
      where.guest_purchaseable = guest_purchaseable;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { short_description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: this.getProductIncludes(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: await Promise.all(products.map((product) => this.transformProduct(product))),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find product by ID
   */
  async findById(id: string, userId?: string, isAdmin = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.getProductIncludes(),
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(product, userId, isAdmin);

    return this.transformProduct(product);
  }

  /**
   * Find product by slug
   */
  async findBySlug(slug: string, userId?: string, isAdmin = false) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: this.getProductIncludes(),
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(product, userId, isAdmin);

    return this.transformProduct(product);
  }

  /**
   * Update product
   */
  async update(id: string, dto: UpdateProductDto, userId: string, canEditOwn = false, canEditAny = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check edit permissions
    const authorMatch = product.author_id === userId;
    if (!(canEditAny && product.admin_can_edit) && !(canEditOwn && authorMatch)) {
      throw new ForbiddenException('You do not have permission to edit this product');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== product.slug) {
      const existing = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(`Product with slug "${dto.slug}" already exists`);
      }
    }

    // Check SKU uniqueness if changing
    if (dto.sku && dto.sku !== product.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (existingSku) {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
      }
    }

    // Handle status change to published
    let published_at = product.published_at;
    if (dto.status === 'published' && product.status !== 'published') {
      published_at = new Date();
    }

    // Prepare update data
    const updateData: Prisma.ProductUpdateInput = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      short_description: dto.short_description,
      price: dto.price,
      compare_at_price: dto.compare_at_price,
      sku: dto.sku,
      stock_quantity: dto.stock_quantity,
      stock_status: dto.stock_status,
      status: dto.status,
      visibility: dto.visibility,
      guest_purchaseable: dto.guest_purchaseable,
      product_type: dto.product_type,
      author: dto.author_id !== undefined
        ? (dto.author_id ? { connect: { id: dto.author_id } } : { disconnect: true })
        : undefined,
      meta_title: dto.meta_title,
      meta_description: dto.meta_description,
      author_can_edit: dto.author_can_edit,
      author_can_delete: dto.author_can_delete,
      admin_can_edit: dto.admin_can_edit,
      admin_can_delete: dto.admin_can_delete,
      published_at,
    };

    // Handle category updates
    if (dto.category_ids !== undefined) {
      await this.prisma.productCategory.deleteMany({
        where: { product_id: id },
      });
      if (dto.category_ids.length > 0) {
        updateData.categories = {
          create: dto.category_ids.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        };
      }
    }

    // Handle tag updates
    if (dto.tag_ids !== undefined) {
      await this.prisma.productTag.deleteMany({
        where: { product_id: id },
      });
      if (dto.tag_ids.length > 0) {
        updateData.tags = {
          create: dto.tag_ids.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        };
      }
    }

    // Update product
    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: this.getProductIncludes(),
    });

    if (dto.media_ids !== undefined) {
      await this.setProductMedia(id, dto.media_ids);
      const fresh = await this.prisma.product.findUnique({
        where: { id },
        include: this.getProductIncludes(),
      });
      await this.createProductVersion(fresh!, userId, (dto as any).change_summary);
      await this.auditLog.log({
        event_type: 'product.updated',
        user_id: userId,
        resource_type: 'product',
        resource_id: id,
        changes: diffChanges(product as any, dto as any),
      });
      return this.transformProduct(fresh!);
    }

    await this.createProductVersion(updated, userId, (dto as any).change_summary);
    const diff = diffChanges(product as any, dto as any);
    await this.auditLog.log({
      event_type: 'product.updated',
      user_id: userId,
      resource_type: 'product',
      resource_id: id,
      changes: Object.keys(diff.before).length ? diff : undefined,
    });

    return this.transformProduct(updated);
  }

  /**
   * Delete product (soft delete)
   */
  async remove(id: string, userId: string, canDeleteOwn = false, canDeleteAny = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check delete permissions
    const authorMatch = product.author_id === userId;
    if (!(canDeleteAny && product.admin_can_delete) && !(canDeleteOwn && authorMatch)) {
      throw new ForbiddenException('You do not have permission to delete this product');
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.auditLog.log({
      event_type: 'product.deleted',
      resource_type: 'product',
      resource_id: id,
      metadata: { name: product.name, slug: product.slug },
    });
  }

  /**
   * Restore a soft-deleted product (reverts to draft)
   */
  async restore(id: string, userId: string, canDeleteOwn = false, canDeleteAny = false) {
    const product = await this.prisma.product.findFirst({ where: { id, deleted_at: { not: null } } });
    if (!product) throw new NotFoundException('Deleted product not found');
    if (!canDeleteAny && !canDeleteOwn) {
      throw new ForbiddenException('You do not have permission to restore this product');
    }
    if (!canDeleteAny && canDeleteOwn && product.author_id !== userId) {
      throw new ForbiddenException('You can only restore your own products');
    }
    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: null, status: 'draft' },
    });
    await this.auditLog.log({
      event_type: 'product.updated',
      user_id: userId,
      resource_type: 'product',
      resource_id: id,
      metadata: { name: product.name, action: 'restored_from_trash' },
    });
  }

  /**
   * Update stock
   */
  async getVersions(productId: string, page = 1, limit = 20) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deleted_at: null } });
    if (!product) throw new NotFoundException('Product not found');
    const skip = (page - 1) * limit;
    const [versions, total] = await Promise.all([
      this.prisma.productVersion.findMany({
        where: { product_id: productId },
        orderBy: { version_number: 'desc' },
        skip,
        take: limit,
        select: { id: true, version_number: true, name: true, price: true, stock_status: true, change_summary: true, created_by: true, created_at: true },
      }),
      this.prisma.productVersion.count({ where: { product_id: productId } }),
    ]);
    return { data: versions, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getVersion(productId: string, versionNumber: number) {
    const version = await this.prisma.productVersion.findUnique({
      where: { product_id_version_number: { product_id: productId, version_number: versionNumber } },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async restoreVersion(productId: string, versionNumber: number, userId: string) {
    const version = await this.getVersion(productId, versionNumber);
    const product = await this.prisma.product.findFirst({ where: { id: productId, deleted_at: null } });
    if (!product) throw new NotFoundException('Product not found');

    const restored = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: version.name,
        description: version.description ?? undefined,
        price: version.price,
        compare_at_price: version.compare_at_price ?? null,
        sku: version.sku ?? undefined,
        stock_quantity: version.stock_quantity ?? null,
        stock_status: version.stock_status as any,
      },
      include: this.getProductIncludes(),
    });

    await this.createProductVersion(restored, userId, `Restored from version ${versionNumber}`);
    await this.auditLog.log({
      event_type: 'product.updated',
      user_id: userId,
      resource_type: 'product',
      resource_id: productId,
      metadata: { restored_from_version: versionNumber },
    });

    return this.transformProduct(restored);
  }

  async updateStock(id: string, quantity: number, isAdmin = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can update stock');
    }

    const newQuantity = Math.max(0, quantity);
    const stockStatus = newQuantity > 0 ? 'in_stock' : 'out_of_stock';

    return this.prisma.product.update({
      where: { id },
      data: {
        stock_quantity: newQuantity,
        stock_status: stockStatus,
      },
    });
  }

  /**
   * Generate slug from name
   */
  private static readonly SKU_STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'of', 'for', 'in', 'to', 'with', 'by', 'at',
  ]);

  private static readonly SKU_TYPE_PREFIX: Record<string, string> = {
    physical: 'P', digital: 'D', service: 'S',
  };

  private generateSkuFromSlug(slug: string, type: string): string {
    const prefix = ProductsService.SKU_TYPE_PREFIX[type] ?? 'X';
    const parts = slug
      .toLowerCase()
      .split('-')
      .filter((p) => p.length > 0 && !ProductsService.SKU_STOP_WORDS.has(p))
      .slice(0, 3)
      .map((p) => p.slice(0, 4).toUpperCase());
    return parts.length ? `${prefix}-${parts.join('-')}` : prefix;
  }

  private async generateUniqueSku(slug: string, type: string): Promise<string> {
    const base = this.generateSkuFromSlug(slug, type);
    const taken = await this.prisma.product.findUnique({ where: { sku: base } });
    if (!taken) return base;
    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}-${i}`;
      const conflict = await this.prisma.product.findUnique({ where: { sku: candidate } });
      if (!conflict) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200);
  }

  /**
   * Get product includes for queries
   */
  private async setProductMedia(productId: string, mediaIds: string[]) {
    await this.prisma.productMedia.deleteMany({ where: { product_id: productId } });
    if (mediaIds.length === 0) return;
    await this.prisma.productMedia.createMany({
      data: mediaIds.map((mediaId, index) => ({
        product_id: productId,
        media_id: mediaId,
        order: index,
        is_primary: index === 0,
      })),
    });
  }

  private getProductIncludes() {
    return {
      author: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      media: {
        include: {
          media: true,
        },
        orderBy: {
          order: 'asc' as const,
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    };
  }

  /**
   * Check visibility access
   */
  private checkVisibilityAccess(product: any, userId?: string, isAdmin = false) {
    if (isAdmin) {
      return;
    }

    // Non-admins can't see non-published products
    if (product.status !== 'published') {
      throw new NotFoundException('Product not found');
    }

    if (product.visibility === ContentVisibility.admin_only) {
      throw new ForbiddenException('Access denied');
    }

    if (product.visibility === ContentVisibility.logged_in_only && !userId) {
      throw new ForbiddenException('Login required');
    }
  }

  /**
   * Transform product response
   */
  private mediaUrl(filePath: string | null | undefined): string | null {
    if (!filePath) return null;
    const fp = filePath;
    return fp.startsWith('/uploads/') ? fp
      : fp.includes('/uploads/') ? fp.replace(/.*\/uploads\//, '/uploads/')
      : `/uploads/${fp}`;
  }

  private buildProductBase(product: any) {
    const mediaItems = (product.media || []).map((pm: any) => ({
      id: pm.media.id,
      url: this.mediaUrl(pm.media.file_path),
      order: pm.order,
      is_primary: pm.is_primary,
      alt_text: pm.media.alt_text ?? null,
    }));

    const primaryMedia = mediaItems.find((m: any) => m.is_primary) ?? mediaItems[0] ?? null;

    return {
      ...product,
      price: parseFloat(product.price.toString()),
      categories: product.categories?.map((pc: any) => pc.category) || [],
      tags: product.tags?.map((pt: any) => pt.tag) || [],
      media: mediaItems,
      featured_image_url: primaryMedia?.url ?? null,
      compare_at_price: product.compare_at_price ? parseFloat(product.compare_at_price.toString()) : null,
      comment_count: product._count?.comments || 0,
    };
  }

  /**
   * Fetch review_count and average_rating for a product from CommentRating.
   * review_count = approved comments with at least one rating.
   * average_rating = mean of all approved "Overall" ratings on this product.
   */
  private async getRatingStats(productId: string) {
    const [reviewCount, ratingAgg] = await Promise.all([
      this.prisma.comment.count({
        where: {
          product_id: productId,
          status: 'approved',
          deleted_at: null,
          ratings: { some: {} },
        },
      }),
      this.prisma.commentRating.aggregate({
        where: {
          title: 'Overall',
          comment: { product_id: productId, status: 'approved', deleted_at: null },
        },
        _avg: { value: true },
      }),
    ]);

    return {
      review_count: reviewCount,
      average_rating: ratingAgg._avg.value
        ? Math.round(ratingAgg._avg.value * 10) / 10
        : null,
    };
  }

  private async transformProduct(product: any) {
    const base = this.buildProductBase(product);
    const stats = await this.getRatingStats(product.id);
    return { ...base, ...stats };
  }

  async getInventoryStats(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { stock_quantity: true, stock_status: true, product_type: true },
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const [inCarts, purchasedNotShipped, historicalShipped] = await Promise.all([
      this.prisma.cartItem.aggregate({
        where: { product_id: productId },
        _sum: { quantity: true },
      }),
      this.prisma.orderItem.aggregate({
        where: {
          product_id: productId,
          order: { status: { in: ['processing', 'scheduled'] } },
        },
        _sum: { quantity: true },
      }),
      this.prisma.orderItem.aggregate({
        where: {
          product_id: productId,
          order: { status: { in: ['shipped', 'completed'] } },
        },
        _sum: { quantity: true },
      }),
    ]);

    return {
      product_type: product.product_type,
      stock_quantity: product.stock_quantity,
      stock_status: product.stock_status,
      units_in_carts: inCarts._sum.quantity ?? 0,
      units_purchased_not_shipped: purchasedNotShipped._sum.quantity ?? 0,
      units_available: product.stock_quantity,
      units_shipped_total: historicalShipped._sum.quantity ?? 0,
    };
  }
}
