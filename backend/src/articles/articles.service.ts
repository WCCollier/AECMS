import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto, QueryArticlesDto } from './dto';
import { Prisma, ContentStatus, ContentVisibility } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new article
   */
  async create(dto: CreateArticleDto, authorId: string) {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.title);

    // Check if slug already exists
    const existing = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(
        `Article with slug "${slug}" already exists`,
      );
    }

    // Validate featured image exists
    if (dto.featured_image_id) {
      const image = await this.prisma.media.findUnique({
        where: { id: dto.featured_image_id },
      });
      if (!image) {
        throw new BadRequestException('Featured image not found');
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

    // Create article with relationships
    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt,
        featured_image: dto.featured_image_id
          ? { connect: { id: dto.featured_image_id } }
          : undefined,
        status: dto.status || 'draft',
        visibility: dto.visibility || 'public',
        meta_title: dto.meta_title,
        meta_description: dto.meta_description,
        version_control_enabled: dto.version_control_enabled || false,
        author_can_edit: dto.author_can_edit ?? true,
        author_can_delete: dto.author_can_delete ?? true,
        admin_can_edit: dto.admin_can_edit ?? true,
        admin_can_delete: dto.admin_can_delete ?? true,
        author: { connect: { id: authorId } },
        published_at:
          dto.status === 'published' ? new Date() : null,
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
      include: {
        author: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        featured_image: true,
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
      },
    });

    // Create initial version if versioning is enabled
    if (dto.version_control_enabled) {
      await this.createVersion(
        article.id,
        dto.title,
        dto.content,
        authorId,
        'Initial version',
      );
    }

    return this.transformArticle(article);
  }

  /**
   * Find all articles with filtering and pagination
   */
  async findAll(query: QueryArticlesDto, userId?: string, isAdmin = false) {
    const {
      status,
      visibility,
      category_id,
      tag_id,
      author_id,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ArticleWhereInput = {};

    // Status filter
    if (status) {
      where.status = status;
    }

    // Visibility filter based on user permissions
    if (!isAdmin) {
      if (userId) {
        // Logged-in users can see public and logged_in_only
        where.visibility = {
          in: [ContentVisibility.public, ContentVisibility.logged_in_only],
        };
      } else {
        // Guests can only see public
        where.visibility = ContentVisibility.public;
      }
    }
    // Admins can see all visibility levels

    // Additional visibility filter if specified
    if (visibility && isAdmin) {
      where.visibility = visibility;
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

    // Author filter
    if (author_id) {
      where.author_id = author_id;
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          author: {
            select: { id: true, email: true, first_name: true, last_name: true },
          },
          featured_image: true,
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
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles.map((article) => this.transformArticle(article)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find article by ID
   */
  async findById(id: string, userId?: string, isAdmin = false) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        featured_image: true,
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
        _count: {
          select: { comments: true, versions: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(article, userId, isAdmin);

    return this.transformArticle(article);
  }

  /**
   * Find article by slug
   */
  async findBySlug(slug: string, userId?: string, isAdmin = false) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        featured_image: true,
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
        _count: {
          select: { comments: true, versions: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(article, userId, isAdmin);

    return this.transformArticle(article);
  }

  /**
   * Update article
   */
  async update(
    id: string,
    dto: UpdateArticleDto,
    userId: string,
    isAdmin = false,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Check edit permissions
    this.checkEditAccess(article, userId, isAdmin);

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== article.slug) {
      const existing = await this.prisma.article.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(
          `Article with slug "${dto.slug}" already exists`,
        );
      }
    }

    // Validate featured image if changing
    if (dto.featured_image_id) {
      const image = await this.prisma.media.findUnique({
        where: { id: dto.featured_image_id },
      });
      if (!image) {
        throw new BadRequestException('Featured image not found');
      }
    }

    // Handle status change to published
    let published_at = article.published_at;
    if (
      dto.status === ContentStatus.published &&
      article.status !== ContentStatus.published
    ) {
      published_at = new Date();
    }

    // Prepare update data
    const updateData: Prisma.ArticleUpdateInput = {
      title: dto.title,
      slug: dto.slug,
      content: dto.content,
      excerpt: dto.excerpt,
      status: dto.status,
      visibility: dto.visibility,
      meta_title: dto.meta_title,
      meta_description: dto.meta_description,
      version_control_enabled: dto.version_control_enabled,
      author_can_edit: dto.author_can_edit,
      author_can_delete: dto.author_can_delete,
      admin_can_edit: dto.admin_can_edit,
      admin_can_delete: dto.admin_can_delete,
      published_at,
    };

    // Handle featured image update
    if (dto.featured_image_id !== undefined) {
      if (dto.featured_image_id) {
        updateData.featured_image = { connect: { id: dto.featured_image_id } };
      } else {
        updateData.featured_image = { disconnect: true };
      }
    }

    // Handle category updates
    if (dto.category_ids !== undefined) {
      // Delete existing categories
      await this.prisma.articleCategory.deleteMany({
        where: { article_id: id },
      });
      // Create new categories
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
      // Delete existing tags
      await this.prisma.articleTag.deleteMany({
        where: { article_id: id },
      });
      // Create new tags
      if (dto.tag_ids.length > 0) {
        updateData.tags = {
          create: dto.tag_ids.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        };
      }
    }

    // Update article
    const updated = await this.prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        featured_image: true,
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
      },
    });

    // Create version if enabled and content changed
    if (
      article.version_control_enabled &&
      dto.content &&
      dto.content !== article.content
    ) {
      await this.createVersion(
        id,
        dto.title || article.title,
        dto.content,
        userId,
        'Content updated',
      );
    }

    return this.transformArticle(updated);
  }

  /**
   * Delete article
   */
  async remove(id: string, userId: string, isAdmin = false) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Check delete permissions
    this.checkDeleteAccess(article, userId, isAdmin);

    // Delete article (cascades to relationships)
    await this.prisma.article.delete({
      where: { id },
    });
  }

  /**
   * Generate slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .substring(0, 200); // Limit length
  }

  /**
   * Create version record
   */
  private async createVersion(
    articleId: string,
    title: string,
    content: string,
    createdBy: string,
    summary: string,
  ) {
    // Get version number
    const lastVersion = await this.prisma.articleVersion.findFirst({
      where: { article_id: articleId },
      orderBy: { version_number: 'desc' },
    });

    const versionNumber = lastVersion ? lastVersion.version_number + 1 : 1;

    await this.prisma.articleVersion.create({
      data: {
        article: { connect: { id: articleId } },
        version_number: versionNumber,
        title,
        content,
        created_by: createdBy,
        change_summary: summary,
      },
    });

    // Update article current_version
    await this.prisma.article.update({
      where: { id: articleId },
      data: { current_version: versionNumber },
    });
  }

  /**
   * Check visibility access
   */
  private checkVisibilityAccess(
    article: any,
    userId?: string,
    isAdmin = false,
  ) {
    if (isAdmin) {
      return; // Admins can see everything
    }

    if (article.visibility === ContentVisibility.admin_only) {
      throw new ForbiddenException('Access denied');
    }

    if (
      article.visibility === ContentVisibility.logged_in_only &&
      !userId
    ) {
      throw new ForbiddenException('Login required');
    }
  }

  /**
   * Check edit access
   */
  private checkEditAccess(article: any, userId: string, isAdmin: boolean) {
    // Owner always has access
    if (article.author_id === userId && article.author_can_edit) {
      return;
    }

    // Admin access
    if (isAdmin && article.admin_can_edit) {
      return;
    }

    throw new ForbiddenException('You do not have permission to edit this article');
  }

  /**
   * Check delete access
   */
  private checkDeleteAccess(article: any, userId: string, isAdmin: boolean) {
    // Owner always has access
    if (article.author_id === userId && article.author_can_delete) {
      return;
    }

    // Admin access
    if (isAdmin && article.admin_can_delete) {
      return;
    }

    throw new ForbiddenException('You do not have permission to delete this article');
  }

  /**
   * Transform article response
   */
  private transformArticle(article: any) {
    return {
      ...article,
      categories: article.categories?.map((ac: any) => ac.category) || [],
      tags: article.tags?.map((at: any) => at.tag) || [],
      comment_count: article._count?.comments || 0,
      version_count: article._count?.versions || 0,
    };
  }
}
