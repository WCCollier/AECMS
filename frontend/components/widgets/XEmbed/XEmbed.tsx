'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Twitter } from 'lucide-react';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';

declare global {
  interface Window {
    twttr?: { widgets: { load: (el?: HTMLElement | null) => void } };
  }
}

function extractHandle(url: string): string {
  try {
    const m = new URL(url).pathname.match(/^\/([^/]+)\//);
    return m ? `@${m[1]}` : '';
  } catch { return ''; }
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface OEmbedData {
  author_name: string;
  author_url: string;
  html: string;
}

function XEmbedSmall({ url }: { url: string }) {
  const handle = extractHandle(url);
  const encodedUrl = encodeURIComponent(url);
  const { data, isLoading } = useSWR<OEmbedData>(
    url ? `/api/oembed/twitter?url=${encodedUrl}` : null,
    async (key: string) => {
      const res = await fetch(key);
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    { revalidateOnFocus: false },
  );

  const postText = data?.html ? stripHtmlTags(data.html).slice(0, 120) : null;
  const displayName = data?.author_name ?? null;
  const preview = isLoading ? null : (postText ? `"${postText}${postText.length >= 120 ? '…' : ''}"` : null);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit' }}
      className="flex flex-col gap-1 p-3 border border-border rounded-lg my-2 hover:bg-surface-raised transition-colors"
    >
      <div className="flex items-center gap-1.5 text-foreground/60 text-xs">
        <Twitter className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium text-foreground/80">
          {displayName ?? handle}
        </span>
        {displayName && handle && <span className="text-foreground/40">{handle}</span>}
      </div>
      {preview && (
        <p className="text-sm text-foreground/80 line-clamp-2">{preview}</p>
      )}
      <span className="text-xs text-accent hover:underline mt-0.5">View on X ↗</span>
    </a>
  );
}

export function XEmbed({ url }: { url: string }) {
  const size = useWidgetSize();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url || size === 'small') return;

    const activate = () => window.twttr?.widgets.load(ref.current);

    if (window.twttr?.widgets) {
      activate();
      return;
    }

    if (!document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      s.charset = 'utf-8';
      s.onload = activate;
      document.head.appendChild(s);
    } else {
      const id = setInterval(() => {
        if (window.twttr?.widgets) { clearInterval(id); activate(); }
      }, 200);
      setTimeout(() => clearInterval(id), 5000);
    }
  }, [url, size]);

  if (!url) {
    return (
      <div className="flex items-center gap-2 p-4 border border-border rounded-lg text-foreground/50 my-4">
        <Twitter className="w-5 h-5" />
        <span className="text-sm">No post URL provided</span>
      </div>
    );
  }

  if (size === 'small') {
    return <XEmbedSmall url={url} />;
  }

  return (
    <div ref={ref} className="my-4 max-w-[550px] mx-auto">
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}
