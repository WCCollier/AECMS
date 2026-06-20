import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto, QueryPagesDto, ReorderPagesDto } from './dto';
import { Prisma, ContentVisibility } from '@prisma/client';
import { AuditLogService, diffChanges } from '../audit/audit.service';

const RESERVED_SLUGS = [
  'shop', 'articles', 'cart', 'checkout', 'account',
  'order-confirmation', 'admin', 'auth', 'api',
  '_home_', // system slug for the editable root landing page
];

@Injectable()
export class PagesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Create a new page
   */
  async create(dto: CreatePageDto, authorId: string) {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.title);

    // Check reserved slugs
    if (RESERVED_SLUGS.includes(slug)) {
      throw new ConflictException(`"${slug}" is reserved and cannot be used as a page slug`);
    }

    // Check sibling slug uniqueness (including soft-deleted pages)
    const siblingParentId = dto.parent_id ?? null;
    const existing = await this.prisma.page.findFirst({
      where: { parent_id: siblingParentId, slug },
    });
    if (existing) {
      if (existing.deleted_at) {
        throw new ConflictException(
          `The slug "${slug}" belongs to a deleted page. Choose a different title, or ask an administrator to restore the original page.`,
        );
      }
      throw new ConflictException(`Page with slug "${slug}" already exists at this level`);
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
        show_in_nav: (dto as any).show_in_nav ?? true,
        nav_order: (dto as any).nav_order ?? 0,
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

    await this.auditLog.log({
      event_type: 'page.created',
      user_id: authorId,
      resource_type: 'page',
      resource_id: page.id,
      metadata: { title: dto.title, slug, status: dto.status || 'draft' },
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
   * Find root page by slug (parent_id = null). Used for backward-compatible single-slug lookup.
   */
  async findBySlug(slug: string, userId?: string, isAdmin = false) {
    const page = await this.prisma.page.findFirst({
      where: { slug, parent_id: null, deleted_at: null },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          where: { deleted_at: null },
          select: { id: true, title: true, slug: true, show_in_nav: true, nav_order: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    this.checkVisibilityAccess(page, userId, isAdmin);
    return this.transformPage(page);
  }

  /**
   * Resolve a URL path like ['author', 'bio'] to the matching page.
   * Max 3 levels deep. Root-level pages have parent_id = null.
   */
  async findByPath(segments: string[], userId?: string, isAdmin = false) {
    if (segments.length === 0 || segments.length > 3) {
      throw new NotFoundException('Page not found');
    }

    // Find root page
    let page: any = await this.prisma.page.findFirst({
      where: { slug: segments[0], parent_id: null, deleted_at: null },
      include: { parent: { select: { id: true, title: true, slug: true } }, children: { where: { deleted_at: null }, select: { id: true, title: true, slug: true, show_in_nav: true, nav_order: true } } },
    });
    if (!page) throw new NotFoundException('Page not found');

    // Walk down for deeper segments
    for (let i = 1; i < segments.length; i++) {
      page = await this.prisma.page.findFirst({
        where: { slug: segments[i], parent_id: page.id, deleted_at: null },
        include: { parent: { select: { id: true, title: true, slug: true } }, children: { where: { deleted_at: null }, select: { id: true, title: true, slug: true, show_in_nav: true, nav_order: true } } },
      });
      if (!page) throw new NotFoundException('Page not found');
    }

    if (!isAdmin && page.status !== 'published') {
      throw new NotFoundException('Page not found');
    }

    this.checkVisibilityAccess(page, userId, isAdmin);
    return this.transformPage(page);
  }

  /**
   * Returns published, show_in_nav=true pages as a nav tree (max depth 3).
   */
  async getNavItems(userId?: string) {
    const where: any = {
      status: 'published',
      show_in_nav: true,
      deleted_at: null,
    };
    if (!userId) {
      where.visibility = 'public';
    } else {
      where.visibility = { in: ['public', 'logged_in_only'] };
    }

    const pages = await this.prisma.page.findMany({
      where,
      orderBy: [{ nav_order: 'asc' }, { title: 'asc' }],
      select: {
        id: true, title: true, slug: true, parent_id: true, nav_order: true,
        children: {
          where: { status: 'published', show_in_nav: true, deleted_at: null },
          orderBy: [{ nav_order: 'asc' }, { title: 'asc' }],
          select: {
            id: true, title: true, slug: true, parent_id: true, nav_order: true,
            children: {
              where: { status: 'published', show_in_nav: true, deleted_at: null },
              orderBy: [{ nav_order: 'asc' }, { title: 'asc' }],
              select: { id: true, title: true, slug: true, parent_id: true, nav_order: true },
            },
          },
        },
      },
    });

    // Only return root pages (parent_id = null) — children are already nested
    return pages.filter((p) => p.parent_id === null);
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

    // Prevent the system homepage page from having its slug changed
    if (page.slug === '_home_' && dto.slug && dto.slug !== '_home_') {
      throw new ConflictException('The system homepage slug "_home_" cannot be changed.');
    }

    // Check slug uniqueness if changing (within siblings only)
    if (dto.slug && dto.slug !== page.slug) {
      if (RESERVED_SLUGS.includes(dto.slug)) {
        throw new ConflictException(`"${dto.slug}" is reserved and cannot be used as a page slug`);
      }
      const siblingParentId = (dto.parent_id !== undefined ? dto.parent_id : page.parent_id) ?? null;
      const existing = await this.prisma.page.findFirst({
        where: { parent_id: siblingParentId, slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        if (existing.deleted_at) {
          throw new ConflictException(
            `The slug "${dto.slug}" belongs to a deleted page. Choose a different title, or ask an administrator to restore the original page.`,
          );
        }
        throw new ConflictException(`Page with slug "${dto.slug}" already exists at this level`);
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
      show_in_nav: (dto as any).show_in_nav,
      nav_order: (dto as any).nav_order,
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

    const isPublishing = dto.status === 'published' && page.status !== 'published';
    const isUpdatingPublished = page.status === 'published';
    if (isPublishing || isUpdatingPublished) {
      const summary = (dto as any).change_summary ?? (isPublishing ? 'Published' : 'Updated');
      await this.createPageVersion(id, dto.title ?? page.title, dto.content ?? page.content, userId, summary);
    }

    const eventType = isPublishing ? 'page.published'
      : dto.status === 'archived' && page.status === 'published' ? 'page.unpublished'
      : 'page.updated';
    const diff = diffChanges(page as any, dto as any);
    await this.auditLog.log({
      event_type: eventType,
      user_id: userId,
      resource_type: 'page',
      resource_id: id,
      changes: Object.keys(diff.before).length ? diff : undefined,
    });

    return this.transformPage(updated);
  }

  /**
   * Delete page
   */
  async reorder(dto: ReorderPagesDto): Promise<void> {
    if (!dto.pages.length) return;

    const records = await this.prisma.page.findMany({
      where: { id: { in: dto.pages.map((p) => p.id) }, deleted_at: null },
      select: { id: true, parent_id: true },
    });

    if (records.length !== dto.pages.length) {
      throw new BadRequestException('One or more pages not found');
    }

    const parentIds = new Set(records.map((r) => r.parent_id));
    if (parentIds.size > 1) {
      throw new BadRequestException('All pages must share the same parent');
    }

    await this.prisma.$transaction(
      dto.pages.map((p) =>
        this.prisma.page.update({ where: { id: p.id }, data: { nav_order: p.nav_order } }),
      ),
    );
  }

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

    // The _home_ page is a system fallback — it must not be deleted via API
    if (page.slug === '_home_') {
      throw new ForbiddenException('The system homepage page (_home_) cannot be deleted.');
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

    await this.auditLog.log({
      event_type: 'page.deleted',
      user_id: userId,
      resource_type: 'page',
      resource_id: id,
      metadata: { title: page.title, slug: page.slug },
    });
  }

  /**
   * Generate slug from title
   */
  private async createPageVersion(pageId: string, title: string, content: string, createdBy: string, summary?: string) {
    const last = await this.prisma.pageVersion.findFirst({
      where: { page_id: pageId },
      orderBy: { version_number: 'desc' },
    });
    await this.prisma.pageVersion.create({
      data: {
        page_id: pageId,
        version_number: (last?.version_number ?? 0) + 1,
        title,
        content,
        change_summary: summary ?? null,
        created_by: createdBy,
      },
    });
  }

  async getVersions(pageId: string, page = 1, limit = 20) {
    const pg = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!pg) throw new NotFoundException('Page not found');
    const skip = (page - 1) * limit;
    const [versions, total] = await Promise.all([
      this.prisma.pageVersion.findMany({
        where: { page_id: pageId },
        orderBy: { version_number: 'desc' },
        skip,
        take: limit,
        select: { id: true, version_number: true, title: true, change_summary: true, created_by: true, created_at: true },
      }),
      this.prisma.pageVersion.count({ where: { page_id: pageId } }),
    ]);
    return { data: versions, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getPageVersion(pageId: string, versionNumber: number) {
    const version = await this.prisma.pageVersion.findUnique({
      where: { page_id_version_number: { page_id: pageId, version_number: versionNumber } },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async restorePageVersion(pageId: string, versionNumber: number, userId: string) {
    const version = await this.getPageVersion(pageId, versionNumber);
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Page not found');

    await this.prisma.page.update({
      where: { id: pageId },
      data: { title: version.title, content: version.content, status: 'draft' },
    });

    await this.createPageVersion(pageId, version.title, version.content, userId, `Restored from version ${versionNumber}`);
    await this.auditLog.log({
      event_type: 'page.updated',
      user_id: userId,
      resource_type: 'page',
      resource_id: pageId,
      metadata: { restored_from_version: versionNumber },
    });

    const updated = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { parent: { select: { id: true, title: true, slug: true } }, children: { select: { id: true, title: true, slug: true } } },
    });
    return this.transformPage(updated!);
  }

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
