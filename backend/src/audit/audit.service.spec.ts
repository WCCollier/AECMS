import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const mockPrisma = {
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  describe('log()', () => {
    it('creates an audit log entry with a hash', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.log({ event_type: 'auth.login', user_id: 'user-1' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const call = mockPrisma.auditLog.create.mock.calls[0][0].data;
      expect(call.event_type).toBe('auth.login');
      expect(call.user_id).toBe('user-1');
      expect(call.entry_hash).toBeTruthy();
      expect(typeof call.entry_hash).toBe('string');
      expect(call.entry_hash.length).toBe(64); // SHA-256 hex
    });

    it('chains hashes: previous_hash of second entry = entry_hash of first', async () => {
      const firstHash = 'aaaa'.repeat(16);
      mockPrisma.auditLog.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ entry_hash: firstHash });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-x' });

      await service.log({ event_type: 'event.one' });
      await service.log({ event_type: 'event.two' });

      const secondCall = mockPrisma.auditLog.create.mock.calls[1][0].data;
      expect(secondCall.previous_hash).toBe(firstHash);
    });

    it('never throws if the DB write fails', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(service.log({ event_type: 'test.event' })).resolves.toBeUndefined();
    });

    it('never throws if findFirst fails', async () => {
      mockPrisma.auditLog.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(service.log({ event_type: 'test.event' })).resolves.toBeUndefined();
    });

    it('includes resource_type and resource_id when provided', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.log({
        event_type: 'article.published',
        resource_type: 'article',
        resource_id: 'art-123',
      });

      const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
      expect(data.resource_type).toBe('article');
      expect(data.resource_id).toBe('art-123');
    });

    it('uses previous_hash = null when log table is empty', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.log({ event_type: 'first.event' });

      const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
      expect(data.previous_hash).toBeNull();
    });

    it('produces different hashes for entries with different event_types', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.log({ event_type: 'event.alpha' });
      await service.log({ event_type: 'event.beta' });

      const h1 = mockPrisma.auditLog.create.mock.calls[0][0].data.entry_hash;
      const h2 = mockPrisma.auditLog.create.mock.calls[1][0].data.entry_hash;
      expect(h1).not.toBe(h2);
    });
  });
});
