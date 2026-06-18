import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { DOMParser, Element as XmlElement } from '@xmldom/xmldom';

export interface FeedItem {
  title: string;
  url: string;
  published_at: string | null;
  excerpt: string;
  image_url: string | null;
}

export interface FeedPreview {
  feed_title: string;
  feed_url: string;
  items: FeedItem[];
}

const CACHE_TTL_SEC = 900; // 15 minutes
const MAX_FETCH_TIMEOUT_MS = 5000;
const MAX_EXCERPT_LENGTH = 400;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(el: XmlElement | null | undefined): string {
  if (!el) return '';
  return el.textContent ?? '';
}

function firstMediaUrl(item: XmlElement): string | null {
  // <media:content url="..."> or <enclosure url="..." type="image/...">
  const media = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
  if (media) return media.getAttribute('url');
  const enclosure = item.getElementsByTagName('enclosure')[0];
  if (enclosure) {
    const type = enclosure.getAttribute('type') ?? '';
    if (type.startsWith('image/')) return enclosure.getAttribute('url');
  }
  return null;
}

@Injectable()
export class ExternalFeedsService {
  private readonly logger = new Logger(ExternalFeedsService.name);
  private redis: RedisClientType | null = null;
  private redisConnected = false;

  constructor(private config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redis = createClient({ url: redisUrl }) as RedisClientType;
        this.redis.on('error', (err) => this.logger.warn('Redis error', err));
        this.redis.connect().then(() => {
          this.redisConnected = true;
        }).catch((err) => this.logger.warn('Redis connect failed', err));
      } catch {
        this.logger.warn('Redis init failed — feed caching disabled');
      }
    }
  }

  private validateFeedUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid feed URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Feed URL must use HTTPS');
    }
    // Allow any HTTPS RSS/Atom URL
    if (!parsed.hostname.includes('.')) {
      throw new BadRequestException('Invalid feed URL hostname');
    }
  }

  private async getCached(key: string): Promise<FeedPreview | null> {
    if (!this.redis || !this.redisConnected) return null;
    try {
      const val = await this.redis.get(key);
      if (val) return JSON.parse(val);
    } catch {
      // Cache miss
    }
    return null;
  }

  private async setCached(key: string, data: FeedPreview): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    try {
      await this.redis.setEx(key, CACHE_TTL_SEC, JSON.stringify(data));
    } catch {
      // Ignore cache write failure
    }
  }

  private async fetchViaProxy(feedUrl: string, count: number): Promise<FeedPreview> {
    // rss2json.com free tier doesn't support the count param — fetch all and slice
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_FETCH_TIMEOUT_MS);
    let json: any;
    try {
      const res = await fetch(proxyUrl, { signal: controller.signal });
      if (!res.ok) throw new BadRequestException(`Proxy returned HTTP ${res.status}`);
      json = await res.json();
    } finally {
      clearTimeout(timeout);
    }
    if (json.status !== 'ok') throw new BadRequestException('Proxy could not fetch feed');
    const items: FeedItem[] = (json.items ?? []).slice(0, Math.min(count, 10)).map((item: any) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      excerpt: stripHtml(item.description ?? item.content ?? '').slice(0, MAX_EXCERPT_LENGTH),
      image_url: item.thumbnail || null,
    }));
    return {
      feed_title: json.feed?.title ?? 'RSS Feed',
      feed_url: json.feed?.link || json.feed?.url || feedUrl,
      items,
    };
  }

  async preview(feedUrl: string, count = 3, specificItemUrl?: string, useProxy = false): Promise<FeedPreview> {
    this.validateFeedUrl(feedUrl);
    const cacheKey = `external_feed:${useProxy ? 'proxy:' : ''}${feedUrl}:${count}:${specificItemUrl ?? ''}`;

    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    if (useProxy) {
      const result = await this.fetchViaProxy(feedUrl, specificItemUrl ? 10 : count);
      await this.setCached(cacheKey, result);
      return result;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_FETCH_TIMEOUT_MS);

    let xmlText: string;
    try {
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AECMS RSS Reader/1.0' },
      });
      if (!response.ok) {
        throw new BadRequestException(`Feed returned HTTP ${response.status}`);
      }
      xmlText = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const channel = doc.getElementsByTagName('channel')[0];
    const feedTitle = textOf(channel?.getElementsByTagName('title')[0] ?? null) || 'RSS Feed';
    const feedLink = textOf(channel?.getElementsByTagName('link')[0] ?? null) || feedUrl;

    const entries = Array.from(doc.getElementsByTagName('item'));
    // Atom fallback
    const atomEntries = entries.length === 0 ? Array.from(doc.getElementsByTagName('entry')) : [];
    const allEntries = entries.length > 0 ? entries : atomEntries;

    let selectedEntries = allEntries;
    if (specificItemUrl) {
      const match = allEntries.find((e) => {
        const link = textOf(e.getElementsByTagName('link')[0] ?? null);
        const guid = textOf(e.getElementsByTagName('guid')[0] ?? null);
        return link === specificItemUrl || guid === specificItemUrl;
      });
      selectedEntries = match ? [match] : [];
    } else {
      selectedEntries = allEntries.slice(0, Math.min(count, 10));
    }

    const items: FeedItem[] = selectedEntries.map((entry) => {
      const title = stripHtml(textOf(entry.getElementsByTagName('title')[0] ?? null));
      const link = textOf(entry.getElementsByTagName('link')[0] ?? null)
        || entry.getAttribute('href') || '';
      const pubDate = textOf(entry.getElementsByTagName('pubDate')[0] ?? null)
        || textOf(entry.getElementsByTagName('published')[0] ?? null)
        || null;
      const description = textOf(entry.getElementsByTagName('description')[0] ?? null)
        || textOf(entry.getElementsByTagName('summary')[0] ?? null)
        || textOf(entry.getElementsByTagName('content')[0] ?? null)
        || '';
      const excerpt = stripHtml(description).slice(0, MAX_EXCERPT_LENGTH);
      const image_url = firstMediaUrl(entry as unknown as XmlElement);

      return {
        title,
        url: link,
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
        excerpt,
        image_url,
      };
    });

    const result: FeedPreview = { feed_title: feedTitle, feed_url: feedLink, items };
    await this.setCached(cacheKey, result);
    return result;
  }
}
