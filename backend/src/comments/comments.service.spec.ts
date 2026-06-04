import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CommentStatus, ModerationStatus } from '@prisma/client';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    moderations: { create: jest.fn() },
  }));
});

import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'member',
  };

  const mockArticle = {
    id: 'article-123',
    title: 'Test Article',
    slug: 'test-article',
    status: 'published',
  };

  const mockProduct = {
    id: 'product-123',
    name: 'Test Product',
    slug: 'test-product',
    status: 'published',
    deleted_at: null,
  };

  const mockComment = {
    id: 'comment-123',
    article_id: 'article-123',
    product_id: null,
    user_id: 'user-123',
    content: 'This is a test comment',
    title: null,
    verified_purchase: false,
    status: CommentStatus.approved,
    moderation_status: ModerationStatus.pending,
    parent_id: null,
    deleted_at: null,
    ratings: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRating = { id: 'rating-123', comment_id: 'comment-123', title: 'Overall', value: 5 };

  // $transaction mock: executes the callback with the tx object
  const makeTxMock = (commentUpdate: any) => ({
    commentRating: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    comment: {
      update: jest.fn().mockResolvedValue(commentUpdate),
    },
  });

  const mockPrismaService = {
    article: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    order: { findFirst: jest.fn() },
    comment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    commentRating: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockModerationService = {
    moderate: jest.fn().mockResolvedValue({
      flagged: false,
      flags: [],
      profanityDetected: false,
      categories: null,
      testMode: true,
    }),
  };

  // Default: user has the capability. Individual tests override for negative cases.
  const mockCapabilitiesService = {
    userHasCapability: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ModerationService, useValue: mockModerationService },
        { provide: CapabilitiesService, useValue: mockCapabilitiesService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a plain comment on an article', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });

      const result = await service.create(
        { article_id: 'article-123', content: 'Test comment' },
        mockUser as any,
      );

      expect(result).toBeDefined();
      expect(result.content).toBe('This is a test comment');
    });

    it('should throw ForbiddenException when user lacks the required capability', async () => {
      mockCapabilitiesService.userHasCapability.mockResolvedValueOnce(false);
      await expect(
        service.create({ article_id: 'article-123', content: 'Test' }, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should bypass capability check for owner role', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });
      const ownerUser = { ...mockUser, role: 'owner' };
      const result = await service.create(
        { article_id: 'article-123', content: 'Owner comment' },
        ownerUser as any,
      );
      expect(result).toBeDefined();
      expect(mockCapabilitiesService.userHasCapability).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if article does not exist', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ article_id: 'non-existent', content: 'Test' }, mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if article is not published', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'draft' });
      await expect(
        service.create({ article_id: 'article-123', content: 'Test' }, mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a review on an article (no purchase required)', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findFirst.mockResolvedValue(null); // no existing review
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        title: 'Great article',
        ratings: [mockRating],
        user: mockUser,
        article: mockArticle,
      });

      const result = await service.create(
        {
          article_id: 'article-123',
          content: 'Excellent!',
          title: 'Great article',
          ratings: [{ title: 'Overall', value: 5 }],
        },
        mockUser as any,
      );

      expect(result.ratings).toHaveLength(1);
    });

    it('should reject a review if "Overall" is not the first rating', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      await expect(
        service.create(
          {
            article_id: 'article-123',
            content: 'Test',
            ratings: [{ title: 'Value', value: 4 }],
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if user already reviewed the article', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findFirst.mockResolvedValue({ ...mockComment, ratings: [mockRating] });

      await expect(
        service.create(
          { article_id: 'article-123', content: 'Second review', ratings: [{ title: 'Overall', value: 3 }] },
          mockUser as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when reviewing a product without a purchase', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { product_id: 'product-123', content: 'Great!', ratings: [{ title: 'Overall', value: 5 }] },
          mockUser as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a review on a product for a verified purchaser', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.order.findFirst.mockResolvedValue({ id: 'order-123' });
      mockPrismaService.comment.findFirst.mockResolvedValue(null);
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        article_id: null,
        product_id: 'product-123',
        verified_purchase: true,
        ratings: [mockRating],
        user: mockUser,
        product: mockProduct,
        article: null,
      });

      const result = await service.create(
        { product_id: 'product-123', content: 'Love it!', ratings: [{ title: 'Overall', value: 5 }] },
        mockUser as any,
      );

      expect(result.verified_purchase).toBe(true);
    });

    it('should create a reply to a comment', async () => {
      const parentComment = { ...mockComment, parent_id: null };
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findUnique.mockResolvedValue(parentComment);
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-123',
        parent_id: 'comment-123',
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });

      const result = await service.create(
        { article_id: 'article-123', content: 'Reply', parent_id: 'comment-123' },
        mockUser as any,
      );

      expect(result.parent_id).toBe('comment-123');
    });

    it('should throw BadRequestException when replying to a reply', async () => {
      const parentComment = { ...mockComment, parent_id: 'another-comment' };
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findUnique.mockResolvedValue(parentComment);

      await expect(
        service.create(
          { article_id: 'article-123', content: 'Nested reply', parent_id: 'comment-123' },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a reply includes ratings', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);

      await expect(
        service.create(
          {
            article_id: 'article-123',
            content: 'Reply with rating',
            parent_id: 'comment-123',
            ratings: [{ title: 'Overall', value: 5 }],
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findByArticle ─────────────────────────────────────────────────────────

  describe('findByArticle', () => {
    it('should return paginated comments for an article', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { ...mockComment, user: mockUser, ratings: [], replies: [] },
      ]);
      mockPrismaService.comment.count.mockResolvedValue(1);

      const result = await service.findByArticle('article-123', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.total_pages).toBe(1);
    });

    it('should throw NotFoundException if article does not exist', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(null);
      await expect(service.findByArticle('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return a comment by ID', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({
        ...mockComment,
        user: mockUser,
        ratings: [],
        article: mockArticle,
        replies: [],
      });

      const result = await service.findById('comment-123');
      expect(result.id).toBe('comment-123');
    });

    it('should throw NotFoundException if comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if comment is soft-deleted', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...mockComment, deleted_at: new Date() });
      await expect(service.findById('comment-123')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update own comment content', async () => {
      const updatedComment = { ...mockComment, content: 'Updated content', user: mockUser, ratings: [], article: mockArticle };
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...mockComment, ratings: [] });
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = makeTxMock(updatedComment);
        return cb(tx);
      });

      const result = await service.update('comment-123', { content: 'Updated content' }, 'user-123');
      expect(result.content).toBe('Updated content');
    });

    it('should update ratings wholesale via transaction', async () => {
      const updatedComment = {
        ...mockComment,
        ratings: [{ id: 'r-new', comment_id: 'comment-123', title: 'Overall', value: 4 }],
        user: mockUser,
        article: mockArticle,
      };
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...mockComment, ratings: [mockRating] });
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = makeTxMock(updatedComment);
        return cb(tx);
      });

      const result = await service.update(
        'comment-123',
        { ratings: [{ title: 'Overall', value: 4 }] },
        'user-123',
      );
      expect(result.ratings[0].value).toBe(4);
    });

    it('should throw ForbiddenException when updating another user\'s comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...mockComment, ratings: [] });
      await expect(
        service.update('comment-123', { content: 'Hacked' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);
      await expect(
        service.update('non-existent', { content: 'Test' }, 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if first updated rating is not "Overall"', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...mockComment, ratings: [] });
      await expect(
        service.update('comment-123', { ratings: [{ title: 'Value', value: 3 }] }, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete own comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({ ...mockComment, deleted_at: new Date() });

      const result = await service.remove('comment-123', 'user-123');
      expect(result.message).toBe('Comment deleted successfully');
    });

    it('should allow admin to delete any comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({ ...mockComment, deleted_at: new Date() });

      const result = await service.remove('comment-123', 'admin-user', true);
      expect(result.message).toBe('Comment deleted successfully');
    });

    it('should throw ForbiddenException when non-admin deletes another user\'s comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      await expect(service.remove('comment-123', 'other-user', false)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── admin moderation ──────────────────────────────────────────────────────

  describe('approve', () => {
    it('should approve a comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.approved,
        moderation_status: ModerationStatus.approved,
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });

      const result = await service.approve('comment-123');
      expect(result.status).toBe(CommentStatus.approved);
      expect(result.moderation_status).toBe(ModerationStatus.approved);
    });
  });

  describe('reject', () => {
    it('should reject a comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.rejected,
        moderation_status: ModerationStatus.rejected,
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });

      const result = await service.reject('comment-123');
      expect(result.status).toBe(CommentStatus.rejected);
    });
  });

  describe('markAsSpam', () => {
    it('should mark a comment as spam', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.spam,
        moderation_status: ModerationStatus.rejected,
        user: mockUser,
        ratings: [],
        article: mockArticle,
      });

      const result = await service.markAsSpam('comment-123');
      expect(result.status).toBe(CommentStatus.spam);
    });
  });

  describe('findFlagged', () => {
    it('should return flagged comments for moderation', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([
        { ...mockComment, moderation_status: ModerationStatus.flagged, user: mockUser, ratings: [], article: mockArticle },
      ]);
      mockPrismaService.comment.count.mockResolvedValue(1);

      const result = await service.findFlagged(1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
