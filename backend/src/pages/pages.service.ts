import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto, QueryPagesDto } from './dto';
import { Prisma, ContentVisibility } from '@prisma/client';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new page
   */
  async create(dto: CreatePageDto, authorId: string) {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.title);

    // Check if slug already exists
    const existing = await this.prisma.page.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Page with slug "${slug}" already exists`);
    }

    // Validate parent page exists if provided
    if (dto.parent_id) {
      const parent = await this.prisma.page.findUnique({
        where: { id: dto.parent_id },
      });
      if (!parent) {
        throw new BadRequestException('Parent page not found');
      }
    }

    // Create page
    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        parent: dto.parent_id ? { connect: { id: dto.parent_id } } : undefined,
        template: dto.template || 'full-width',
        status: dto.status || 'draft',
        visibility: dto.visibility || 'public',
        meta_title: dto.meta_title,
        meta_description: dto.meta_description,
        author_can_edit: dto.author_can_edit ?? true,
        author_can_delete: dto.author_can_delete ?? true,
        admin_can_edit: dto.admin_can_edit ?? true,
        admin_can_delete: dto.admin_can_delete ?? true,
        published_at: dto.status === 'published' ? new Date() : null,
      },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    return this.transformPage(page);
  }

  /**
   * Find all pages with filtering and pagination
   */
  async findAll(query: QueryPagesDto, userId?: string, isAdmin = false) {
    const {
      status,
      visibility,
      parent_id,
      root_only,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PageWhereInput = {};

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
    }

    // Additional visibility filter if specified
    if (visibility && isAdmin) {
      where.visibility = visibility;
    }

    // Parent filter
    if (parent_id) {
      where.parent_id = parent_id;
    }

    // Root pages only
    if (root_only) {
      where.parent_id = null;
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries
    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          parent: {
            select: { id: true, title: true, slug: true },
          },
          children: {
            select: { id: true, title: true, slug: true },
          },
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      data: pages.map((page) => this.transformPage(page)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get page hierarchy (tree structure)
   */
  async getHierarchy(userId?: string, isAdmin = false) {
    // Build visibility filter
    const visibilityFilter = isAdmin
      ? {}
      : userId
        ? { visibility: { in: [ContentVisibility.public, ContentVisibility.logged_in_only] } }
        : { visibility: ContentVisibility.public };

    // Get all pages
    const pages = await this.prisma.page.findMany({
      where: {
        ...visibilityFilter,
        status: 'published',
      },
      select: {
        id: true,
        title: true,
        slug: true,
        parent_id: true,
        template: true,
      },
      orderBy: { title: 'asc' },
    });

    // Build tree structure
    return this.buildTree(pages);
  }

  /**
   * Find page by ID
   */
  async findById(id: string, userId?: string, isAdmin = false) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(page, userId, isAdmin);

    return this.transformPage(page);
  }

  /**
   * Find page by slug
   */
  async findBySlug(slug: string, userId?: string, isAdmin = false) {
    const page = await this.prisma.page.findUnique({
      where: { slug },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check visibility permissions
    this.checkVisibilityAccess(page, userId, isAdmin);

    return this.transformPage(page);
  }

  /**
   * Update page
   */
  async update(id: string, dto: UpdatePageDto, userId: string, isAdmin = false) {
    const page = await this.prisma.page.findUnique({
      where: { id },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check edit permissions
    this.checkEditAccess(page, userId, isAdmin);

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== page.slug) {
      const existing = await this.prisma.page.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(`Page with slug "${dto.slug}" already exists`);
      }
    }

    // Validate parent page if changing
    if (dto.parent_id !== undefined) {
      if (dto.parent_id) {
        // Check parent exists
        const parent = await this.prisma.page.findUnique({
          where: { id: dto.parent_id },
        });
        if (!parent) {
          throw new BadRequestException('Parent page not found');
        }
        // Prevent circular reference
        if (dto.parent_id === id) {
          throw new BadRequestException('Page cannot be its own parent');
        }
        // Check if parent is a descendant of this page
        const isDescendant = await this.isDescendant(dto.parent_id, id);
        if (isDescendant) {
          throw new BadRequestException('Cannot set a descendant as parent');
        }
      }
    }

    // Handle status change to published
    let published_at = page.published_at;
    if (dto.status === 'published' && page.status !== 'published') {
      published_at = new Date();
    }

    // Prepare update data
    const updateData: Prisma.PageUpdateInput = {
      title: dto.title,
      slug: dto.slug,
      content: dto.content,
      template: dto.template,
      status: dto.status,
      visibility: dto.visibility,
      meta_title: dto.meta_title,
      meta_description: dto.meta_description,
      author_can_edit: dto.author_can_edit,
      author_can_delete: dto.author_can_delete,
      admin_can_edit: dto.admin_can_edit,
      admin_can_delete: dto.admin_can_delete,
      published_at,
    };

    // Handle parent update
    if (dto.parent_id !== undefined) {
      if (dto.parent_id) {
        updateData.parent = { connect: { id: dto.parent_id } };
      } else {
        updateData.parent = { disconnect: true };
      }
    }

    // Update page
    const updated = await this.prisma.page.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    return this.transformPage(updated);
  }

  /**
   * Delete page
   */
  async remove(id: string, userId: string, isAdmin = false) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check delete permissions
    this.checkDeleteAccess(page, userId, isAdmin);

    // Check if page has children
    if (page.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete page with child pages. Delete or move child pages first.',
      );
    }

    // Delete page
    await this.prisma.page.delete({
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
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200);
  }

  /**
   * Build tree structure from flat list
   */
  private buildTree(pages: any[], parentId: string | null = null): any[] {
    return pages
      .filter((page) => page.parent_id === parentId)
      .map((page) => ({
        ...page,
        children: this.buildTree(pages, page.id),
      }));
  }

  /**
   * Check if pageId is a descendant of ancestorId
   */
  private async isDescendant(
    pageId: string,
    ancestorId: string,
  ): Promise<boolean> {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { parent_id: true },
    });

    if (!page || !page.parent_id) {
      return false;
    }

    if (page.parent_id === ancestorId) {
      return true;
    }

    return this.isDescendant(page.parent_id, ancestorId);
  }

  /**
   * Check visibility access
   */
  private checkVisibilityAccess(page: any, userId?: string, isAdmin = false) {
    if (isAdmin) {
      return;
    }

    if (page.visibility === ContentVisibility.admin_only) {
      throw new ForbiddenException('Access denied');
    }

    if (page.visibility === ContentVisibility.logged_in_only && !userId) {
      throw new ForbiddenException('Login required');
    }
  }

  /**
   * Check edit access
   */
  private checkEditAccess(page: any, userId: string, isAdmin: boolean) {
    // For pages, we don't track author_id, so only admins can edit
    // unless specific permissions are set
    if (isAdmin && page.admin_can_edit) {
      return;
    }

    throw new ForbiddenException('You do not have permission to edit this page');
  }

  /**
   * Check delete access
   */
  private checkDeleteAccess(page: any, userId: string, isAdmin: boolean) {
    if (isAdmin && page.admin_can_delete) {
      return;
    }

    throw new ForbiddenException('You do not have permission to delete this page');
  }

  /**
   * Transform page response
   */
  private transformPage(page: any) {
    return {
      ...page,
      children_count: page.children?.length || 0,
    };
  }
}
