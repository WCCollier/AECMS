import { Test, TestingModule } from '@nestjs/testing';
import { PersonalizationService } from './personalization.service';
import { FileFormat } from './dto/digital-product.dto';

describe('PersonalizationService', () => {
  let service: PersonalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PersonalizationService],
    }).compile();

    service = module.get<PersonalizationService>(PersonalizationService);
  });

  describe('personalize', () => {
    const fileBuffer = Buffer.from('test file content');

    it('should return original buffer when no options provided', async () => {
      const result = await service.personalize(fileBuffer, FileFormat.EPUB, {});

      expect(result).toEqual(fileBuffer);
    });

    it('should return original buffer for unsupported format', async () => {
      const result = await service.personalize(
        fileBuffer,
        'unknown' as FileFormat,
        { customerName: 'John Doe' },
      );

      expect(result).toEqual(fileBuffer);
    });

    it('should attempt to personalize EPUB with customer name', async () => {
      // Note: Full EPUB personalization is not implemented yet (MVP placeholder)
      // This test verifies the service handles the request without errors
      const result = await service.personalize(fileBuffer, FileFormat.EPUB, {
        customerName: 'John Doe',
        orderNumber: 'ORD-001',
        purchaseDate: '2024-01-15',
      });

      // Currently returns original buffer (placeholder implementation)
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should attempt to personalize PDF with customer name', async () => {
      // Note: Full PDF personalization is not implemented yet (MVP placeholder)
      const result = await service.personalize(fileBuffer, FileFormat.PDF, {
        customerName: 'Jane Smith',
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('generatePersonalizationHtml', () => {
    it('should generate HTML with customer name', () => {
      const html = service.generatePersonalizationHtml({
        customerName: 'John Doe',
        orderNumber: 'ORD-001',
        purchaseDate: '2024-01-15',
      });

      expect(html).toContain('John Doe');
      expect(html).toContain('ORD-001');
      expect(html).toContain('2024-01-15');
      expect(html).toContain('<?xml version="1.0"');
      expect(html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    });

    it('should escape HTML special characters', () => {
      const html = service.generatePersonalizationHtml({
        customerName: '<script>alert("xss")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should use current date if purchaseDate not provided', () => {
      const html = service.generatePersonalizationHtml({
        customerName: 'John Doe',
      });

      expect(html).toContain('Purchase Date:');
    });

    it('should handle missing customer name', () => {
      const html = service.generatePersonalizationHtml({
        orderNumber: 'ORD-001',
      });

      expect(html).toContain('ORD-001');
      expect(html).toContain('This copy is licensed to:');
    });
  });

  describe('generatePersonalizationText', () => {
    it('should generate text with customer name and order', () => {
      const text = service.generatePersonalizationText({
        customerName: 'John Doe',
        orderNumber: 'ORD-001',
        purchaseDate: '2024-01-15',
      });

      expect(text).toContain('John Doe');
      expect(text).toContain('Order: ORD-001');
      expect(text).toContain('Purchase Date: 2024-01-15');
    });

    it('should handle missing fields', () => {
      const text = service.generatePersonalizationText({});

      expect(text).toContain('This copy is licensed to:');
      expect(text).toContain('Purchase Date:');
    });
  });
});
