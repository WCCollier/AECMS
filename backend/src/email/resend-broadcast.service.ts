import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ResendBroadcastService {
  private readonly logger = new Logger(ResendBroadcastService.name);
  private readonly BASE = 'https://api.resend.com';

  constructor(private readonly settingsService: SettingsService) {}

  // ── internal helpers ─────────────────────────────────────────────────────────

  private async resendFetch(
    path: string,
    method: string,
    apiKey: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: any }> {
    const res = await fetch(`${this.BASE}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data: any;
    try { data = await res.json(); } catch { data = {}; }
    return { ok: res.ok, status: res.status, data };
  }

  private async getCredentials(): Promise<{ apiKey: string; audienceId: string } | null> {
    const [apiKey, audienceId] = await Promise.all([
      this.settingsService.getEffective('email.broadcast_resend_api_key_enc'),
      this.settingsService.getEffective('email.broadcast_resend_audience_id'),
    ]);
    if (!apiKey || !audienceId) return null;
    return { apiKey, audienceId };
  }

  private async findContactId(email: string, apiKey: string, audienceId: string): Promise<string | null> {
    const r = await this.resendFetch(`audiences/${audienceId}/contacts`, 'GET', apiKey);
    if (!r.ok) return null;
    const contacts: any[] = r.data?.data ?? [];
    return contacts.find((c: any) => c.email === email)?.id ?? null;
  }

  private async updateTopicSubscription(
    contactId: string,
    topicId: string,
    subscribed: boolean,
    apiKey: string,
    audienceId: string,
  ): Promise<void> {
    const r = await this.resendFetch(
      `audiences/${audienceId}/contacts/${contactId}`,
      'PATCH',
      apiKey,
      { subscriptions: [{ topic_id: topicId, status: subscribed ? 'active' : 'inactive' }] },
    );
    if (!r.ok) {
      this.logger.error(
        `Resend topic ${subscribed ? 'subscribe' : 'unsubscribe'} failed contactId=${contactId} topicId=${topicId}: ${JSON.stringify(r.data)}`,
      );
    }
  }

  // ── public API ───────────────────────────────────────────────────────────────

  async upsertContact(user: { email: string; firstName: string; lastName: string }): Promise<void> {
    const creds = await this.getCredentials();
    if (!creds) return;
    const { apiKey, audienceId } = creds;

    const r = await this.resendFetch(`audiences/${audienceId}/contacts`, 'POST', apiKey, {
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      unsubscribed: false,
    });
    if (!r.ok) {
      this.logger.error(`Resend upsertContact failed for ${user.email}: status=${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  async subscribeToTopic(email: string, topicId: string): Promise<void> {
    const creds = await this.getCredentials();
    if (!creds) return;
    const { apiKey, audienceId } = creds;

    let contactId = await this.findContactId(email, apiKey, audienceId);
    if (!contactId) {
      // Ensure the contact exists before subscribing
      await this.upsertContact({ email, firstName: '', lastName: '' });
      contactId = await this.findContactId(email, apiKey, audienceId);
    }
    if (!contactId) {
      this.logger.warn(`Resend subscribeToTopic: could not find/create contact for ${email}`);
      return;
    }
    await this.updateTopicSubscription(contactId, topicId, true, apiKey, audienceId);
  }

  async unsubscribeFromTopic(email: string, topicId: string): Promise<void> {
    const creds = await this.getCredentials();
    if (!creds) return;
    const { apiKey, audienceId } = creds;

    const contactId = await this.findContactId(email, apiKey, audienceId);
    if (!contactId) return; // contact not in Resend, nothing to unsubscribe

    await this.updateTopicSubscription(contactId, topicId, false, apiKey, audienceId);
  }

  async sendBroadcast(opts: {
    audienceId: string;
    topicId: string;
    from: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const apiKey = await this.settingsService.getEffective('email.broadcast_resend_api_key_enc');
    if (!apiKey) throw new Error('Resend API key not configured');

    const createR = await this.resendFetch('broadcasts', 'POST', apiKey, {
      audience_id: opts.audienceId,
      topic_id: opts.topicId,
      from: opts.from,
      subject: opts.subject,
      html: opts.html,
      name: `${opts.subject.slice(0, 50)} ${Date.now()}`,
    });
    if (!createR.ok) {
      throw new Error(`Resend broadcast create failed: ${JSON.stringify(createR.data)}`);
    }

    const broadcastId: string = createR.data?.id;
    if (!broadcastId) throw new Error('Resend broadcast create returned no ID');

    const sendR = await this.resendFetch(`broadcasts/${broadcastId}/send`, 'POST', apiKey);
    if (!sendR.ok) {
      throw new Error(`Resend broadcast send failed: ${JSON.stringify(sendR.data)}`);
    }

    this.logger.log(`Resend broadcast sent id=${broadcastId} subject="${opts.subject}"`);
  }

  // Convenience for new-user registration — checks provider, upserts contact, subscribes topics.
  async syncNewContact(
    user: { email: string; firstName: string; lastName: string },
    subscriptions: { articles: boolean; products: boolean; news: boolean },
  ): Promise<void> {
    const [provider, articlesTopicId, productsTopicId, newsTopicId] = await Promise.all([
      this.settingsService.getEffective('email.broadcast_provider'),
      this.settingsService.getEffective('email.broadcast_resend_articles_topic_id'),
      this.settingsService.getEffective('email.broadcast_resend_products_topic_id'),
      this.settingsService.getEffective('email.broadcast_resend_news_topic_id'),
    ]);
    if (provider !== 'resend') return;

    await this.upsertContact(user);

    const syncs: Promise<void>[] = [];
    if (subscriptions.articles && articlesTopicId) syncs.push(this.subscribeToTopic(user.email, articlesTopicId));
    if (subscriptions.products && productsTopicId) syncs.push(this.subscribeToTopic(user.email, productsTopicId));
    if (subscriptions.news && newsTopicId) syncs.push(this.subscribeToTopic(user.email, newsTopicId));
    await Promise.allSettled(syncs);
  }
}
