'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';

interface Zone {
  id: string;
  span: number;
  scheme?: string;
}

interface SectionBackground {
  type: string;
  value?: string;
  mode?: string;
  movement?: string;
  exit?: string;
  imageSize?: string;
  overlay?: {
    color?: string;
    opacity?: number;
    gradient?: string;
  };
}

interface Section {
  id: string;
  columns: number;
  minHeight?: string | null;
  padding?: string | null;
  background?: SectionBackground | null;
  zones: Zone[];
}

interface Props {
  sections: unknown[];
}

function BackgroundBadge({ bg }: { bg: SectionBackground }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!bg.type || bg.type === 'none') return null;

  const isColor = bg.type === 'color';
  const isGradient = bg.type === 'gradient';
  const isImage = bg.type === 'image';
  const isAnimated = bg.mode === 'animated';
  const hasSwatchValue = (isColor || isGradient) && bg.value;

  const swatchStyle: React.CSSProperties = hasSwatchValue ? { background: bg.value } : {};

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] border border-border hover:border-accent/50 transition-colors cursor-pointer bg-background"
      >
        {hasSwatchValue && (
          <span
            className="inline-block w-3 h-3 rounded-sm border border-white/20 shrink-0"
            style={swatchStyle}
          />
        )}
        {isImage && <span className="opacity-60">🖼</span>}
        <span className="text-muted">{bg.type}</span>
        {isAnimated && (
          <Zap size={9} className="text-accent/70 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-xl p-3 w-64">
          {/* Swatch / preview */}
          {hasSwatchValue && (
            <div
              className="w-full h-10 rounded-md mb-2.5 border border-border"
              style={swatchStyle}
            />
          )}
          {isImage && (
            <div className="w-full h-10 rounded-md mb-2.5 border border-border bg-surface-raised flex items-center justify-center text-xs text-muted">
              🖼 AI placeholder — upload image in page editor
            </div>
          )}

          {/* Value */}
          {hasSwatchValue && (
            <>
              <p className="text-[10px] text-muted uppercase tracking-wide mb-1 font-semibold">{bg.type}</p>
              <code className="block text-[10px] text-foreground/70 font-mono break-all leading-relaxed bg-background rounded px-2 py-1.5 border border-border">
                {bg.value}
              </code>
            </>
          )}

          {/* Overlay */}
          {bg.overlay && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] text-muted uppercase tracking-wide mb-1 font-semibold">Overlay</p>
              <code className="block text-[10px] text-foreground/70 font-mono break-all bg-background rounded px-2 py-1.5 border border-border">
                {bg.overlay.gradient
                  ? bg.overlay.gradient
                  : `${bg.overlay.color ?? '#000'} @ ${Math.round((bg.overlay.opacity ?? 0) * 100)}%`}
              </code>
            </div>
          )}

          {/* Animation settings */}
          {isAnimated && (bg.movement || bg.exit) && (
            <div className="mt-2 pt-2 border-t border-border flex items-center gap-3 text-[10px] text-muted">
              <Zap size={9} className="text-accent/70 shrink-0" />
              {bg.movement && <span>movement: <span className="text-foreground/70">{bg.movement}</span></span>}
              {bg.exit && <span>exit: <span className="text-foreground/70">{bg.exit}</span></span>}
            </div>
          )}

          {/* imageSize for traditional image */}
          {isImage && !isAnimated && bg.imageSize && (
            <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted">
              size: <span className="text-foreground/70">{bg.imageSize}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LayoutResult({ sections }: Props) {
  const typed = sections as Section[];

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
        Page Structure · {typed.length} section{typed.length !== 1 ? 's' : ''}
      </h3>
      {typed.map((section, i) => (
        <div key={section.id ?? i} className="border border-border rounded overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface text-xs text-muted">
            <span className="font-mono text-foreground/60">§{i + 1}</span>
            <span>{section.columns}-col</span>
            {section.minHeight && <span className="text-accent/70">{section.minHeight}</span>}
            {section.padding && section.padding !== 'normal' && <span>{section.padding}</span>}
            {section.background?.type && section.background.type !== 'none' && (
              <BackgroundBadge bg={section.background} />
            )}
          </div>

          {/* Zone diagram */}
          <div className="flex h-8 bg-background/50">
            {section.zones.map((zone, zi) => (
              <div
                key={zone.id ?? zi}
                className="flex items-center justify-center border-r border-border last:border-r-0 text-[10px] text-muted font-mono"
                style={{ flex: zone.span }}
              >
                {zone.span}/{section.columns}
                {zone.scheme && zone.scheme !== 'inherit' && (
                  <span className="ml-1 opacity-60">{zone.scheme === 'light' ? '☀' : '◑'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
