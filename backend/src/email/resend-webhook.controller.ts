import {
  Controller,
  Post,
  Headers,
  HttpCode,
  UnauthorizedException,
  Logger,
  Req,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('email')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhooks/resend')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const webhookSecret = await this.settingsService.getEffective('email.broadcast_resend_webhook_secret_enc');

    // If no secret is configured, accept without verification (warn and continue).
    // Once the owner registers the webhook in Resend, they will save the secret.
    if (webhookSecret) {
      const rawBody = req.body as Buffer;
      if (!this.verifySignature(svixId, svixTimestamp, svixSignature, rawBody, webhookSecret)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else {
      this.logger.warn('Resend webhook received but no signing secret configured — skipping verification');
    }

    let event: any;
    try {
      const rawBody = req.body as Buffer;
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { received: true };
    }

    if (event?.type === 'contact.unsubscribed') {
      await this.handleContactUnsubscribed(event.data).catch((err: any) =>
        this.logger.error('Resend webhook handler error', err),
      );
    }

    return { received: true };
  }

  // Resend uses the Svix signing format:
  // Message = "{svix-id}.{svix-timestamp}.{rawBodyUtf8}"
  // Key     = base64-decode(secret after stripping "whsec_" prefix)
  // Sig     = HMAC-SHA256(message, key) → base64
  // Header  = space-separated "v1,{base64sig}" values
  private verifySignature(
    svixId: string,
    svixTimestamp: string,
    svixSignature: string,
    rawBody: Buffer,
    secret: string,
  ): boolean {
    if (!svixId || !svixTimestamp || !svixSignature) return false;
    try {
      const keyBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
      const key = Buffer.from(keyBase64, 'base64');
      const msg = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
      const hmac = crypto.createHmac('sha256', key).update(msg).digest('base64');
      return svixSignature.split(' ').some((s) => {
        const comma = s.indexOf(',');
        return comma !== -1 && s.slice(0, comma) === 'v1' && s.slice(comma + 1) === hmac;
      });
    } catch {
      return false;
    }
  }

  private async handleContactUnsubscribed(data: any): Promise<void> {
    const email: string = data?.email;
    // Resend may send topic_id or topicId depending on API version
    const topicId: string = data?.topic_id ?? data?.topicId;
    if (!email || !topicId) return;

    const [articlesTopicId, productsTopicId, newsTopicId] = await Promise.all([
      this.settingsService.getEffective('email.broadcast_resend_articles_topic_id'),
      this.settingsService.getEffective('email.broadcast_resend_products_topic_id'),
      this.settingsService.getEffective('email.broadcast_resend_news_topic_id'),
    ]);

    let field: string | undefined;
    if (topicId === articlesTopicId) field = 'subscribe_new_articles';
    else if (topicId === productsTopicId) field = 'subscribe_new_products';
    else if (topicId === newsTopicId) field = 'subscribe_news_alerts';

    if (!field) {
      this.logger.warn(`Resend webhook: unrecognized topicId=${topicId} for ${email}`);
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`Resend webhook: no user found for email=${email}`);
      return;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { [field]: false } });
    this.logger.log(`Resend webhook: unsubscribed ${email} from ${field}`);
  }
}
