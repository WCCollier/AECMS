'use client';

import React, { useState } from 'react';
import type { ImagePromptStyle } from '../mul-converter.types';

const CONFIDENCE_COLORS = {
  high:   'bg-green-900/30 text-green-400 border-green-700/30',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30',
  low:    'bg-red-900/30 text-red-400 border-red-700/30',
};

interface Props {
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  imagePromptStyle?: ImagePromptStyle;
}

export function AiNotes({ confidence, notes, imagePromptStyle }: Props) {
  const [showStyle, setShowStyle] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded border capitalize ${CONFIDENCE_COLORS[confidence]}`}>
          {confidence}
        </span>
        <p className="text-sm text-foreground/80 leading-relaxed">{notes}</p>
      </div>

      {imagePromptStyle && (
        <div className="border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowStyle(!showStyle)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted hover:text-foreground transition-colors bg-surface"
          >
            <span>Image prompt strategy · {imagePromptStyle.model}</span>
            <span>{showStyle ? '▲' : '▼'}</span>
          </button>
          {showStyle && (
            <div className="p-3 bg-background space-y-2 text-xs">
              <p className="text-foreground/70">{imagePromptStyle.approach}</p>
              <div className="font-mono text-accent/80 bg-surface rounded px-2 py-1.5 border border-border">
                {imagePromptStyle.exampleFormat}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
