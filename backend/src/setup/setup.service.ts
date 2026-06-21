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
    const homeBody = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to your new site! Edit this page and publish it, then set it as your homepage in Admin → Settings → General.' }] }],
    });

    const [existingHome, existingAbout, existingArticle, existingProduct] = await Promise.all([
      this.prisma.page.findFirst({ where: { slug: '_home_', parent_id: null } }),
      this.prisma.page.findFirst({ where: { slug: 'about-pages', parent_id: null } }),
      this.prisma.article.findFirst({ where: { slug: 'welcome' } }),
      this.prisma.product.findFirst({ where: { slug: 'about-products', deleted_at: null } }),
    ]);

    await Promise.all([
      !existingHome && this.prisma.page.create({ data: {
        slug: '_home_', title: 'Home', content: homeBody, status: 'draft', visibility: 'public',
        author_id: ownerId, author_can_delete: false, admin_can_delete: false,
      }}),
      !existingAbout && this.prisma.page.create({ data: {
        slug: 'about-pages', title: 'About Pages', status: 'draft', visibility: 'admin_only',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a sample page. Use Pages to build your site structure.' }] }] }),
        author_id: ownerId,
      }}),
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
