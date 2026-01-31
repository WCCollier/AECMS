import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommentStatus, ModerationStatus } from '@prisma/client';

// Mock the modules that have ESM issues
jest.mock('bad-words', () => {
  return jest.fn().mockImplementation(() => ({
    isProfane: jest.fn(() => false),
    clean: jest.fn((text: string) => text),
    addWords: jest.fn(),
  }));
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    moderations: { create: jest.fn() },
  }));
});

import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let prismaService: PrismaService;
  let moderationService: ModerationService;

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

  const mockComment = {
    id: 'comment-123',
    article_id: 'article-123',
    user_id: 'user-123',
    content: 'This is a test comment',
    status: CommentStatus.approved,
    moderation_status: ModerationStatus.pending,
    parent_id: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    article: {
      findUnique: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ModerationService, useValue: mockModerationService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    moderationService = module.get<ModerationService>(ModerationService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a comment successfully', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.create.mockResolvedValue({
        ...mockComment,
        user: mockUser,
        article: mockArticle,
      });

      const result = await service.create(
        { article_id: 'article-123', content: 'Test comment' },
        mockUser as any,
      );

      expect(result).toBeDefined();
      expect(result.content).toBe('This is a test comment');
      expect(mockPrismaService.article.findUnique).toHaveBeenCalledWith({
        where: { id: 'article-123' },
      });
    });

    it('should throw NotFoundException if article does not exist', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { article_id: 'non-existent', content: 'Test' },
          mockUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if article is not published', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'draft',
      });

      await expect(
        service.create(
          { article_id: 'article-123', content: 'Test' },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
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
        article: mockArticle,
      });

      const result = await service.create(
        {
          article_id: 'article-123',
          content: 'This is a reply',
          parent_id: 'comment-123',
        },
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
          {
            article_id: 'article-123',
            content: 'Nested reply',
            parent_id: 'comment-123',
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByArticle', () => {
    it('should return paginated comments for an article', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(mockArticle);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { ...mockComment, user: mockUser, replies: [] },
      ]);
      mockPrismaService.comment.count.mockResolvedValue(1);

      const result = await service.findByArticle('article-123', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
    });

    it('should throw NotFoundException if article does not exist', async () => {
      mockPrismaService.article.findUnique.mockResolvedValue(null);

      await expect(service.findByArticle('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('should return a comment by ID', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({
        ...mockComment,
        user: mockUser,
        article: mockArticle,
        replies: [],
      });

      const result = await service.findById('comment-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('comment-123');
    });

    it('should throw NotFoundException if comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if comment is deleted', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({
        ...mockComment,
        deleted_at: new Date(),
      });

      await expect(service.findById('comment-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update own comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        content: 'Updated content',
        user: mockUser,
      });

      const result = await service.update(
        'comment-123',
        { content: 'Updated content' },
        'user-123',
      );

      expect(result.content).toBe('Updated content');
    });

    it('should throw ForbiddenException when updating others comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);

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
  });

  describe('remove', () => {
    it('should soft delete own comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        deleted_at: new Date(),
      });

      const result = await service.remove('comment-123', 'user-123');

      expect(result.message).toBe('Comment deleted successfully');
      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-123' },
        data: { deleted_at: expect.any(Date) },
      });
    });

    it('should allow admin to delete any comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        deleted_at: new Date(),
      });

      const result = await service.remove('comment-123', 'admin-user', true);

      expect(result.message).toBe('Comment deleted successfully');
    });

    it('should throw ForbiddenException when non-admin deletes others comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);

      await expect(
        service.remove('comment-123', 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('should approve a comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.approved,
        moderation_status: ModerationStatus.approved,
        user: mockUser,
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
      });

      const result = await service.reject('comment-123');

      expect(result.status).toBe(CommentStatus.rejected);
      expect(result.moderation_status).toBe(ModerationStatus.rejected);
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
      });

      const result = await service.markAsSpam('comment-123');

      expect(result.status).toBe(CommentStatus.spam);
    });
  });

  describe('findFlagged', () => {
    it('should return flagged comments for moderation', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          moderation_status: ModerationStatus.flagged,
          user: mockUser,
          article: mockArticle,
        },
      ]);
      mockPrismaService.comment.count.mockResolvedValue(1);

      const result = await service.findFlagged(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
