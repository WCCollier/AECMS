import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  resource_type?: string;
  resource_id?: string;
  changes?: object;
  metadata?: object;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      const latest = await this.prisma.auditLog.findFirst({
        orderBy: { created_at: 'desc' },
        select: { entry_hash: true },
      });
      const previous_hash = latest?.entry_hash ?? null;

      const hashInput = JSON.stringify({ ...entry, previous_hash });
      const entry_hash = crypto.createHash('sha256').update(hashInput).digest('hex');

      await this.prisma.auditLog.create({
        data: {
          event_type: entry.event_type,
          user_id: entry.user_id ?? null,
          ip_address: entry.ip_address ?? null,
          user_agent: entry.user_agent ?? null,
          resource_type: entry.resource_type ?? null,
          resource_id: entry.resource_id ?? null,
          changes: entry.changes as any ?? undefined,
          metadata: entry.metadata as any ?? undefined,
          previous_hash,
          entry_hash,
        },
      });
    } catch (error) {
      this.logger.warn('Audit log write failed', error);
    }
  }
}

export function diffChanges(
  before: Record<string, any>,
  after: Partial<Record<string, any>>,
): { before: Record<string, any>; after: Record<string, any> } {
  const changed = Object.keys(after).filter(
    (k) => after[k] !== undefined && String(after[k]) !== String(before[k]),
  );
  return {
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, after[k]])),
  };
}
