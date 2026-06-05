import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto, QueryArticlesDto } from './dto';
import { Prisma, ContentStatus, ContentVisibility } from '@prisma/client';
import { AuditLogService, diffChanges } from '../audit/audit.service';

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  private getMediaInclude() {
    return {
      media: {
        include: { media: true },
        orderBy: { order: 'asc' as const },
      },
    };
  }

  private getArticleInclude(withCounts = false) {
    return {
      author: { select: { id: true, email: true, first_name: true, last_name: true } },
      ...this.getMediaInclude(),
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      ...(withCounts ? { _count: { select: { comments: true, versions: true } } } : {}),
    };
  }

  /**
   * Write article_media junction rows for an article, replacing any existing set.
   * First item in array is primary.
   */
  private async setArticleMedia(articleId: string, mediaIds: string[]) {
    await this.prisma.articleMedia.deleteMany({ where: { article_id: articleId } });
    if (mediaIds.length === 0) return;

    await this.prisma.articleMedia.createMany({
      data: mediaIds.map((mediaId, index) => ({
        article_id: articleId,
        media_id: mediaId,
        order: index,
        is_primary: index === 0,
      })),
    });
  }

  /**
   * Create a new article
   */
  async create(dto: CreateArticleDto, authorId: string) {
    const slug = dto.slug || this.generateSlug(dto.title);

    const existing = await this.prisma.article.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Article with slug "${slug}" already exists`);

    if (dto.category_ids?.length) {
      const cats = await this.prisma.category.findMany({ where: { id: { in: dto.category_ids } } });
      if (cats.length !== dto.category_ids.length) throw new BadRequestException('One or more categories not found');
    }

    if (dto.tag_ids?.length) {
      const tags = await this.prisma.tag.findMany({ where: { id: { in: dto.tag_ids } } });
      if (tags.length !== dto.tag_ids.length) throw new BadRequestException('One or more tags not found');
    }

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt,
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
        published_at: dto.status === 'published' ? new Date() : null,
        categories: dto.category_ids
          ? { create: dto.category_ids.map((id) => ({ category: { connect: { id } } })) }
          : undefined,
        tags: dto.tag_ids
          ? { create: dto.tag_ids.map((id) => ({ tag: { connect: { id } } })) }
          : undefined,
      },
      include: this.getArticleInclude(),
    });

    if (dto.media_ids?.length) {
      await this.setArticleMedia(article.id, dto.media_ids);
    }

    if (dto.status === 'published') {
      await this.createVersion(article.id, dto.title, dto.content, authorId, 'Published');
    } else if (dto.version_control_enabled) {
      await this.createVersion(article.id, dto.title, dto.content, authorId, 'Initial version');
    }

    await this.auditLog.log({
      event_type: 'article.created',
      user_id: authorId,
      resource_type: 'article',
      resource_id: article.id,
      metadata: { title: dto.title, slug, status: dto.status || 'draft' },
    });

    const fresh = await this.prisma.article.findUnique({
      where: { id: article.id },
      include: this.getArticleInclude(true),
    });
    return this.transformArticle(fresh!);
  }

  /**
   * Find all articles with filtering and pagination
   */
  async findAll(
    query: QueryArticlesDto,
    userId?: string,
    isAdmin = false,
    canDeleteOwn = false,
    canDeleteAny = false,
  ) {
    const {
      status, visibility, category_id, category, tag_id, tag,
      author_id, search, page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'desc',
      include_deleted,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.ArticleWhereInput = {};

    if (isAdmin && include_deleted) {
      if (canDeleteAny) {
        where.deleted_at = { not: null };
      } else if (canDeleteOwn && userId) {
        where.deleted_at = { not: null };
        where.author_id = userId;
      } else {
        where.deleted_at = null; // no delete capability — fall back to normal listing
      }
    } else {
      where.deleted_at = null;
    }

    // Non-admins can only ever see published articles.
    if (!isAdmin) {
      where.status = ContentStatus.published;
      where.visibility = userId
        ? { in: [ContentVisibility.public, ContentVisibility.logged_in_only] }
        : ContentVisibility.public;
    } else {
      if (status) where.status = status;
      if (visibility) where.visibility = visibility;
    }

    if (category_id) where.categories = { some: { category_id } };
    else if (category) where.categories = { some: { category: { slug: category } } };

    if (tag_id) where.tags = { some: { tag_id } };
    else if (tag) where.tags = { some: { tag: { slug: tag } } };

    if (author_id) where.author_id = author_id;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where, skip, take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          ...this.getArticleInclude(),
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles.map((a) => this.transformArticle(a)),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Find article by ID
   */
  async findById(id: string, userId?: string, isAdmin = false) {
    const article = await this.prisma.article.findFirst({
      where: { id, deleted_at: null },
      include: this.getArticleInclude(true),
    });
    if (!article) throw new NotFoundException('Article not found');
    this.checkVisibilityAccess(article, userId, isAdmin);
    return this.transformArticle(article);
  }

  /**
   * Find article by slug
   */
  async findBySlug(slug: string, userId?: string, isAdmin = false) {
    const article = await this.prisma.article.findFirst({
      where: { slug, deleted_at: null },
      include: this.getArticleInclude(true),
    });
    if (!article) throw new NotFoundException('Article not found');
    this.checkVisibilityAccess(article, userId, isAdmin);
    return this.transformArticle(article);
  }

  /**
   * Update article
   */
  async update(id: string, dto: UpdateArticleDto, userId: string, canEditOwn = false, canEditAny = false) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    this.checkEditAccess(article, userId, canEditOwn, canEditAny);

    if (dto.slug && dto.slug !== article.slug) {
      const existing = await this.prisma.article.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`Article with slug "${dto.slug}" already exists`);
    }

    let published_at = article.published_at;
    if (dto.status === ContentStatus.published && article.status !== ContentStatus.published) {
      published_at = new Date();
    }

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

    if (dto.category_ids !== undefined) {
      await this.prisma.articleCategory.deleteMany({ where: { article_id: id } });
      if (dto.category_ids.length > 0) {
        updateData.categories = {
          create: dto.category_ids.map((catId) => ({ category: { connect: { id: catId } } })),
        };
      }
    }

    if (dto.tag_ids !== undefined) {
      await this.prisma.articleTag.deleteMany({ where: { article_id: id } });
      if (dto.tag_ids.length > 0) {
        updateData.tags = {
          create: dto.tag_ids.map((tagId) => ({ tag: { connect: { id: tagId } } })),
        };
      }
    }

    await this.prisma.article.update({ where: { id }, data: updateData });

    if (dto.media_ids !== undefined) {
      await this.setArticleMedia(id, dto.media_ids);
    }

    const isPublishing = dto.status === ContentStatus.published && article.status !== ContentStatus.published;
    const isUpdatingPublished = article.status === ContentStatus.published;
    if (isPublishing || isUpdatingPublished) {
      const summary = (dto as any).change_summary ?? (isPublishing ? 'Published' : 'Updated');
      await this.createVersion(id, dto.title ?? article.title, dto.content ?? article.content, userId, summary);
    }

    const eventType = isPublishing ? 'article.published'
      : dto.status === 'archived' && article.status === ContentStatus.published ? 'article.unpublished'
      : 'article.updated';
    const diff = diffChanges(article as any, dto as any);
    await this.auditLog.log({
      event_type: eventType,
      user_id: userId,
      resource_type: 'article',
      resource_id: id,
      changes: Object.keys(diff.before).length ? diff : undefined,
    });

    const updated = await this.prisma.article.findUnique({
      where: { id },
      include: this.getArticleInclude(true),
    });
    return this.transformArticle(updated!);
  }

  /**
   * Soft-delete article (sets deleted_at; preserves versions and audit trail)
   */
  async remove(id: string, userId: string, canDeleteOwn = false, canDeleteAny = false) {
    const article = await this.prisma.article.findFirst({ where: { id, deleted_at: null } });
    if (!article) throw new NotFoundException('Article not found');
    this.checkDeleteAccess(article, userId, canDeleteOwn, canDeleteAny);
    await this.prisma.article.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.auditLog.log({
      event_type: 'article.deleted',
      user_id: userId,
      resource_type: 'article',
      resource_id: id,
      metadata: { title: article.title, slug: article.slug },
    });
  }

  /**
   * Restore a soft-deleted article (clears deleted_at, reverts to draft)
   */
  async restore(id: string, userId: string, canDeleteOwn = false, canDeleteAny = false) {
    const article = await this.prisma.article.findFirst({ where: { id, deleted_at: { not: null } } });
    if (!article) throw new NotFoundException('Deleted article not found');
    if (!canDeleteAny && !canDeleteOwn) {
      throw new ForbiddenException('You do not have permission to restore this article');
    }
    if (!canDeleteAny && canDeleteOwn && article.author_id !== userId) {
      throw new ForbiddenException('You can only restore your own articles');
    }
    await this.prisma.article.update({
      where: { id },
      data: { deleted_at: null, status: 'draft' },
    });
    await this.auditLog.log({
      event_type: 'article.updated',
      user_id: userId,
      resource_type: 'article',
      resource_id: id,
      metadata: { title: article.title, action: 'restored_from_trash' },
    });
  }

  async getVersions(articleId: string, page = 1, limit = 20) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    const skip = (page - 1) * limit;
    const [versions, total] = await Promise.all([
      this.prisma.articleVersion.findMany({
        where: { article_id: articleId },
        orderBy: { version_number: 'desc' },
        skip,
        take: limit,
        select: { id: true, version_number: true, title: true, change_summary: true, created_by: true, created_at: true },
      }),
      this.prisma.articleVersion.count({ where: { article_id: articleId } }),
    ]);
    return { data: versions, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getVersion(articleId: string, versionNumber: number) {
    const version = await this.prisma.articleVersion.findUnique({
      where: { article_id_version_number: { article_id: articleId, version_number: versionNumber } },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async restoreVersion(articleId: string, versionNumber: number, userId: string) {
    const version = await this.getVersion(articleId, versionNumber);
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    await this.prisma.article.update({
      where: { id: articleId },
      data: { title: version.title, content: version.content, status: 'draft' },
    });

    await this.createVersion(articleId, version.title, version.content, userId, `Restored from version ${versionNumber}`);
    await this.auditLog.log({
      event_type: 'article.updated',
      user_id: userId,
      resource_type: 'article',
      resource_id: articleId,
      metadata: { restored_from_version: versionNumber },
    });

    const updated = await this.prisma.article.findUnique({ where: { id: articleId }, include: this.getArticleInclude(true) });
    return this.transformArticle(updated!);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200);
  }

  private async createVersion(articleId: string, title: string, content: string, createdBy: string, summary: string) {
    const last = await this.prisma.articleVersion.findFirst({
      where: { article_id: articleId },
      orderBy: { version_number: 'desc' },
    });
    const versionNumber = last ? last.version_number + 1 : 1;
    await this.prisma.articleVersion.create({
      data: { article: { connect: { id: articleId } }, version_number: versionNumber, title, content, created_by: createdBy, change_summary: summary },
    });
    await this.prisma.article.update({ where: { id: articleId }, data: { current_version: versionNumber } });
  }

  private checkVisibilityAccess(article: any, userId?: string, isAdmin = false) {
    if (isAdmin) return;
    if (article.visibility === ContentVisibility.admin_only) throw new ForbiddenException('Access denied');
    if (article.visibility === ContentVisibility.logged_in_only && !userId) throw new ForbiddenException('Login required');
  }

  private checkEditAccess(article: any, userId: string, canEditOwn: boolean, canEditAny: boolean) {
    if (canEditAny && article.admin_can_edit) return;
    if (canEditOwn && article.author_id === userId && article.author_can_edit) return;
    throw new ForbiddenException('You do not have permission to edit this article');
  }

  private checkDeleteAccess(article: any, userId: string, canDeleteOwn: boolean, canDeleteAny: boolean) {
    if (canDeleteAny && article.admin_can_delete) return;
    if (canDeleteOwn && article.author_id === userId && article.author_can_delete) return;
    throw new ForbiddenException('You do not have permission to delete this article');
  }

  private mediaUrl(filePath: string | null | undefined): string | null {
    if (!filePath) return null;
    const uploadsBase = path.join(process.cwd(), 'uploads');
    const rel = path.relative(uploadsBase, filePath);
    return `/uploads/${rel}`;
  }

  private transformArticle(article: any) {
    const mediaItems = (article.media || []).map((am: any) => ({
      id: am.media.id,
      url: this.mediaUrl(am.media.file_path),
      order: am.order,
      is_primary: am.is_primary,
      alt_text: am.media.alt_text ?? null,
    }));

    const primaryMedia = mediaItems.find((m: any) => m.is_primary) ?? mediaItems[0] ?? null;

    return {
      ...article,
      media: mediaItems,
      featured_image_url: primaryMedia?.url ?? null,
      categories: article.categories?.map((ac: any) => ac.category) || [],
      tags: article.tags?.map((at: any) => at.tag) || [],
      comment_count: article._count?.comments || 0,
      version_count: article._count?.versions || 0,
    };
  }
}
