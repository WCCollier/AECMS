import { Test, TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('PagesService', () => {
  let service: PagesService;

  const mockPrisma = {
    page: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuditLog = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    jest.clearAllMocks();
  });

  describe('create — reserved slug validation', () => {
    const RESERVED = ['shop', 'latest', 'cart', 'checkout', 'account', 'order-confirmation', 'admin', 'auth', 'api'];

    it.each(RESERVED)('throws ConflictException for reserved slug "%s"', async (slug) => {
      await expect(
        service.create({ title: 'Test', content: '{}', slug }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when auto-generated slug matches a reserved word', async () => {
      await expect(
        service.create({ title: 'Shop', content: '{}' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('does not throw for a non-reserved slug that is unique', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(null);
      mockPrisma.page.create.mockResolvedValue({
        id: 'p-1', title: 'About', slug: 'about', content: '{}',
        status: 'draft', visibility: 'public', template: null,
        parent_id: null, sort_order: 0, published_at: null,
        meta_title: null, meta_description: null,
        author_can_edit: true, author_can_delete: true,
        admin_can_edit: true, admin_can_delete: true,
        created_at: new Date(), updated_at: new Date(),
        parent: null, children: [],
      });

      await expect(
        service.create({ title: 'About', content: '{}', slug: 'about' }, 'user-1'),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException when slug already exists', async () => {
      mockPrisma.page.findUnique.mockResolvedValue({ id: 'existing', slug: 'about' });

      await expect(
        service.create({ title: 'About', content: '{}', slug: 'about' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update — reserved slug validation', () => {
    const existingPage = {
      id: 'p-1', title: 'About', slug: 'about', content: '{}',
      status: 'draft', visibility: 'public', template: null,
      parent_id: null, sort_order: 0, published_at: null,
      author_can_edit: true, author_can_delete: true,
      admin_can_edit: true, admin_can_delete: true,
      created_at: new Date(), updated_at: new Date(),
    };

    it('throws ConflictException when changing slug to a reserved word', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(existingPage);

      await expect(
        service.update('p-1', { slug: 'admin' }, 'user-1', true),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findBySlug', () => {
    it('throws NotFoundException for unknown slug', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns the page for a known published slug', async () => {
      const page = {
        id: 'p-1', title: 'About', slug: 'about', content: '{}',
        status: 'published', visibility: 'public', template: null,
        parent_id: null, sort_order: 0, published_at: new Date(),
        created_at: new Date(), updated_at: new Date(),
        parent: null, children: [],
      };
      mockPrisma.page.findUnique.mockResolvedValue(page);
      const result = await service.findBySlug('about');
      expect(result.slug).toBe('about');
    });
  });
});
