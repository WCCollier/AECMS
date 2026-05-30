'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarInputProps {
  value: number; // 0 = unset
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}

export function StarInput({ value, onChange, size = 'md' }: StarInputProps) {
  const [hovered, setHovered] = useState(0);
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const display = hovered || value;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') onChange(Math.min(5, value + 1));
            if (e.key === 'ArrowLeft') onChange(Math.max(1, value - 1));
          }}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={`${cls} transition-colors ${
              star <= display ? 'fill-amber-400 text-amber-400' : 'text-foreground/20'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
