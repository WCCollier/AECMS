'use client';

import { Video, Play } from 'lucide-react';
import Image from 'next/image';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';

interface VideoInfo {
  embedUrl: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
}

function parseVideoUrl(url: string): VideoInfo {
  const result: VideoInfo = { embedUrl: null, thumbnailUrl: null, originalUrl: url };
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      let id = u.searchParams.get('v');
      if (!id && u.hostname === 'youtu.be') id = u.pathname.slice(1).split('?')[0];
      if (!id) {
        const m = u.pathname.match(/\/embed\/([^/?]+)/);
        if (m) id = m[1];
      }
      if (id) {
        result.embedUrl = `https://www.youtube.com/embed/${id}`;
        result.thumbnailUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
    } else if (u.hostname.includes('vimeo.com')) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m) {
        result.embedUrl = `https://player.vimeo.com/video/${m[1]}`;
        // Vimeo thumbnail requires oEmbed; fall back to null
      }
    }
  } catch {}
  return result;
}

export function VideoEmbed({ url }: { url: string }) {
  const size = useWidgetSize();
  const { embedUrl, thumbnailUrl, originalUrl } = parseVideoUrl(url);

  if (!embedUrl) {
    return (
      <div className="flex items-center gap-3 p-4 border border-border rounded-lg text-foreground/50 my-4">
        <Video className="w-6 h-6 flex-shrink-0" />
        <span className="text-sm">
          Unsupported video URL —{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            open link
          </a>
        </span>
      </div>
    );
  }

  if (size === 'small') {
    return (
      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-video rounded-lg overflow-hidden my-2 bg-black group"
        aria-label="Watch video"
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt="Video thumbnail"
            fill
            className="object-cover opacity-80 group-hover:opacity-70 transition-opacity"
            sizes="280px"
          />
        ) : (
          <div className="w-full h-full bg-foreground/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 rounded-full p-3 group-hover:bg-black/80 transition-colors">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </a>
    );
  }

  return (
    <div className="aspect-video rounded-lg overflow-hidden my-4 bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title="Embedded video"
      />
    </div>
  );
}
