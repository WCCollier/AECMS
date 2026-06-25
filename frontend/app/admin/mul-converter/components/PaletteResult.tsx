'use client';

import React from 'react';
import type { MulPalette } from '../mul-converter.types';

const SLOT_ORDER = [
  'background', 'surface', 'surface-raised',
  'foreground', 'muted', 'border',
  'accent', 'accent-hover', 'accent-dim', 'accent-foreground',
];

interface Props {
  palette: MulPalette;
  onChange: (palette: MulPalette) => void;
}

export function PaletteResult({ palette, onChange }: Props) {
  const updateColor = (slot: string, value: string) => {
    onChange({
      ...palette,
      colors: { ...palette.colors, [slot]: value },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{palette.name}</h3>
          <p className="text-xs text-muted">{palette.scheme}</p>
        </div>
        <div className="flex gap-1.5">
          {['accent', 'background', 'surface'].map((slot) => (
            <div
              key={slot}
              className="w-5 h-5 rounded-full border border-border"
              style={{ background: palette.colors[slot] }}
              title={slot}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SLOT_ORDER.map((slot) => (
          <div key={slot} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-border flex-shrink-0"
              style={{ background: palette.colors[slot] ?? '#000000' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted truncate">{slot}</div>
              <input
                type="text"
                value={palette.colors[slot] ?? ''}
                onChange={(e) => updateColor(slot, e.target.value)}
                className="w-full text-xs font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:border-accent"
                placeholder="#000000"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
