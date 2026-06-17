import { Test, TestingModule } from '@nestjs/testing';
import { KindleService } from './kindle.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../storage';
import { EMAIL_PROVIDER } from '../email';
import { PersonalizationService } from './personalization.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('KindleService', () => {
  let service: KindleService;
  let prisma: any;
  let storageProvider: any;
  let emailProvider: any;
  let personalizationService: any;

  const mockPrisma = {
    kindleDevice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    digitalDownload: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockStorageProvider = {
    download: jest.fn(),
    getProviderType: jest.fn().mockReturnValue('local'),
  };

  const mockEmailProvider = {
    sendWithAttachment: jest.fn(),
    getProviderType: jest.fn().mockReturnValue('console'),
  };

  const mockPersonalizationService = {
    personalize: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KindleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
        { provide: EMAIL_PROVIDER, useValue: mockEmailProvider },
        { provide: PersonalizationService, useValue: mockPersonalizationService },
      ],
    }).compile();

    service = module.get<KindleService>(KindleService);
    prisma = module.get(PrismaService);
    storageProvider = mockStorageProvider;
    emailProvider = mockEmailProvider;
    personalizationService = mockPersonalizationService;

    jest.clearAllMocks();
  });

  describe('addDevice', () => {
    const userId = 'user-123';
    const dto = {
      friendlyName: 'My Kindle',
      kindleEmail: 'user_test@kindle.com',
      isDefault: true,
    };

    it('should add a Kindle device successfully', async () => {
      const mockDevice = {
        id: 'device-123',
        user_id: userId,
        friendly_name: 'My Kindle',
        kindle_email: 'user_test@kindle.com',
        is_default: true,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.kindleDevice.findFirst.mockResolvedValue(null);
      prisma.kindleDevice.count.mockResolvedValue(0);
      prisma.kindleDevice.updateMany.mockResolvedValue({ count: 0 });
      prisma.kindleDevice.create.mockResolvedValue(mockDevice);

      const result = await service.addDevice(userId, dto);

      expect(result).toBeDefined();
      expect(result.friendlyName).toBe('My Kindle');
      expect(result.kindleEmail).toBe('user_test@kindle.com');
    });

    it('should throw BadRequestException for invalid Kindle email', async () => {
      const invalidDto = { ...dto, kindleEmail: 'user@gmail.com' };

      await expect(service.addDevice(userId, invalidDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate email', async () => {
      prisma.kindleDevice.findFirst.mockResolvedValue({ id: 'existing-device' });

      await expect(service.addDevice(userId, dto))
        .rejects.toThrow(BadRequestException);
    });

    it('should set first device as default', async () => {
      const dtoWithoutDefault = { ...dto, isDefault: undefined };
      const mockDevice = {
        id: 'device-123',
        user_id: userId,
        friendly_name: 'My Kindle',
        kindle_email: 'user_test@kindle.com',
        is_default: true,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.kindleDevice.findFirst.mockResolvedValue(null);
      prisma.kindleDevice.count.mockResolvedValue(0);
      prisma.kindleDevice.create.mockResolvedValue(mockDevice);

      const result = await service.addDevice(userId, dtoWithoutDefault);

      expect(result.isDefault).toBe(true);
    });
  });

  describe('getUserDevices', () => {
    it('should return all devices for a user', async () => {
      const mockDevices = [
        { id: 'device-1', user_id: 'user-123', friendly_name: 'Kindle 1', kindle_email: 'user1@kindle.com', is_default: true, last_used_at: null, created_at: new Date(), updated_at: new Date() },
        { id: 'device-2', user_id: 'user-123', friendly_name: 'Kindle 2', kindle_email: 'user2@kindle.com', is_default: false, last_used_at: null, created_at: new Date(), updated_at: new Date() },
      ];

      prisma.kindleDevice.findMany.mockResolvedValue(mockDevices);

      const result = await service.getUserDevices('user-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('getDevice', () => {
    it('should return a device by id', async () => {
      const mockDevice = {
        id: 'device-123',
        user_id: 'user-123',
        friendly_name: 'My Kindle',
        kindle_email: 'user@kindle.com',
        is_default: true,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.kindleDevice.findFirst.mockResolvedValue(mockDevice);

      const result = await service.getDevice('device-123', 'user-123');

      expect(result.id).toBe('device-123');
    });

    it('should throw NotFoundException if device not found', async () => {
      prisma.kindleDevice.findFirst.mockResolvedValue(null);

      await expect(service.getDevice('non-existent', 'user-123'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDevice', () => {
    it('should update a device', async () => {
      const mockDevice = {
        id: 'device-123',
        user_id: 'user-123',
        friendly_name: 'My Kindle',
        kindle_email: 'user@kindle.com',
        is_default: false,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.kindleDevice.findFirst.mockResolvedValue(mockDevice);
      prisma.kindleDevice.updateMany.mockResolvedValue({ count: 1 });
      prisma.kindleDevice.update.mockResolvedValue({
        ...mockDevice,
        friendly_name: 'Updated Name',
        is_default: true,
      });

      const result = await service.updateDevice('device-123', 'user-123', {
        friendlyName: 'Updated Name',
        isDefault: true,
      });

      expect(result.friendlyName).toBe('Updated Name');
      expect(result.isDefault).toBe(true);
    });
  });

  describe('deleteDevice', () => {
    it('should delete a device', async () => {
      const mockDevice = {
        id: 'device-123',
        user_id: 'user-123',
        is_default: false,
        friendly_name: 'My Kindle',
      };

      prisma.kindleDevice.findFirst.mockResolvedValue(mockDevice);
      prisma.kindleDevice.delete.mockResolvedValue(mockDevice);

      await service.deleteDevice('device-123', 'user-123');

      expect(prisma.kindleDevice.delete).toHaveBeenCalledWith({
        where: { id: 'device-123' },
      });
    });

    it('should promote another device to default when deleting default', async () => {
      const defaultDevice = {
        id: 'device-123',
        user_id: 'user-123',
        is_default: true,
        friendly_name: 'Default Kindle',
      };
      const nextDevice = {
        id: 'device-456',
        user_id: 'user-123',
        is_default: false,
      };

      prisma.kindleDevice.findFirst
        .mockResolvedValueOnce(defaultDevice)
        .mockResolvedValueOnce(nextDevice);
      prisma.kindleDevice.delete.mockResolvedValue(defaultDevice);
      prisma.kindleDevice.update.mockResolvedValue({ ...nextDevice, is_default: true });

      await service.deleteDevice('device-123', 'user-123');

      expect(prisma.kindleDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-456' },
        data: { is_default: true },
      });
    });
  });

  describe('sendToKindle', () => {
    const userId = 'user-123';
    const mockDownload = {
      id: 'download-123',
      user_id: userId,
      expires_at: new Date(Date.now() + 86400000),
      download_count: 0,
      kindle_send_count: 0,
      max_downloads: 5,
      digital_file: {
        id: 'file-123',
        format: 'epub',
        file_id: 'path/book.epub',
        personalization_enabled: false,
        product: { name: 'Test Book' },
      },
      order: { order_number: 'ORD-001', created_at: new Date() },
    };

    it('should send to Kindle using default device', async () => {
      const mockDevice = {
        id: 'device-123',
        kindle_email: 'user@kindle.com',
        is_default: true,
      };
      const fileBuffer = Buffer.from('epub content');

      prisma.digitalDownload.findUnique.mockResolvedValue(mockDownload);
      prisma.digitalDownload.update.mockResolvedValue(mockDownload);
      prisma.kindleDevice.findFirst.mockResolvedValue(mockDevice);
      prisma.kindleDevice.update.mockResolvedValue(mockDevice);
      storageProvider.download.mockResolvedValue(fileBuffer);
      emailProvider.sendWithAttachment.mockResolvedValue({ success: true, messageId: 'msg-123' });

      const result = await service.sendToKindle(userId, { downloadId: 'download-123' });

      expect(result.success).toBe(true);
      expect(result.kindleEmail).toBe('user@kindle.com');
      expect(emailProvider.sendWithAttachment).toHaveBeenCalled();
    });

    it('should send to Kindle using specified email', async () => {
      const fileBuffer = Buffer.from('epub content');

      prisma.digitalDownload.findUnique.mockResolvedValue(mockDownload);
      prisma.digitalDownload.update.mockResolvedValue(mockDownload);
      storageProvider.download.mockResolvedValue(fileBuffer);
      emailProvider.sendWithAttachment.mockResolvedValue({ success: true });

      const result = await service.sendToKindle(userId, {
        downloadId: 'download-123',
        kindleEmail: 'other@kindle.com',
      });

      expect(result.kindleEmail).toBe('other@kindle.com');
    });

    it('should throw NotFoundException if download not found', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue(null);

      await expect(service.sendToKindle(userId, { downloadId: 'non-existent' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own download', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue({
        ...mockDownload,
        user_id: 'other-user',
      });

      await expect(service.sendToKindle(userId, { downloadId: 'download-123' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if download expired', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue({
        ...mockDownload,
        expires_at: new Date(Date.now() - 86400000),
      });

      await expect(service.sendToKindle(userId, { downloadId: 'download-123' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no Kindle specified and no default', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue(mockDownload);
      prisma.kindleDevice.findFirst.mockResolvedValue(null);

      await expect(service.sendToKindle(userId, { downloadId: 'download-123' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should apply personalization when enabled', async () => {
      const personalizedDownload = {
        ...mockDownload,
        digital_file: { ...mockDownload.digital_file, personalization_enabled: true },
      };
      const mockDevice = { id: 'device-123', kindle_email: 'user@kindle.com', is_default: true };
      const originalBuffer = Buffer.from('original');
      const personalizedBuffer = Buffer.from('personalized');

      prisma.digitalDownload.findUnique.mockResolvedValue(personalizedDownload);
      prisma.digitalDownload.update.mockResolvedValue(personalizedDownload);
      prisma.kindleDevice.findFirst.mockResolvedValue(mockDevice);
      prisma.kindleDevice.update.mockResolvedValue(mockDevice);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@example.com', first_name: 'John', last_name: 'Doe' });
      storageProvider.download.mockResolvedValue(originalBuffer);
      personalizationService.personalize.mockResolvedValue(personalizedBuffer);
      emailProvider.sendWithAttachment.mockResolvedValue({ success: true });

      await service.sendToKindle(userId, { downloadId: 'download-123' });

      expect(personalizationService.personalize).toHaveBeenCalled();
    });
  });
});
