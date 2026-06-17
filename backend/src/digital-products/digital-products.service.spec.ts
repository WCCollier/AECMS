import { Test, TestingModule } from '@nestjs/testing';
import { DigitalProductsService } from './digital-products.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../storage';
import { PersonalizationService } from './personalization.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileFormat } from './dto/digital-product.dto';

describe('DigitalProductsService', () => {
  let service: DigitalProductsService;
  let prisma: any;
  let storageProvider: any;
  let personalizationService: any;

  const mockPrisma = {
    product: {
      findUnique: jest.fn(),
    },
    digitalProductFile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    digitalDownload: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getUrl: jest.fn(),
    getMetadata: jest.fn(),
    getProviderType: jest.fn().mockReturnValue('local'),
  };

  const mockPersonalizationService = {
    personalize: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigitalProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
        { provide: PersonalizationService, useValue: mockPersonalizationService },
      ],
    }).compile();

    service = module.get<DigitalProductsService>(DigitalProductsService);
    prisma = module.get(PrismaService);
    storageProvider = mockStorageProvider;
    personalizationService = mockPersonalizationService;

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('uploadDigitalFile', () => {
    const dto = {
      productId: 'product-123',
      format: FileFormat.EPUB,
      personalizationEnabled: true,
      maxDownloads: 5,
    };
    const fileBuffer = Buffer.from('test file content');
    const filename = 'book.epub';

    it('should upload a digital file successfully', async () => {
      const mockProduct = { id: 'product-123', product_type: 'digital' };
      const mockCreatedFile = {
        id: 'file-123',
        product_id: 'product-123',
        format: 'epub',
        file_id: 'digital-products/product-123/epub/123-book.epub',
        personalization_enabled: true,
        max_downloads: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.digitalProductFile.findUnique.mockResolvedValue(null);
      storageProvider.upload.mockResolvedValue('digital-products/product-123/epub/123-book.epub');
      prisma.digitalProductFile.create.mockResolvedValue(mockCreatedFile);

      const result = await service.uploadDigitalFile(dto, fileBuffer, filename);

      expect(result).toBeDefined();
      expect(result.productId).toBe('product-123');
      expect(result.format).toBe('epub');
      expect(storageProvider.upload).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.uploadDigitalFile(dto, fileBuffer, filename))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if product is not digital', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'product-123', product_type: 'physical' });

      await expect(service.uploadDigitalFile(dto, fileBuffer, filename))
        .rejects.toThrow(BadRequestException);
    });

    it('should replace an existing file when the same format is uploaded again', async () => {
      const existingFile = {
        id: 'existing-file',
        product_id: 'product-123',
        format: 'epub',
        file_id: 'old-path.epub',
        personalization_enabled: true,
        max_downloads: 5,
        personalization_tested: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const updatedFile = { ...existingFile, file_id: 'new-path.epub', personalization_tested: false };

      prisma.product.findUnique.mockResolvedValue({ id: 'product-123', product_type: 'digital' });
      prisma.digitalProductFile.findUnique.mockResolvedValue(existingFile);
      storageProvider.upload.mockResolvedValue('new-path.epub');
      prisma.digitalProductFile.update.mockResolvedValue(updatedFile);

      const result = await service.uploadDigitalFile(dto, fileBuffer, filename);

      expect(prisma.digitalProductFile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-file' } }),
      );
      expect(prisma.digitalProductFile.create).not.toHaveBeenCalled();
      expect(result.format).toBe('epub');
    });

    it('should throw BadRequestException if file extension does not match format', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'product-123', product_type: 'digital' });
      prisma.digitalProductFile.findUnique.mockResolvedValue(null);

      await expect(service.uploadDigitalFile(dto, fileBuffer, 'book.pdf'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getProductFiles', () => {
    it('should return all files for a product', async () => {
      const mockFiles = [
        { id: 'file-1', product_id: 'product-123', format: 'epub', file_id: 'path/file.epub', personalization_enabled: true, max_downloads: 5, created_at: new Date(), updated_at: new Date() },
        { id: 'file-2', product_id: 'product-123', format: 'pdf', file_id: 'path/file.pdf', personalization_enabled: false, max_downloads: 3, created_at: new Date(), updated_at: new Date() },
      ];

      prisma.digitalProductFile.findMany.mockResolvedValue(mockFiles);

      const result = await service.getProductFiles('product-123');

      expect(result).toHaveLength(2);
      expect(prisma.digitalProductFile.findMany).toHaveBeenCalledWith({
        where: { product_id: 'product-123' },
        orderBy: { format: 'asc' },
      });
    });
  });

  describe('getDigitalFile', () => {
    it('should return a digital file by id', async () => {
      const mockFile = {
        id: 'file-123',
        product_id: 'product-123',
        format: 'epub',
        file_id: 'path/file.epub',
        personalization_enabled: true,
        max_downloads: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.digitalProductFile.findUnique.mockResolvedValue(mockFile);

      const result = await service.getDigitalFile('file-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('file-123');
    });

    it('should throw NotFoundException if file not found', async () => {
      prisma.digitalProductFile.findUnique.mockResolvedValue(null);

      await expect(service.getDigitalFile('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDigitalFile', () => {
    it('should update a digital file', async () => {
      const mockFile = {
        id: 'file-123',
        product_id: 'product-123',
        format: 'epub',
        file_id: 'path/file.epub',
        personalization_enabled: false,
        max_downloads: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.digitalProductFile.findUnique.mockResolvedValue(mockFile);
      prisma.digitalProductFile.update.mockResolvedValue({
        ...mockFile,
        personalization_enabled: true,
        max_downloads: 10,
      });

      const result = await service.updateDigitalFile('file-123', {
        personalizationEnabled: true,
        maxDownloads: 10,
      });

      expect(result.personalizationEnabled).toBe(true);
      expect(result.maxDownloads).toBe(10);
    });

    it('should throw NotFoundException if file not found', async () => {
      prisma.digitalProductFile.findUnique.mockResolvedValue(null);

      await expect(service.updateDigitalFile('non-existent', {}))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDigitalFile', () => {
    it('should delete a digital file', async () => {
      const mockFile = { id: 'file-123', file_id: 'path/file.epub' };

      prisma.digitalProductFile.findUnique.mockResolvedValue(mockFile);
      storageProvider.delete.mockResolvedValue(undefined);
      prisma.digitalProductFile.delete.mockResolvedValue(mockFile);

      await service.deleteDigitalFile('file-123');

      expect(storageProvider.delete).toHaveBeenCalledWith('path/file.epub');
      expect(prisma.digitalProductFile.delete).toHaveBeenCalledWith({ where: { id: 'file-123' } });
    });

    it('should throw NotFoundException if file not found', async () => {
      prisma.digitalProductFile.findUnique.mockResolvedValue(null);

      await expect(service.deleteDigitalFile('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('downloadFile', () => {
    const mockDownload = {
      id: 'download-123',
      download_token: 'valid-token',
      download_count: 0,
      max_downloads: 5,
      expires_at: new Date(Date.now() + 86400000), // Tomorrow
      digital_file: {
        id: 'file-123',
        format: 'epub',
        file_id: 'path/file.epub',
        personalization_enabled: false,
        product: { name: 'Test Book' },
      },
      order: { order_number: 'ORD-001', created_at: new Date() },
    };

    it('should download a file successfully', async () => {
      const fileBuffer = Buffer.from('epub content');

      prisma.digitalDownload.findUnique.mockResolvedValue(mockDownload);
      storageProvider.download.mockResolvedValue(fileBuffer);
      prisma.digitalDownload.update.mockResolvedValue({
        ...mockDownload,
        download_count: 1,
      });

      const result = await service.downloadFile('valid-token');

      expect(result.buffer).toEqual(fileBuffer);
      expect(result.filename).toBe('Test Book.epub');
      expect(result.contentType).toBe('application/epub+zip');
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue(null);

      await expect(service.downloadFile('invalid-token'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for expired download', async () => {
      const expiredDownload = {
        ...mockDownload,
        expires_at: new Date(Date.now() - 86400000), // Yesterday
      };

      prisma.digitalDownload.findUnique.mockResolvedValue(expiredDownload);

      await expect(service.downloadFile('valid-token'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when max downloads reached', async () => {
      const maxedDownload = {
        ...mockDownload,
        download_count: 5,
        max_downloads: 5,
      };

      prisma.digitalDownload.findUnique.mockResolvedValue(maxedDownload);

      await expect(service.downloadFile('valid-token'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should apply personalization when enabled', async () => {
      const personalizedDownload = {
        ...mockDownload,
        digital_file: {
          ...mockDownload.digital_file,
          personalization_enabled: true,
        },
      };
      const originalBuffer = Buffer.from('original epub');
      const personalizedBuffer = Buffer.from('personalized epub');

      prisma.digitalDownload.findUnique.mockResolvedValue(personalizedDownload);
      storageProvider.download.mockResolvedValue(originalBuffer);
      personalizationService.personalize.mockResolvedValue(personalizedBuffer);
      prisma.digitalDownload.update.mockResolvedValue({
        ...personalizedDownload,
        download_count: 1,
      });

      const result = await service.downloadFile('valid-token', { customerName: 'John Doe' });

      expect(personalizationService.personalize).toHaveBeenCalled();
      expect(result.buffer).toEqual(personalizedBuffer);
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const mockDownload = {
        id: 'download-123',
        digital_file_id: 'file-123',
        order_id: 'order-123',
        download_token: 'valid-token',
        download_count: 0,
        max_downloads: 5,
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date(),
        last_downloaded_at: null,
        digital_file: {
          format: 'epub',
          product: { name: 'Test Book' },
        },
      };

      prisma.digitalDownload.findUnique.mockResolvedValue(mockDownload);

      const result = await service.validateToken('valid-token');

      expect(result).toBeDefined();
      expect(result.downloadToken).toBe('valid-token');
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.digitalDownload.findUnique.mockResolvedValue(null);

      await expect(service.validateToken('invalid-token'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
