'use client';

import { useEffect, useRef } from 'react';
import { Twitter } from 'lucide-react';

declare global {
  interface Window {
    twttr?: { widgets: { load: (el?: HTMLElement | null) => void } };
  }
}

export function XEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url) return;

    const activate = () => window.twttr?.widgets.load(ref.current);

    if (window.twttr?.widgets) {
      activate();
      return;
    }

    // Load widgets.js once; subsequent calls are no-ops because the script tag is deduplicated
    if (!document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      s.charset = 'utf-8';
      s.onload = activate;
      document.head.appendChild(s);
    } else {
      // Script tag exists but twttr hasn't initialised yet; poll briefly
      const id = setInterval(() => {
        if (window.twttr?.widgets) { clearInterval(id); activate(); }
      }, 200);
      setTimeout(() => clearInterval(id), 5000);
    }
  }, [url]);

  if (!url) {
    return (
      <div className="flex items-center gap-2 p-4 border border-border rounded-lg text-foreground/50 my-4">
        <Twitter className="w-5 h-5" />
        <span className="text-sm">No post URL provided</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="my-4 max-w-[550px] mx-auto">
      {/* blockquote is the fallback rendered before widgets.js replaces it with the embed */}
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}
