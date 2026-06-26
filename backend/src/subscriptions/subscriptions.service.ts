import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EMAIL_PROVIDER } from '../email/email.interface';
import type { EmailProvider } from '../email/email.interface';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscribe_new_articles: true,
        subscribe_new_products: true,
        subscribe_news_alerts: true,
      },
    });
    return user ?? { subscribe_new_articles: false, subscribe_new_products: false, subscribe_news_alerts: false };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const hasAnyTrue = Object.values(dto).some((v) => v === true);

    // Generate unsubscribe token if user is subscribing to anything for the first time
    let unsubscribeToken: string | undefined;
    if (hasAnyTrue) {
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { unsubscribe_token: true },
      });
      if (!existing?.unsubscribe_token) {
        unsubscribeToken = crypto.randomBytes(32).toString('hex');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.subscribe_new_articles !== undefined && { subscribe_new_articles: dto.subscribe_new_articles }),
        ...(dto.subscribe_new_products !== undefined && { subscribe_new_products: dto.subscribe_new_products }),
        ...(dto.subscribe_news_alerts !== undefined && { subscribe_news_alerts: dto.subscribe_news_alerts }),
        ...(unsubscribeToken && { unsubscribe_token: unsubscribeToken }),
      },
      select: {
        subscribe_new_articles: true,
        subscribe_new_products: true,
        subscribe_news_alerts: true,
      },
    });

    return updated;
  }

  async unsubscribeByToken(token: string, category: string): Promise<{ category: string }> {
    const user = await this.prisma.user.findFirst({ where: { unsubscribe_token: token } });
    if (!user) throw new BadRequestException('Invalid unsubscribe token');

    const fieldMap: Record<string, string> = {
      articles: 'subscribe_new_articles',
      products: 'subscribe_new_products',
      news: 'subscribe_news_alerts',
    };

    const field = fieldMap[category];
    if (!field) throw new BadRequestException('Invalid category');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { [field]: false },
    });

    return { category };
  }

  async notifyNewArticle(articleId: string): Promise<void> {
    const [article, subscribers, settings] = await Promise.all([
      this.prisma.article.findUnique({ where: { id: articleId }, select: { title: true, slug: true, excerpt: true } }),
      this.prisma.user.findMany({
        where: { subscribe_new_articles: true, deleted_at: null },
        select: { email: true, first_name: true, unsubscribe_token: true },
      }),
      this.getEmailSettings(),
    ]);

    if (!article || subscribers.length === 0) return;

    const appUrl = settings.appUrl;
    const articleUrl = `${appUrl}/articles/${article.slug}`;
    const excerpt = article.excerpt || '';

    for (const sub of subscribers) {
      const unsubLink = sub.unsubscribe_token
        ? `${appUrl}/auth/unsubscribe?token=${sub.unsubscribe_token}&category=articles`
        : `${appUrl}/account`;

      await this.emailProvider.send({
        to: sub.email,
        from: settings.fromAddress,
        subject: `New article: ${article.title}`,
        text: `Hi ${sub.first_name || 'there'},\n\n${settings.siteName} just published a new article:\n\n"${article.title}"\n${excerpt ? excerpt + '\n\n' : ''}Read it here: ${articleUrl}\n\n---\nYou're receiving this because you subscribed to new article emails from ${settings.siteName}.\nUnsubscribe: ${unsubLink}`,
        html: this.buildNotificationHtml({
          siteName: settings.siteName,
          greeting: `Hi ${sub.first_name || 'there'},`,
          intro: `<strong>${settings.siteName}</strong> just published a new article:`,
          title: article.title,
          excerpt,
          ctaUrl: articleUrl,
          ctaLabel: 'Read Article',
          unsubLink,
          category: 'new article emails',
        }),
      }).catch((err) => this.logger.error(`Failed to send article notification to ${sub.email}`, err));
    }

    this.logger.log(`Sent new article notifications to ${subscribers.length} subscribers`);
  }

  async notifyNewProduct(productId: string): Promise<void> {
    const [product, subscribers, settings] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { title: true, slug: true, short_description: true, price: true } }),
      this.prisma.user.findMany({
        where: { subscribe_new_products: true, deleted_at: null },
        select: { email: true, first_name: true, unsubscribe_token: true },
      }),
      this.getEmailSettings(),
    ]);

    if (!product || subscribers.length === 0) return;

    const appUrl = settings.appUrl;
    const productUrl = `${appUrl}/products/${product.slug}`;
    const excerpt = product.short_description || '';
    const priceStr = product.price ? `$${parseFloat(product.price.toString()).toFixed(2)}` : '';

    for (const sub of subscribers) {
      const unsubLink = sub.unsubscribe_token
        ? `${appUrl}/auth/unsubscribe?token=${sub.unsubscribe_token}&category=products`
        : `${appUrl}/account`;

      await this.emailProvider.send({
        to: sub.email,
        from: settings.fromAddress,
        subject: `New product: ${product.title}`,
        text: `Hi ${sub.first_name || 'there'},\n\n${settings.siteName} just added a new product:\n\n"${product.title}"${priceStr ? ' — ' + priceStr : ''}\n${excerpt ? excerpt + '\n\n' : ''}View it here: ${productUrl}\n\n---\nYou're receiving this because you subscribed to new product emails from ${settings.siteName}.\nUnsubscribe: ${unsubLink}`,
        html: this.buildNotificationHtml({
          siteName: settings.siteName,
          greeting: `Hi ${sub.first_name || 'there'},`,
          intro: `<strong>${settings.siteName}</strong> just added a new product${priceStr ? ' — ' + priceStr : ''}:`,
          title: product.title,
          excerpt,
          ctaUrl: productUrl,
          ctaLabel: 'View Product',
          unsubLink,
          category: 'new product emails',
        }),
      }).catch((err) => this.logger.error(`Failed to send product notification to ${sub.email}`, err));
    }

    this.logger.log(`Sent new product notifications to ${subscribers.length} subscribers`);
  }

  async sendBroadcast(subject: string, body: string): Promise<{ sent: number }> {
    const [subscribers, settings] = await Promise.all([
      this.prisma.user.findMany({
        where: { subscribe_news_alerts: true, deleted_at: null },
        select: { email: true, first_name: true, unsubscribe_token: true },
      }),
      this.getEmailSettings(),
    ]);

    if (subscribers.length === 0) return { sent: 0 };

    const appUrl = settings.appUrl;
    let sent = 0;

    for (const sub of subscribers) {
      const unsubLink = sub.unsubscribe_token
        ? `${appUrl}/auth/unsubscribe?token=${sub.unsubscribe_token}&category=news`
        : `${appUrl}/account`;

      try {
        await this.emailProvider.send({
          to: sub.email,
          from: settings.fromAddress,
          subject,
          text: `Hi ${sub.first_name || 'there'},\n\n${body}\n\n---\n${settings.siteName}\nYou're receiving this because you subscribed to news and alerts from ${settings.siteName}.\nUnsubscribe: ${unsubLink}`,
          html: this.buildBroadcastHtml({ siteName: settings.siteName, greeting: `Hi ${sub.first_name || 'there'},`, body, unsubLink }),
        });
        sent++;
      } catch (err) {
        this.logger.error(`Failed to send broadcast to ${sub.email}`, err);
      }
    }

    this.logger.log(`Broadcast sent to ${sent}/${subscribers.length} subscribers`);
    return { sent };
  }

  async getSubscriberCount(): Promise<{ articles: number; products: number; news: number }> {
    const [articles, products, news] = await Promise.all([
      this.prisma.user.count({ where: { subscribe_new_articles: true, deleted_at: null } }),
      this.prisma.user.count({ where: { subscribe_new_products: true, deleted_at: null } }),
      this.prisma.user.count({ where: { subscribe_news_alerts: true, deleted_at: null } }),
    ]);
    return { articles, products, news };
  }

  private async getEmailSettings() {
    const [siteName, notificationFrom, systemFrom, appUrl] = await Promise.all([
      this.settingsService.getEffective('general.site_title').then((v) => v || 'AECMS'),
      this.settingsService.getEffective('email.notification_from'),
      this.settingsService.getEffective('email.system_from'),
      Promise.resolve(this.configService.get<string>('APP_URL', 'http://localhost:3000')),
    ]);

    const fromEmail = notificationFrom || systemFrom || undefined;
    const fromAddress = fromEmail ? `${siteName} <${fromEmail}>` : undefined;

    return { siteName, fromAddress, appUrl };
  }

  private buildNotificationHtml(opts: {
    siteName: string;
    greeting: string;
    intro: string;
    title: string;
    excerpt: string;
    ctaUrl: string;
    ctaLabel: string;
    unsubLink: string;
    category: string;
  }): string {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
<h2 style="color:#111;">${opts.siteName}</h2>
<p>${opts.greeting}</p>
<p>${opts.intro}</p>
<h3 style="margin:16px 0 8px;">${opts.title}</h3>
${opts.excerpt ? `<p style="color:#555;">${opts.excerpt}</p>` : ''}
<p style="margin:24px 0;"><a href="${opts.ctaUrl}" style="background:#111;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">${opts.ctaLabel}</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
<p style="font-size:12px;color:#999;">You're receiving this because you subscribed to ${opts.category} from ${opts.siteName}. <a href="${opts.unsubLink}">Unsubscribe</a></p>
</body></html>`;
  }

  private buildBroadcastHtml(opts: {
    siteName: string;
    greeting: string;
    body: string;
    unsubLink: string;
  }): string {
    const bodyHtml = opts.body.split('\n').map((line) => line.trim() ? `<p>${line}</p>` : '').join('');
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
<h2 style="color:#111;">${opts.siteName}</h2>
<p>${opts.greeting}</p>
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
<p style="font-size:12px;color:#999;">You're receiving this because you subscribed to news and alerts from ${opts.siteName}. <a href="${opts.unsubLink}">Unsubscribe</a></p>
</body></html>`;
  }
}
