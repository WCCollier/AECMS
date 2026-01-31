import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateCommentDto, UpdateCommentDto, ModerateCommentDto, QueryCommentsDto } from './dto';
import { CommentStatus, ModerationStatus, User } from '@prisma/client';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  /**
   * Create a new comment on an article
   */
  async create(dto: CreateCommentDto, user: User) {
    // Verify article exists and is published
    const article = await this.prisma.article.findUnique({
      where: { id: dto.article_id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.status !== 'published') {
      throw new BadRequestException('Cannot comment on unpublished articles');
    }

    // If replying, verify parent comment exists and belongs to same article
    if (dto.parent_id) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parent_id },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.article_id !== dto.article_id) {
        throw new BadRequestException('Parent comment belongs to different article');
      }

      // Only allow single-level nesting
      if (parentComment.parent_id) {
        throw new BadRequestException('Cannot reply to a reply (single-level nesting only)');
      }
    }

    // Create comment with pending status (reactive moderation)
    const comment = await this.prisma.comment.create({
      data: {
        article_id: dto.article_id,
        user_id: user.id,
        content: dto.content,
        parent_id: dto.parent_id,
        status: CommentStatus.approved, // Reactive: post immediately
        moderation_status: ModerationStatus.pending, // Flag for review
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Run moderation asynchronously (don't block response)
    this.moderateCommentAsync(comment.id, dto.content);

    return comment;
  }

  /**
   * Run moderation on a comment asynchronously
   */
  private async moderateCommentAsync(commentId: string, content: string) {
    try {
      const result = await this.moderationService.moderate(content);

      // Update comment with moderation results
      await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          moderation_flags: result.flags,
          profanity_detected: result.profanityDetected,
          moderation_status: result.flagged
            ? ModerationStatus.flagged
            : ModerationStatus.approved,
        },
      });

      if (result.flagged) {
        this.logger.log(
          `Comment ${commentId} flagged for moderation: ${result.flags.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to moderate comment ${commentId}:`, error);
      // Leave comment in pending state if moderation fails
    }
  }

  /**
   * Get comments for an article (public, approved only)
   */
  async findByArticle(articleId: string, page: number = 1, limit: number = 20) {
    // Verify article exists
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const skip = (page - 1) * limit;

    // Get top-level comments (no parent)
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          article_id: articleId,
          parent_id: null,
          status: CommentStatus.approved,
          deleted_at: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          replies: {
            where: {
              status: CommentStatus.approved,
              deleted_at: null,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({
        where: {
          article_id: articleId,
          parent_id: null,
          status: CommentStatus.approved,
          deleted_at: null,
        },
      }),
    ]);

    return {
      data: comments,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single comment by ID
   */
  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        replies: {
          where: {
            status: CommentStatus.approved,
            deleted_at: null,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  /**
   * Update own comment
   */
  async update(id: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Reset moderation status when content is edited
    const updated = await this.prisma.comment.update({
      where: { id },
      data: {
        content: dto.content,
        moderation_status: ModerationStatus.pending, // Re-flag for review
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Re-run moderation on updated content
    if (dto.content) {
      this.moderateCommentAsync(id, dto.content);
    }

    return updated;
  }

  /**
   * Delete own comment (soft delete)
   */
  async remove(id: string, userId: string, isAdmin: boolean = false) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    if (!isAdmin && comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { message: 'Comment deleted successfully' };
  }

  /**
   * Admin: Get all comments with filters
   */
  async findAll(query: QueryCommentsDto) {
    const { article_id, status, moderation_status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deleted_at: null,
    };

    if (article_id) where.article_id = article_id;
    if (status) where.status = status;
    if (moderation_status) where.moderation_status = moderation_status;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Get flagged comments for moderation
   */
  async findFlagged(page: number = 1, limit: number = 20) {
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
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Approve a comment
   */
  async approve(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: CommentStatus.approved,
        moderation_status: ModerationStatus.approved,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Admin: Reject a comment
   */
  async reject(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: CommentStatus.rejected,
        moderation_status: ModerationStatus.rejected,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Admin: Mark comment as spam
   */
  async markAsSpam(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deleted_at) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: CommentStatus.spam,
        moderation_status: ModerationStatus.rejected,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Update moderation flags (called by moderation service)
   */
  async updateModerationFlags(
    id: string,
    flags: string[],
    profanityDetected: boolean,
  ) {
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
}
