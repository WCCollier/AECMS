import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainAlias } from '@prisma/client';
import { CreateDomainAliasDto, UpdateDomainAliasDto } from './dto';
// Note: ownership of individual aliases is enforced by the controller-level domain.manage
// capability gate — anyone reaching these methods is already authorised to manage all aliases.
import * as crypto from 'crypto';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

@Injectable()
export class DomainAliasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new domain alias
   */
  async create(dto: CreateDomainAliasDto, userId: string): Promise<DomainAlias> {
    // Check if domain already exists
    const existing = await this.prisma.domainAlias.findUnique({
      where: { domain: dto.domain.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Domain alias already exists');
    }

    // Generate verification token
    const verificationToken = this.generateVerificationToken();

    return this.prisma.domainAlias.create({
      data: {
        domain: dto.domain.toLowerCase(),
        target_route: dto.target_route,
        verification_token: verificationToken,
        owner_id: userId,
        is_active: false, // Must verify before activating
      },
    });
  }

  /**
   * Find all domain aliases (for admin/system use)
   */
  async findAll(): Promise<DomainAlias[]> {
    return this.prisma.domainAlias.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Find all active domain aliases (for routing middleware)
   */
  async findAllActive(): Promise<DomainAlias[]> {
    return this.prisma.domainAlias.findMany({
      where: {
        is_active: true,
        verified_at: { not: null },
      },
    });
  }

  /**
   * Find domain aliases for a specific owner
   */
  async findByOwner(ownerId: string): Promise<DomainAlias[]> {
    return this.prisma.domainAlias.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Find one domain alias by ID
   */
  async findById(id: string): Promise<DomainAlias> {
    const alias = await this.prisma.domainAlias.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!alias) {
      throw new NotFoundException('Domain alias not found');
    }

    return alias;
  }

  /**
   * Find domain alias by domain name (for routing)
   */
  async findByDomain(domain: string): Promise<DomainAlias | null> {
    return this.prisma.domainAlias.findUnique({
      where: { domain: domain.toLowerCase() },
    });
  }

  /**
   * Update a domain alias
   */
  async update(
    id: string,
    dto: UpdateDomainAliasDto,
    userId: string,
  ): Promise<DomainAlias> {
    const alias = await this.findById(id);

    // If trying to activate, must be verified first
    if (dto.is_active === true && !alias.verified_at) {
      throw new BadRequestException(
        'Domain must be verified before it can be activated. Use the verify endpoint first.',
      );
    }

    return this.prisma.domainAlias.update({
      where: { id },
      data: {
        target_route: dto.target_route,
        is_active: dto.is_active,
      },
    });
  }

  /**
   * Verify domain ownership via DNS TXT record
   */
  async verify(id: string, userId: string): Promise<DomainAlias> {
    const alias = await this.findById(id);

    if (alias.verified_at) {
      throw new BadRequestException('Domain is already verified');
    }

    // Attempt DNS verification
    const isVerified = await this.checkDnsVerification(alias.domain, alias.verification_token!);

    if (!isVerified) {
      throw new BadRequestException(
        `DNS verification failed. Please add a TXT record for _aecms-verify.${alias.domain} with value: ${alias.verification_token}`,
      );
    }

    return this.prisma.domainAlias.update({
      where: { id },
      data: {
        verified_at: new Date(),
        is_active: true, // Auto-activate on successful verification
      },
    });
  }

  /**
   * Get DNS configuration instructions
   */
  getVerificationInstructions(alias: DomainAlias): object {
    return {
      domain: alias.domain,
      verification_token: alias.verification_token,
      instructions: {
        step1: 'Log in to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)',
        step2: `Add a TXT record for: _aecms-verify.${alias.domain}`,
        step3: `Set the value to: ${alias.verification_token}`,
        step4: 'Wait a few minutes for DNS propagation',
        step5: 'Click "Verify Domain" to complete verification',
      },
      cname_setup: {
        description: 'After verification, point your domain to this server:',
        record_type: 'CNAME',
        name: alias.domain,
        value: process.env.PRIMARY_DOMAIN || 'your-primary-domain.com',
        alternative: {
          record_type: 'A',
          name: alias.domain,
          value: 'Your server IP address',
        },
      },
    };
  }

  /**
   * Remove a domain alias
   */
  async remove(id: string, userId: string): Promise<void> {
    const alias = await this.findById(id);

    await this.prisma.domainAlias.delete({
      where: { id },
    });
  }

  /**
   * Regenerate verification token
   */
  async regenerateToken(id: string, userId: string): Promise<DomainAlias> {
    const alias = await this.findById(id);

    if (alias.verified_at) {
      throw new BadRequestException('Cannot regenerate token for already verified domain');
    }

    const newToken = this.generateVerificationToken();

    return this.prisma.domainAlias.update({
      where: { id },
      data: {
        verification_token: newToken,
      },
    });
  }

  /**
   * Generate a random verification token
   */
  private generateVerificationToken(): string {
    return `aecms-verify-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Check DNS TXT record for verification
   */
  private async checkDnsVerification(domain: string, expectedToken: string): Promise<boolean> {
    try {
      const records = await resolveTxt(`_aecms-verify.${domain}`);

      // records is an array of arrays (each TXT record can have multiple strings)
      for (const record of records) {
        const value = record.join('');
        if (value === expectedToken) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // DNS lookup failed (record doesn't exist, etc.)
      return false;
    }
  }
}
