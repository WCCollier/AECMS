import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { buildTermsContent, buildPrivacyContent } from './policy-templates';

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    const owner = await this.prisma.user.findFirst({ where: { role_name: 'owner' } });
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
      this.settings.getEffective('email.system_from'),
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
        role_name: 'owner',
        email_verified: true,
        approved_at: new Date(),
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

    // Seed draft policy pages (Terms of Service + Privacy Policy)
    const appUrl = process.env.APP_URL ?? 'https://example.com';
    await this.seedPolicyPages(owner.id, {
      siteName: dto.site_name,
      siteUrl: appUrl,
      contactEmail: dto.email,
      ownerName: `${dto.first_name} ${dto.last_name}`.trim(),
      effectiveDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
  }

  private async seedSampleContent(ownerId: string): Promise<void> {
    // Pages (_home_, about-pages) are seeded at container startup by
    // scripts/seed-sample-content.js before the app starts, so they will
    // already exist by the time the wizard runs. This method only handles
    // the article and product, which require an owner ID.
    const li = (text: string) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

    const welcomeContent = JSON.stringify({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'About Articles' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Articles are the primary publishing format — blog posts, essays, news items, tutorials, and anything else that belongs in a reverse-chronological feed.' }] },
      h2('What an Article contains'),
      { type: 'bulletList', content: [
        li('Title and slug'),
        li('Rich content body (TipTap editor — headings, lists, images, embeds)'),
        li('Excerpt (shown in listing cards)'),
        li('Categories and Tags (for filtering and discovery)'),
        li('Featured image'),
        li('Author'),
        li('Status: draft or published'),
        li('Visibility: public, logged-in users only, or admin only'),
        li('Comments and reviews (can be enabled per article)'),
      ] },
      h2('Publishing'),
      { type: 'paragraph', content: [{ type: 'text', text: 'Set status to Published and the article appears on /articles and in any category or tag feeds. Drafts are visible only to admins in the backstage.' }] },
      h2('Comments and reviews'),
      { type: 'paragraph', content: [{ type: 'text', text: 'Logged-in members can leave comments. Reviews add a star rating. You can moderate, approve, or delete any comment from Admin → Comments.' }] },
      h2('Version history'),
      { type: 'paragraph', content: [{ type: 'text', text: 'Every save creates a version. You can restore any previous version from the article editor in the backstage.' }] },
    ] });

    const aboutProductsContent = JSON.stringify({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'About Products' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Products are the commerce layer. Each product can be physical, digital, or a service — the checkout flow adapts to the type automatically.' }] },
      h2('Product types'),
      { type: 'bulletList', content: [
        li('Physical — shipped to the buyer. Requires a shipping address at checkout. Has stock quantity and SKU.'),
        li('Digital — delivered by download link or email after payment. Upload source files (PDF, EPUB, ZIP, MP3, etc.) in the Digital Files panel.'),
        li('Service — a consultation, session, or subscription. No shipping, no file. Stock is replaced by an "available / unavailable" toggle.'),
      ] },
      h2('Key fields'),
      { type: 'bulletList', content: [
        li('Title and slug'),
        li('Price and Compare-at Price (for showing a sale discount)'),
        li('SKU (unique product code)'),
        li('Stock quantity (physical only)'),
        li('Short description (shown in listing cards)'),
        li('Full description (rich text body)'),
        li('Categories and Tags'),
        li('Product images'),
        li('Status: draft or published'),
      ] },
      h2('Digital file delivery'),
      { type: 'paragraph', content: [{ type: 'text', text: 'For digital products, upload source files in the Digital Files panel (visible after saving the product). You can upload multiple formats (e.g. PDF + EPUB). After purchase, the buyer receives a timed download link. Optionally, files can be personalised with the buyer\'s name.' }] },
      h2('Payments'),
      { type: 'paragraph', content: [{ type: 'text', text: 'Stripe handles cards, Apple Pay, Google Pay, and Amazon Pay via Stripe Checkout. PayPal is available as an alternative. Configure your payment credentials in Admin → Settings → Payment Providers.' }] },
    ] });

    const [existingArticle, existingProduct] = await Promise.all([
      this.prisma.article.findFirst({ where: { slug: 'welcome' } }),
      this.prisma.product.findFirst({ where: { slug: 'about-products', deleted_at: null } }),
    ]);

    await Promise.all([
      !existingArticle && this.prisma.article.create({ data: {
        slug: 'welcome',
        title: 'About Articles',
        status: 'draft',
        visibility: 'public',
        content: welcomeContent,
        excerpt: 'An introduction to the article system — what articles contain, how to publish them, and how comments and version history work.',
        author_id: ownerId,
      }}),
      !existingProduct && this.prisma.product.create({ data: {
        slug: 'about-products',
        title: 'About Products',
        status: 'draft',
        visibility: 'public',
        product_type: 'physical',
        price: 0,
        sku: 'SAMPLE-ABOUT-PRODUCTS',
        stock_status: 'in_stock',
        stock_quantity: 0,
        description: aboutProductsContent,
        short_description: 'An introduction to the product system — physical, digital, and service types; pricing; digital file delivery; and payment providers.',
        author_id: ownerId,
      }}),
    ]);
  }

  private async seedPolicyPages(ownerId: string, params: {
    siteName: string;
    siteUrl: string;
    contactEmail: string;
    ownerName: string;
    effectiveDate: string;
  }): Promise<void> {
    const [existingTerms, existingPrivacy] = await Promise.all([
      this.prisma.page.findFirst({ where: { slug: 'terms' } }),
      this.prisma.page.findFirst({ where: { slug: 'privacy' } }),
    ]);

    await Promise.all([
      !existingTerms && this.prisma.page.create({ data: {
        slug: 'terms',
        title: 'Terms of Service',
        content: buildTermsContent(params),
        status: 'draft',
        visibility: 'public',
        show_in_nav: false,
        meta_title: `Terms of Service — ${params.siteName}`,
      }}),
      !existingPrivacy && this.prisma.page.create({ data: {
        slug: 'privacy',
        title: 'Privacy Policy',
        content: buildPrivacyContent(params),
        status: 'draft',
        visibility: 'public',
        show_in_nav: false,
        meta_title: `Privacy Policy — ${params.siteName}`,
      }}),
    ]);
  }
}
