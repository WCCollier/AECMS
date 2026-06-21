import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    const owner = await this.prisma.user.findFirst({ where: { role: 'owner' } });
    return owner === null;
  }

  async getProfile(): Promise<{
    storageProvider: string;
    emailProvider: string;
    kmsProvider: string;
    appUrl: string;
    isFirstRun: boolean;
    envKeys: string[];
    kindleFromEmail: string;
  }> {
    const [isFirstRun, envKeys, kindleFrom, fromAddress] = await Promise.all([
      this.isSetupRequired(),
      this.settings.getEnvSourcedKeys(),
      this.settings.getEffective('email.kindle_from'),
      this.settings.getEffective('email.from_address'),
    ]);
    return {
      storageProvider: process.env.STORAGE_PROVIDER_TYPE ?? 'local',
      emailProvider: process.env.EMAIL_PROVIDER_TYPE ?? 'smtp',
      kmsProvider: process.env.SETTINGS_KMS_PROVIDER ?? 'local',
      appUrl: process.env.APP_URL ?? '',
      isFirstRun,
      envKeys,
      kindleFromEmail: kindleFrom || fromAddress || '',
    };
  }

  async completeSetup(dto: CompleteSetupDto): Promise<void> {
    const required = await this.isSetupRequired();
    if (!required) {
      throw new ConflictException('Setup has already been completed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const owner = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        first_name: dto.first_name,
        last_name: dto.last_name,
        role: 'owner',
        email_verified: true,
      },
    });

    // Write site identity — these keys are not encrypted, so KeyProvider is not invoked
    const siteUpdates: Record<string, string> = {
      'general.site_title': dto.site_name,
    };
    if (dto.site_tagline !== undefined) {
      siteUpdates['general.tagline'] = dto.site_tagline;
    }
    await this.settings.set(siteUpdates, owner.id);

    // Seed sample content now that an owner exists (idempotent — skips if slugs already exist)
    await this.seedSampleContent(owner.id);
  }

  private async seedSampleContent(ownerId: string): Promise<void> {
    // Pages (_home_, about-pages) are seeded at container startup by
    // scripts/seed-sample-content.js before the app starts, so they will
    // already exist by the time the wizard runs. This method only handles
    // the article and product, which require an owner ID.
    const [existingArticle, existingProduct] = await Promise.all([
      this.prisma.article.findFirst({ where: { slug: 'welcome' } }),
      this.prisma.product.findFirst({ where: { slug: 'about-products', deleted_at: null } }),
    ]);

    await Promise.all([
      !existingArticle && this.prisma.article.create({ data: {
        slug: 'welcome', title: 'Welcome to AECMS', status: 'draft', visibility: 'public',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a sample article. Edit or delete it and start writing your own content.' }] }] }),
        excerpt: 'Getting started with your new site.',
        author_id: ownerId,
      }}),
      !existingProduct && this.prisma.product.create({ data: {
        slug: 'about-products', title: 'Sample Product', status: 'draft', visibility: 'public',
        product_type: 'digital', price: 0, stock_status: 'unlimited',
        description: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a sample product. Edit or delete it and add your own.' }] }] }),
        author_id: ownerId,
      }}),
    ]);
  }
}
