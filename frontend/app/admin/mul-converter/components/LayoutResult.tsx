'use client';

import React from 'react';

interface Zone {
  id: string;
  span: number;
  scheme?: string;
}

interface Section {
  id: string;
  columns: number;
  minHeight?: string | null;
  padding?: string | null;
  background?: { type: string; value?: string } | null;
  zones: Zone[];
}

interface Props {
  sections: unknown[];
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
            {section.padding && <span>{section.padding}</span>}
            {section.background?.type && section.background.type !== 'none' && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] border border-border bg-background">
                {section.background.type}
                {section.background.type === 'image' && (
                  <span className="ml-1 text-accent/70">🖼</span>
                )}
              </span>
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
