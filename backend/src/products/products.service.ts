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

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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

    // Check if SKU already exists
    if (dto.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (existingSku) {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
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
        sku: dto.sku,
        stock_quantity: dto.stock_quantity ?? 0,
        stock_status: dto.stock_status || 'in_stock',
        status: dto.status || 'draft',
        visibility: dto.visibility || 'public',
        guest_purchaseable: dto.guest_purchaseable ?? false,
        product_type: dto.product_type || 'physical',
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

    return this.transformProduct(product);
  }

  /**
   * Find all products with filtering and pagination
   */
  async findAll(query: QueryProductsDto, userId?: string, isAdmin = false) {
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
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
    };

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
      data: products.map((product) => this.transformProduct(product)),
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
  async update(id: string, dto: UpdateProductDto, isAdmin = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check edit permissions
    if (!isAdmin || !product.admin_can_edit) {
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
      sku: dto.sku,
      stock_quantity: dto.stock_quantity,
      stock_status: dto.stock_status,
      status: dto.status,
      visibility: dto.visibility,
      guest_purchaseable: dto.guest_purchaseable,
      product_type: dto.product_type,
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

    return this.transformProduct(updated);
  }

  /**
   * Delete product (soft delete)
   */
  async remove(id: string, isAdmin = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Check delete permissions
    if (!isAdmin || !product.admin_can_delete) {
      throw new ForbiddenException('You do not have permission to delete this product');
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Update stock
   */
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
  private getProductIncludes() {
    return {
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
          reviews: true,
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
  private transformProduct(product: any) {
    return {
      ...product,
      price: parseFloat(product.price.toString()),
      categories: product.categories?.map((pc: any) => pc.category) || [],
      tags: product.tags?.map((pt: any) => pt.tag) || [],
      media: product.media?.map((pm: any) => pm.media) || [],
      review_count: product._count?.reviews || 0,
    };
  }
}
