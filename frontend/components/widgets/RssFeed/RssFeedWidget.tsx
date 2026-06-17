'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ExternalLink, Loader2, Rss } from 'lucide-react';
import api from '@/lib/api';

export interface RssFeedWidgetData {
  feedUrl: string;
  specificItemUrl?: string;
  count: number;
  layout: 'list' | 'card';
  showImage: boolean;
  fadeHeight: number;
  ctaLabel: string;
}

interface FeedItem {
  title: string;
  url: string;
  published_at: string | null;
  excerpt: string;
  image_url: string | null;
}

interface FeedPreview {
  feed_title: string;
  feed_url: string;
  items: FeedItem[];
}

const DEFAULT_DATA: RssFeedWidgetData = {
  feedUrl: '',
  count: 3,
  layout: 'list',
  showImage: true,
  fadeHeight: 220,
  ctaLabel: 'Continue Reading',
};

function useFeed(feedUrl: string, count: number, specificItemUrl?: string) {
  const params = new URLSearchParams({ url: feedUrl, count: String(count) });
  if (specificItemUrl) params.set('item_url', specificItemUrl);

  return useSWR<FeedPreview>(
    feedUrl ? `/external-feeds/preview?${params}` : null,
    (url: string) => api.get(url).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );
}

interface Props {
  data: Partial<RssFeedWidgetData>;
  mode?: 'display' | 'edit';
}

export function RssFeedWidget({ data, mode = 'display' }: Props) {
  const d = { ...DEFAULT_DATA, ...data };
  const [expanded, setExpanded] = useState(false);

  const { data: feed, isLoading, error } = useFeed(d.feedUrl, d.count, d.specificItemUrl);

  if (!d.feedUrl) {
    if (mode === 'edit') {
      return (
        <div className="border border-dashed border-neutral-700 rounded-lg p-6 text-center text-neutral-500 text-sm">
          <Rss size={20} className="mx-auto mb-2 opacity-50" />
          RSS Feed Widget — configure a feed URL in settings
        </div>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 text-sm py-4">
        <Loader2 size={16} className="animate-spin" /> Loading feed…
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="text-sm text-red-400 py-2">
        Failed to load feed. Please try again later.
      </div>
    );
  }

  const ctaHref = d.specificItemUrl || feed.items[0]?.url || feed.feed_url;
  const contentHeight = expanded ? 'auto' : `${d.fadeHeight}px`;

  return (
    <div className="rss-feed-widget">
      <div className="relative" style={{ maxHeight: contentHeight, overflow: 'hidden' }}>
        {d.layout === 'card' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feed.items.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-colors"
              >
                {d.showImage && item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-3">
                  <h3 className="font-medium text-sm text-foreground mb-1 line-clamp-2">{item.title}</h3>
                  {item.excerpt && (
                    <p className="text-xs text-foreground/60 line-clamp-3">{item.excerpt}</p>
                  )}
                  {item.published_at && (
                    <p className="text-xs text-foreground/40 mt-2">
                      {new Date(item.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {feed.items.map((item, i) => (
              <div key={i} className="flex gap-3">
                {d.showImage && item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.title} className="w-20 h-16 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm text-foreground hover:text-accent transition-colors block mb-1"
                  >
                    {item.title}
                  </a>
                  {item.excerpt && (
                    <p className="text-xs text-foreground/60 line-clamp-2">{item.excerpt}</p>
                  )}
                  {item.published_at && (
                    <p className="text-xs text-foreground/40 mt-1">
                      {new Date(item.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fade overlay */}
        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--background, #000) 0%, transparent 100%)' }}
          />
        )}
      </div>

      {/* CTA row */}
      <div className="flex items-center gap-3 mt-3">
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
        >
          <ExternalLink size={14} />
          {d.ctaLabel || 'Continue Reading'}
        </a>
        {!expanded && feed.items.length > 1 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            Show more
          </button>
        )}
      </div>
    </div>
  );
}
