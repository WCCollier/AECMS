'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ExternalLink, Loader2, Rss, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

export interface RssFeedWidgetData {
  feedUrl: string;
  specificItemUrl?: string;
  count: number;
  layout: 'list' | 'card';
  showImage: boolean;
  fadeHeight: number;
  ctaLabel: string;
  useProxy: boolean;
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
  fadeHeight: 660,
  ctaLabel: 'Continue Reading',
  useProxy: false,
};

function useFeed(feedUrl: string, count: number, useProxy: boolean, specificItemUrl?: string) {
  const params = new URLSearchParams({ url: feedUrl, count: String(count) });
  if (specificItemUrl) params.set('item_url', specificItemUrl);
  if (useProxy) params.set('use_proxy', 'true');

  return useSWR<FeedPreview>(
    feedUrl ? `/external-feeds/preview?${params}` : null,
    (url: string) => api.get(url).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );
}

interface Props {
  data: Partial<RssFeedWidgetData>;
  mode?: 'display' | 'edit';
  onEnableProxy?: () => void;
}

export function RssFeedWidget({ data, mode = 'display', onEnableProxy }: Props) {
  const d = { ...DEFAULT_DATA, ...data };
  const [expanded, setExpanded] = useState(false);

  const { data: feed, isLoading, error } = useFeed(d.feedUrl, d.count, d.useProxy, d.specificItemUrl);

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
    const msg: string = error?.response?.data?.message ?? error?.message ?? 'Unknown error';
    if (mode === 'edit') {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold text-red-400">Failed to load feed</p>
          <p className="text-xs text-red-300/80">{msg}</p>
          {!d.useProxy && onEnableProxy && (
            <button
              type="button"
              onClick={onEnableProxy}
              className="flex items-center gap-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 rounded px-2 py-1 transition-colors"
            >
              <RefreshCw size={11} />
              Retry via proxy
            </button>
          )}
          {d.useProxy && (
            <p className="text-xs text-orange-300/70">Proxy mode is enabled — feed source may be temporarily unavailable.</p>
          )}
        </div>
      );
    }
    return (
      <div className="text-sm text-foreground/40 py-2">Feed unavailable.</div>
    );
  }

  const ctaHref = d.specificItemUrl || feed.items[0]?.url || feed.feed_url;

  const items = d.layout === 'card' ? (
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
            {item.excerpt && <p className="text-xs text-foreground/60 line-clamp-3">{item.excerpt}</p>}
            {item.published_at && (
              <p className="text-xs text-foreground/40 mt-2">{new Date(item.published_at).toLocaleDateString()}</p>
            )}
          </div>
        </a>
      ))}
    </div>
  ) : (
    <div className="divide-y divide-border">
      {feed.items.map((item, i) => (
        <div key={i} className="flex gap-3 py-3 first:pt-0">
          {d.showImage && item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.title} className="w-20 h-16 object-cover rounded flex-shrink-0" />
          )}
          <div className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-foreground hover:text-accent transition-colors block mb-1 leading-snug"
            >
              {item.title}
            </a>
            {item.excerpt && <p className="text-xs text-foreground/60 line-clamp-2">{item.excerpt}</p>}
            {item.published_at && (
              <p className="text-xs text-foreground/40 mt-1">{new Date(item.published_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden my-4">
      {/* Widget header — RSS identity */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Rss size={14} className="text-orange-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-foreground/70 truncate">{feed.feed_title}</span>
        </div>
        <a
          href={feed.feed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/30 hover:text-accent transition-colors flex-shrink-0 ml-2"
          title="Visit feed source"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Content with fade + overlaid CTA */}
      <div
        className="relative overflow-hidden"
        style={{ maxHeight: expanded ? 'none' : `${d.fadeHeight}px` }}
      >
        <div className="p-4">{items}</div>

        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-3 pt-16"
            style={{ background: 'linear-gradient(to top, var(--color-background) 20%, transparent 100%)' }}
          >
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
            >
              <ExternalLink size={13} />
              {d.ctaLabel || 'Continue Reading'}
            </a>
            {feed.items.length > 1 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
              >
                Show all
              </button>
            )}
          </div>
        )}
      </div>

      {/* When expanded, CTA sits below the content */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border flex items-center justify-between">
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
          >
            <ExternalLink size={13} />
            {d.ctaLabel || 'Continue Reading'}
          </a>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}
