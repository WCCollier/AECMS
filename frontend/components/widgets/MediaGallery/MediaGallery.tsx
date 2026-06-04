'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '@/types';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';

interface MediaGalleryProps {
  media: MediaItem[];
  aspectRatio?: 'video' | 'square' | 'auto';
  className?: string;
  fallback?: React.ReactNode;
}

const ASPECT: Record<string, string> = {
  video: 'aspect-video',
  square: 'aspect-square',
  auto: '',
};

function sortMedia(media: MediaItem[]): MediaItem[] {
  return [...media].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.order - b.order;
  });
}

function MediaCarouselSmall({ media, aspectRatio }: { media: MediaItem[]; aspectRatio: string }) {
  const [index, setIndex] = useState(0);
  const sorted = sortMedia(media);

  useEffect(() => { setIndex(0); }, [media]);

  useEffect(() => {
    if (sorted.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % sorted.length), 3000);
    return () => clearInterval(id);
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <div className={`${ASPECT[aspectRatio] || 'aspect-video'} relative overflow-hidden rounded-lg`}>
      <Image
        src={sorted[index].url}
        alt={sorted[index].alt_text || ''}
        fill
        className="object-cover transition-opacity duration-500"
        sizes="(max-width: 768px) 100vw, 280px"
      />
    </div>
  );
}

export function MediaGallery({ media, aspectRatio = 'video', className = '', fallback }: MediaGalleryProps) {
  const size = useWidgetSize();
  const sorted = sortMedia(media);

  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [media]);

  const prev = useCallback(() => setIndex((i) => (i - 1 + sorted.length) % sorted.length), [sorted.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % sorted.length), [sorted.length]);

  useEffect(() => {
    if (sorted.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sorted.length, prev, next]);

  if (sorted.length === 0) {
    return fallback ? (
      <div className={`${ASPECT[aspectRatio]} relative ${className}`}>{fallback}</div>
    ) : null;
  }

  if (size === 'small') {
    return <MediaCarouselSmall media={sorted} aspectRatio={aspectRatio} />;
  }

  const current = sorted[index];

  if (sorted.length === 1) {
    return (
      <div className={`${ASPECT[aspectRatio]} relative overflow-hidden rounded-lg ${className}`}>
        <Image
          src={current.url}
          alt={current.alt_text || ''}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
      </div>
    );
  }

  return (
    <div className={`${ASPECT[aspectRatio]} relative overflow-hidden rounded-lg group ${className}`}>
      <Image
        src={current.url}
        alt={current.alt_text || ''}
        fill
        className="object-cover transition-opacity duration-300"
        sizes="(max-width: 768px) 100vw, 60vw"
        priority={index === 0}
      />

      <button
        onClick={prev}
        aria-label="Previous image"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        aria-label="Next image"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {sorted.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to image ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-all drop-shadow ${
              i === index ? 'bg-white scale-110' : 'bg-white/60 hover:bg-white/90'
            }`}
          />
        ))}
      </div>

      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
        {index + 1} / {sorted.length}
      </div>
    </div>
  );
}
