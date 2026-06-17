import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { KEY_PROVIDER } from './key-provider.interface';
import { LocalKeyProvider } from './local-key.provider';

const TEST_KEY = 'a'.repeat(64);

const mockPrisma = {
  siteSettings: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
        { provide: KEY_PROVIDER, useValue: new LocalKeyProvider(TEST_KEY) },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
  });

  describe('getAll', () => {
    it('returns plaintext values for normal keys', async () => {
      mockPrisma.siteSettings.findMany.mockResolvedValue([
        { key: 'general.site_title', value: 'My Site' },
      ]);
      const result = await service.getAll();
      expect(result['general.site_title']).toBe('My Site');
    });

    it('redacts _enc keys', async () => {
      mockPrisma.siteSettings.findMany.mockResolvedValue([
        { key: 'payment.stripe_secret_key_enc', value: 'someencryptedvalue' },
      ]);
      const result = await service.getAll();
      expect(result['payment.stripe_secret_key_enc']).toBe('••••••••');
    });
  });

  describe('set', () => {
    it('encrypts _enc keys before writing', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue(null);
      mockPrisma.siteSettings.upsert.mockResolvedValue({});

      await service.set({ 'payment.stripe_secret_key_enc': 'sk_test_abc' }, 'user-1');

      expect(mockPrisma.siteSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            key: 'payment.stripe_secret_key_enc',
            value: expect.not.stringContaining('sk_test_abc'),
          }),
        }),
      );
    });

    it('preserves existing encrypted value when ••••••••  is submitted', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue({ value: 'encryptedOld' });

      await service.set({ 'payment.stripe_secret_key_enc': '••••••••' }, 'user-1');

      expect(mockPrisma.siteSettings.upsert).not.toHaveBeenCalled();
    });

    it('preserves existing encrypted value when empty string is submitted', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue({ value: 'encryptedOld' });

      await service.set({ 'payment.stripe_secret_key_enc': '' }, 'user-1');

      expect(mockPrisma.siteSettings.upsert).not.toHaveBeenCalled();
    });

    it('logs audit entry with redacted values for _enc keys', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue(null);
      mockPrisma.siteSettings.upsert.mockResolvedValue({});

      await service.set({ 'payment.stripe_secret_key_enc': 'sk_live_xyz' }, 'user-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            after: { 'payment.stripe_secret_key_enc': '••••••••' },
          }),
        }),
      );
    });

    it('logs plaintext value for non-encrypted keys', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue(null);
      mockPrisma.siteSettings.upsert.mockResolvedValue({});

      await service.set({ 'general.site_title': 'New Title' }, 'user-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            after: { 'general.site_title': 'New Title' },
          }),
        }),
      );
    });
  });

  describe('getEffective', () => {
    it('prefers DB value over env', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue({ key: 'general.site_title', value: 'DB Title' });
      process.env.SITE_TITLE = 'Env Title';

      const result = await service.getEffective('general.site_title');
      expect(result).toBe('DB Title');

      delete process.env.SITE_TITLE;
    });

    it('falls back to env when DB is empty', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue(null);
      process.env.SITE_TITLE = 'Env Title';

      const result = await service.getEffective('general.site_title');
      expect(result).toBe('Env Title');

      delete process.env.SITE_TITLE;
    });

    it('returns empty string when both DB and env are missing', async () => {
      mockPrisma.siteSettings.findUnique.mockResolvedValue(null);
      delete process.env.SITE_TITLE;

      const result = await service.getEffective('general.site_title');
      expect(result).toBe('');
    });
  });
});
