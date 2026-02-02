import { Test, TestingModule } from '@nestjs/testing';
import { DomainAliasesService } from './domain-aliases.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('DomainAliasesService', () => {
  let service: DomainAliasesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    domainAlias: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockDomainAlias = {
    id: 'alias-1',
    domain: 'wccollier.com',
    target_route: '/author',
    is_active: false,
    verification_token: 'aecms-verify-abc123',
    verified_at: null,
    owner_id: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    owner: {
      id: 'user-1',
      email: 'owner@test.com',
      first_name: 'Test',
      last_name: 'Owner',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainAliasesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DomainAliasesService>(DomainAliasesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new domain alias', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(null);
      mockPrismaService.domainAlias.create.mockResolvedValue(mockDomainAlias);

      const result = await service.create(
        { domain: 'wccollier.com', target_route: '/author' },
        'user-1',
      );

      expect(result).toEqual(mockDomainAlias);
      expect(mockPrismaService.domainAlias.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          domain: 'wccollier.com',
          target_route: '/author',
          owner_id: 'user-1',
          is_active: false,
        }),
      });
    });

    it('should throw ConflictException if domain already exists', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);

      await expect(
        service.create({ domain: 'wccollier.com', target_route: '/author' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize domain to lowercase', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(null);
      mockPrismaService.domainAlias.create.mockResolvedValue(mockDomainAlias);

      await service.create({ domain: 'WCCollier.COM', target_route: '/author' }, 'user-1');

      expect(mockPrismaService.domainAlias.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          domain: 'wccollier.com',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all domain aliases', async () => {
      mockPrismaService.domainAlias.findMany.mockResolvedValue([mockDomainAlias]);

      const result = await service.findAll();

      expect(result).toEqual([mockDomainAlias]);
    });
  });

  describe('findAllActive', () => {
    it('should return only active and verified aliases', async () => {
      const activeAlias = { ...mockDomainAlias, is_active: true, verified_at: new Date() };
      mockPrismaService.domainAlias.findMany.mockResolvedValue([activeAlias]);

      const result = await service.findAllActive();

      expect(mockPrismaService.domainAlias.findMany).toHaveBeenCalledWith({
        where: {
          is_active: true,
          verified_at: { not: null },
        },
      });
      expect(result).toEqual([activeAlias]);
    });
  });

  describe('findById', () => {
    it('should return domain alias by ID', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);

      const result = await service.findById('alias-1');

      expect(result).toEqual(mockDomainAlias);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update domain alias', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);
      mockPrismaService.domainAlias.update.mockResolvedValue({
        ...mockDomainAlias,
        target_route: '/new-route',
      });

      const result = await service.update(
        'alias-1',
        { target_route: '/new-route' },
        'user-1',
        UserRole.owner,
      );

      expect(result.target_route).toBe('/new-route');
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);

      await expect(
        service.update('alias-1', { target_route: '/new' }, 'other-user', UserRole.admin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if activating unverified domain', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);

      await expect(
        service.update('alias-1', { is_active: true }, 'user-1', UserRole.owner),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete domain alias', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);
      mockPrismaService.domainAlias.delete.mockResolvedValue(mockDomainAlias);

      await service.remove('alias-1', 'user-1', UserRole.owner);

      expect(mockPrismaService.domainAlias.delete).toHaveBeenCalledWith({
        where: { id: 'alias-1' },
      });
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);

      await expect(
        service.remove('alias-1', 'other-user', UserRole.admin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getVerificationInstructions', () => {
    it('should return verification instructions', () => {
      const instructions = service.getVerificationInstructions(mockDomainAlias as any);

      expect(instructions).toHaveProperty('domain', 'wccollier.com');
      expect(instructions).toHaveProperty('verification_token');
      expect(instructions).toHaveProperty('instructions');
      expect(instructions).toHaveProperty('cname_setup');
    });
  });

  describe('regenerateToken', () => {
    it('should regenerate verification token', async () => {
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(mockDomainAlias);
      mockPrismaService.domainAlias.update.mockResolvedValue({
        ...mockDomainAlias,
        verification_token: 'new-token',
      });

      const result = await service.regenerateToken('alias-1', 'user-1', UserRole.owner);

      expect(mockPrismaService.domainAlias.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if already verified', async () => {
      const verifiedAlias = { ...mockDomainAlias, verified_at: new Date() };
      mockPrismaService.domainAlias.findUnique.mockResolvedValue(verifiedAlias);

      await expect(
        service.regenerateToken('alias-1', 'user-1', UserRole.owner),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
