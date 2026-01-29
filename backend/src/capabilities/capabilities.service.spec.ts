import { Test, TestingModule } from '@nestjs/testing';
import { CapabilitiesService } from './capabilities.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('CapabilitiesService', () => {
  let service: CapabilitiesService;
  let prisma: PrismaService;

  const mockCapability = {
    id: 'cap-1',
    name: 'article.create',
    category: 'content',
    description: 'Create articles',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: UserRole.admin,
  };

  const mockOwner = {
    id: 'owner-1',
    email: 'owner@example.com',
    role: UserRole.owner,
  };

  const mockPrismaService = {
    capability: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    roleCapability: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    userCapability: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapabilitiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CapabilitiesService>(CapabilitiesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getAllCapabilities', () => {
    it('should return all capabilities', async () => {
      const capabilities = [mockCapability];
      mockPrismaService.capability.findMany.mockResolvedValue(capabilities);

      const result = await service.getAllCapabilities();

      expect(result).toEqual(capabilities);
      expect(prisma.capability.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('getRoleCapabilities', () => {
    it('should return all capabilities for owner role', async () => {
      const capabilities = [mockCapability];
      mockPrismaService.capability.findMany.mockResolvedValue(capabilities);

      const result = await service.getRoleCapabilities(UserRole.owner);

      expect(result).toEqual(capabilities);
    });

    it('should return role-specific capabilities for admin role', async () => {
      const roleCapabilities = [
        { id: 'rc-1', capability: mockCapability },
      ];
      mockPrismaService.roleCapability.findMany.mockResolvedValue(
        roleCapabilities,
      );

      const result = await service.getRoleCapabilities(UserRole.admin);

      expect(result).toEqual([mockCapability]);
      expect(prisma.roleCapability.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.admin },
        include: { capability: true },
      });
    });

    it('should return role-specific capabilities for member role', async () => {
      mockPrismaService.roleCapability.findMany.mockResolvedValue([]);

      const result = await service.getRoleCapabilities(UserRole.member);

      expect(result).toEqual([]);
    });
  });

  describe('getUserCapabilities', () => {
    it('should return all capabilities for owner user', async () => {
      const capabilities = [mockCapability];
      mockPrismaService.user.findUnique.mockResolvedValue(mockOwner);
      mockPrismaService.capability.findMany.mockResolvedValue(capabilities);

      const result = await service.getUserCapabilities(mockOwner.id);

      expect(result).toEqual(capabilities);
    });

    it('should return combined role and user capabilities', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.roleCapability.findMany.mockResolvedValue([
        { capability: mockCapability },
      ]);
      mockPrismaService.userCapability.findMany.mockResolvedValue([]);

      const result = await service.getUserCapabilities(mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCapability);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserCapabilities('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deduplicate capabilities from role and user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.roleCapability.findMany.mockResolvedValue([
        { capability: mockCapability },
      ]);
      mockPrismaService.userCapability.findMany.mockResolvedValue([
        { capability: mockCapability },
      ]);

      const result = await service.getUserCapabilities(mockUser.id);

      expect(result).toHaveLength(1);
    });
  });

  describe('userHasCapability', () => {
    it('should return true for owner user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockOwner);

      const result = await service.userHasCapability(
        mockOwner.id,
        'article.create',
      );

      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.userHasCapability('invalid', 'article.create');

      expect(result).toBe(false);
    });

    it('should return false if capability not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(null);

      const result = await service.userHasCapability(mockUser.id, 'invalid');

      expect(result).toBe(false);
    });

    it('should return true if user has capability via role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.roleCapability.findFirst.mockResolvedValue({
        id: 'rc-1',
      });

      const result = await service.userHasCapability(
        mockUser.id,
        'article.create',
      );

      expect(result).toBe(true);
    });

    it('should return true if user has capability directly assigned', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.roleCapability.findFirst.mockResolvedValue(null);
      mockPrismaService.userCapability.findFirst.mockResolvedValue({
        id: 'uc-1',
      });

      const result = await service.userHasCapability(
        mockUser.id,
        'article.create',
      );

      expect(result).toBe(true);
    });

    it('should return false if user does not have capability', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.roleCapability.findFirst.mockResolvedValue(null);
      mockPrismaService.userCapability.findFirst.mockResolvedValue(null);

      const result = await service.userHasCapability(
        mockUser.id,
        'article.create',
      );

      expect(result).toBe(false);
    });
  });

  describe('userHasAnyCapability', () => {
    it('should return true if user has any of the capabilities', async () => {
      jest
        .spyOn(service, 'userHasCapability')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.userHasAnyCapability(mockUser.id, [
        'article.create',
        'article.edit',
      ]);

      expect(result).toBe(true);
    });

    it('should return false if user has none of the capabilities', async () => {
      jest
        .spyOn(service, 'userHasCapability')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const result = await service.userHasAnyCapability(mockUser.id, [
        'article.create',
        'article.edit',
      ]);

      expect(result).toBe(false);
    });
  });

  describe('assignCapabilityToRole', () => {
    it('should throw BadRequestException for owner role', async () => {
      await expect(
        service.assignCapabilityToRole(UserRole.owner, mockCapability.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if capability not found', async () => {
      mockPrismaService.capability.findUnique.mockResolvedValue(null);

      await expect(
        service.assignCapabilityToRole(UserRole.admin, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already assigned', async () => {
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.roleCapability.findFirst.mockResolvedValue({
        id: 'rc-1',
      });

      await expect(
        service.assignCapabilityToRole(UserRole.admin, mockCapability.id),
      ).rejects.toThrow(ConflictException);
    });

    it('should assign capability to role successfully', async () => {
      const roleCapability = {
        id: 'rc-1',
        role: UserRole.admin,
        capability_id: mockCapability.id,
        capability: mockCapability,
      };
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.roleCapability.findFirst.mockResolvedValue(null);
      mockPrismaService.roleCapability.create.mockResolvedValue(
        roleCapability,
      );

      const result = await service.assignCapabilityToRole(
        UserRole.admin,
        mockCapability.id,
      );

      expect(result).toEqual(roleCapability);
      expect(prisma.roleCapability.create).toHaveBeenCalled();
    });
  });

  describe('removeCapabilityFromRole', () => {
    it('should throw BadRequestException for owner role', async () => {
      await expect(
        service.removeCapabilityFromRole(UserRole.owner, mockCapability.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if role capability not found', async () => {
      mockPrismaService.roleCapability.findFirst.mockResolvedValue(null);

      await expect(
        service.removeCapabilityFromRole(UserRole.admin, mockCapability.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove capability from role successfully', async () => {
      const roleCapability = { id: 'rc-1' };
      mockPrismaService.roleCapability.findFirst.mockResolvedValue(
        roleCapability,
      );
      mockPrismaService.roleCapability.delete.mockResolvedValue(
        roleCapability,
      );

      await service.removeCapabilityFromRole(UserRole.admin, mockCapability.id);

      expect(prisma.roleCapability.delete).toHaveBeenCalledWith({
        where: { id: roleCapability.id },
      });
    });
  });

  describe('assignCapabilityToUser', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignCapabilityToUser('invalid', mockCapability.id, 'granter-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for owner user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.assignCapabilityToUser(mockOwner.id, mockCapability.id, 'granter-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if capability not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(null);

      await expect(
        service.assignCapabilityToUser(mockUser.id, 'invalid', 'granter-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already assigned', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.userCapability.findFirst.mockResolvedValue({
        id: 'uc-1',
      });

      await expect(
        service.assignCapabilityToUser(mockUser.id, mockCapability.id, 'granter-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should assign capability to user successfully', async () => {
      const userCapability = {
        id: 'uc-1',
        user_id: mockUser.id,
        capability_id: mockCapability.id,
        granted_by: 'granter-1',
        capability: mockCapability,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.capability.findUnique.mockResolvedValue(mockCapability);
      mockPrismaService.userCapability.findFirst.mockResolvedValue(null);
      mockPrismaService.userCapability.create.mockResolvedValue(
        userCapability,
      );

      const result = await service.assignCapabilityToUser(
        mockUser.id,
        mockCapability.id,
        'granter-1',
      );

      expect(result).toEqual(userCapability);
      expect(prisma.userCapability.create).toHaveBeenCalled();
    });
  });

  describe('removeCapabilityFromUser', () => {
    it('should throw NotFoundException if user capability not found', async () => {
      mockPrismaService.userCapability.findFirst.mockResolvedValue(null);

      await expect(
        service.removeCapabilityFromUser(mockUser.id, mockCapability.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove capability from user successfully', async () => {
      const userCapability = { id: 'uc-1' };
      mockPrismaService.userCapability.findFirst.mockResolvedValue(
        userCapability,
      );
      mockPrismaService.userCapability.delete.mockResolvedValue(
        userCapability,
      );

      await service.removeCapabilityFromUser(mockUser.id, mockCapability.id);

      expect(prisma.userCapability.delete).toHaveBeenCalledWith({
        where: { id: userCapability.id },
      });
    });
  });
});
