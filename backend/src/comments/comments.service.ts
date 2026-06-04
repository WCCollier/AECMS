import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { CreateCommentDto, UpdateCommentDto, QueryCommentsDto } from './dto';
import { CommentStatus, ModerationStatus, User } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private capabilitiesService: CapabilitiesService,
    private auditLog: AuditLogService,
  ) {}

  // ── Shared Prisma includes ────────────────────────────────────────────────

  private commentInclude(includeProduct = false) {
    return {
      user: { select: { id: true, email: true, first_name: true, last_name: true } },
      ratings: { orderBy: { title: 'asc' as const } },
      article: { select: { id: true, title: true, slug: true } },
      ...(includeProduct && {
        product: { select: { id: true, name: true, slug: true } },
      }),
    };
  }

  private replyInclude() {
    return {
      user: { select: { id: true, email: true, first_name: true, last_name: true } },
      ratings: { orderBy: { title: 'asc' as const } },
    };
  }

  // ── Public: create ────────────────────────────────────────────────────────

  /**
   * Create a comment or review. All comments require authentication.
   * A comment becomes a review when ratings[] is provided; the first entry
   * must have title "Overall". Product reviews additionally require a
   * verified purchase (completed/processing order containing the product).
   */
  async create(dto: CreateCommentDto, user: User) {
    if (!dto.article_id && !dto.product_id) {
      throw new BadRequestException('Either article_id or product_id is required');
    }

    const isReview = !!dto.ratings?.length;

    // Capability check — Owner bypasses; all others must hold the matching capability.
    // The required capability depends on target type and whether ratings are included.
    if (user.role !== 'owner') {
      const requiredCap = dto.product_id
        ? (isReview ? 'review.product' : 'comment.product')
        : (isReview ? 'review.article' : 'comment.article');
      const allowed = await this.capabilitiesService.userHasCapability(user.id, requiredCap);
      if (!allowed) {
        throw new ForbiddenException(`Requires the '${requiredCap}' capability`);
      }
    }

    if (isReview && dto.ratings![0].title !== 'Overall') {
      throw new BadRequestException('First rating must have title "Overall"');
    }

    // Verify target exists and is published
    if (dto.article_id) {
      const article = await this.prisma.article.findUnique({ where: { id: dto.article_id } });
      if (!article) throw new NotFoundException('Article not found');
      if (article.status !== 'published') {
        throw new BadRequestException('Cannot comment on unpublished articles');
      }
    }

    let verifiedPurchase = false;

    if (dto.product_id) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.product_id } });
      if (!product || product.deleted_at) throw new NotFoundException('Product not found');
      if (product.status !== 'published') {
        throw new BadRequestException('Cannot comment on unpublished products');
      }

      if (isReview) {
        const order = await this.prisma.order.findFirst({
          where: {
            user_id: user.id,
            status: { in: ['processing', 'completed'] },
            items: { some: { product_id: dto.product_id } },
          },
        });
        if (!order) {
          throw new ForbiddenException(
            'You must have purchased this product to leave a review',
          );
        }
        verifiedPurchase = true;
      }
    }

    // One review per user per item
    if (isReview) {
      const existing = await this.prisma.comment.findFirst({
        where: {
          user_id: user.id,
          ...(dto.article_id ? { article_id: dto.article_id } : { product_id: dto.product_id }),
          ratings: { some: {} },
          deleted_at: null,
        },
      });
      if (existing) {
        throw new ConflictException(
          'You have already reviewed this item. Edit your existing review instead.',
        );
      }
    }

    // Validate reply constraints
    if (dto.parent_id) {
      if (isReview) throw new BadRequestException('Replies cannot include ratings');
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parent_id } });
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (dto.article_id && parent.article_id !== dto.article_id) {
        throw new BadRequestException('Parent comment belongs to a different article');
      }
      if (dto.product_id && parent.product_id !== dto.product_id) {
        throw new BadRequestException('Parent comment belongs to a different product');
      }
      if (parent.parent_id) {
        throw new BadRequestException('Cannot reply to a reply (single-level nesting only)');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        article_id: dto.article_id ?? null,
        product_id: dto.product_id ?? null,
        user_id: user.id,
        content: dto.content,
        title: dto.title ?? null,
        verified_purchase: verifiedPurchase,
        parent_id: dto.parent_id ?? null,
        status: CommentStatus.approved,
        moderation_status: ModerationStatus.pending,
        ratings: isReview
          ? { create: dto.ratings!.map(r => ({ title: r.title, value: r.value })) }
          : undefined,
      },
      include: this.commentInclude(true),
    });

    this.moderateCommentAsync(comment.id, dto.content);
    return comment;
  }

  // ── Public: read ──────────────────────────────────────────────────────────

  async findByArticle(articleId: string, page = 1, limit = 20) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    const skip = (page - 1) * limit;
    const where = {
      article_id: articleId,
      parent_id: null,
      status: CommentStatus.approved,
      deleted_at: null,
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          ...this.replyInclude(),
          replies: {
            where: { status: CommentStatus.approved, deleted_at: null },
            include: this.replyInclude(),
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { data: comments, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  /**
   * Reviews (comments with ratings) are sorted first, then by Overall rating
   * descending, then by recency. Plain comments follow.
   */
  async findByProduct(productId: string, page = 1, limit = 20) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deleted_at) throw new NotFoundException('Product not found');

    const skip = (page - 1) * limit;
    const where = {
      product_id: productId,
      parent_id: null,
      status: CommentStatus.approved,
      deleted_at: null,
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          ...this.replyInclude(),
          replies: {
            where: { status: CommentStatus.approved, deleted_at: null },
            include: this.replyInclude(),
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    const sorted = [...comments].sort((a: any, b: any) => {
      const aRating = a.ratings.find((r: any) => r.title === 'Overall')?.value ?? null;
      const bRating = b.ratings.find((r: any) => r.title === 'Overall')?.value ?? null;
      if ((aRating !== null) !== (bRating !== null)) return aRating !== null ? -1 : 1;
      if (aRating !== null && bRating !== null && aRating !== bRating) return bRating - aRating;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { data: sorted, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { user_id: userId, deleted_at: null, parent_id: null };
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: this.commentInclude(true),
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { data: comments, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        ...this.commentInclude(true),
        replies: {
          where: { status: CommentStatus.approved, deleted_at: null },
          include: this.replyInclude(),
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    return comment;
  }

  // ── Public: update ────────────────────────────────────────────────────────

  /**
   * Update own comment. If ratings[] is provided it replaces all existing
   * ratings wholesale (delete + recreate in a transaction). An empty ratings[]
   * removes all ratings, converting a review back to a plain comment.
   */
  async update(id: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { ratings: true },
    });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    if (dto.ratings?.length) {
      if (dto.ratings[0].title !== 'Overall') {
        throw new BadRequestException('First rating must have title "Overall"');
      }
      if (comment.parent_id) {
        throw new BadRequestException('Replies cannot include ratings');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.ratings !== undefined) {
        await tx.commentRating.deleteMany({ where: { comment_id: id } });
        if (dto.ratings.length > 0) {
          await tx.commentRating.createMany({
            data: dto.ratings.map(r => ({ comment_id: id, title: r.title, value: r.value })),
          });
        }
      }

      return tx.comment.update({
        where: { id },
        data: {
          ...(dto.content !== undefined && { content: dto.content }),
          ...(dto.title !== undefined && { title: dto.title }),
          moderation_status: ModerationStatus.pending,
        },
        include: this.commentInclude(true),
      });
    });

    if (dto.content) this.moderateCommentAsync(id, dto.content);
    return updated;
  }

  // ── Public: delete ────────────────────────────────────────────────────────

  async remove(id: string, userId: string, isAdmin = false) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    if (!isAdmin && comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.update({ where: { id }, data: { deleted_at: new Date() } });
    return { message: 'Comment deleted successfully' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryCommentsDto) {
    const { article_id, product_id, status, moderation_status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { deleted_at: null };
    if (article_id) where.article_id = article_id;
    if (product_id) where.product_id = product_id;
    if (status) where.status = status;
    if (moderation_status) where.moderation_status = moderation_status;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: this.commentInclude(true),
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { data: comments, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  async findFlagged(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      deleted_at: null,
      OR: [
        { moderation_status: ModerationStatus.pending },
        { moderation_status: ModerationStatus.flagged },
      ],
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: this.commentInclude(true),
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { data: comments, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  async approve(id: string, actorId?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { status: CommentStatus.approved, moderation_status: ModerationStatus.approved },
      include: this.commentInclude(),
    });
    await this.auditLog.log({
      event_type: 'comment.moderated',
      user_id: actorId,
      resource_type: 'comment',
      resource_id: id,
      changes: { before: { status: comment.status }, after: { status: 'approved' } },
      metadata: { moderation_type: 'manual' },
    });
    return updated;
  }

  async reject(id: string, actorId?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { status: CommentStatus.rejected, moderation_status: ModerationStatus.rejected },
      include: this.commentInclude(),
    });
    await this.auditLog.log({
      event_type: 'comment.moderated',
      user_id: actorId,
      resource_type: 'comment',
      resource_id: id,
      changes: { before: { status: comment.status }, after: { status: 'rejected' } },
      metadata: { moderation_type: 'manual' },
    });
    return updated;
  }

  async markAsSpam(id: string, actorId?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deleted_at) throw new NotFoundException('Comment not found');
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { status: CommentStatus.spam, moderation_status: ModerationStatus.rejected },
      include: this.commentInclude(),
    });
    await this.auditLog.log({
      event_type: 'comment.moderated',
      user_id: actorId,
      resource_type: 'comment',
      resource_id: id,
      changes: { before: { status: comment.status }, after: { status: 'spam' } },
      metadata: { moderation_type: 'manual' },
    });
    return updated;
  }

  async updateModerationFlags(id: string, flags: string[], profanityDetected: boolean) {
    return this.prisma.comment.update({
      where: { id },
      data: {
        moderation_flags: flags,
        profanity_detected: profanityDetected,
        moderation_status: flags.length > 0 || profanityDetected
          ? ModerationStatus.flagged
          : ModerationStatus.approved,
      },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async moderateCommentAsync(commentId: string, content: string) {
    try {
      const result = await this.moderationService.moderate(content);
      await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          moderation_flags: result.flags,
          profanity_detected: result.profanityDetected,
          moderation_status: result.flagged ? ModerationStatus.flagged : ModerationStatus.approved,
        },
      });
      if (result.flagged) {
        this.logger.log(`Comment ${commentId} flagged: ${result.flags.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Failed to moderate comment ${commentId}:`, error);
    }
  }
}
