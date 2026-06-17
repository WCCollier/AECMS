'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Save, Loader2, Palette, Type, ExternalLink } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { PALETTES, FONT_PAIRINGS, buildCssOverrides, getPaletteById, getFontPairingById } from '@/lib/themes';

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

export function AppearanceClient() {
  const { data: settings, mutate } = useSWR<Record<string, string>>('/settings', fetcher);

  const [selectedPalette, setSelectedPalette] = useState('midnight');
  const [selectedFont, setSelectedFont] = useState('default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!settings) return;
    try {
      const theme = settings['theme'] ? JSON.parse(settings['theme'] || '{}') : {};
      if (theme.palette) setSelectedPalette(theme.palette);
      if (theme.fontPairing) setSelectedFont(theme.fontPairing);
    } catch {
      // use defaults
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.patch('/settings', {
        updates: {
          theme: JSON.stringify({ palette: selectedPalette, fontPairing: selectedFont }),
        },
      });
      await mutate();
      setSaved(true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const palette = getPaletteById(selectedPalette);
  const fontPairing = getFontPairingById(selectedFont);
  const previewCss = buildCssOverrides(palette, fontPairing);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Appearance</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">{dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Live preview note */}
      <div className="mb-6 p-3 bg-blue-900/20 border border-blue-800 rounded text-xs text-blue-300">
        Changes are applied site-wide on save. Visitors will see the new theme on their next page load.
        {' '}<a href="/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">
          Preview site <ExternalLink size={10} />
        </a>
      </div>

      {/* Color Palette section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-200">Color Palette</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPalette(p.id); setDirty(true); setSaved(false); }}
              className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                p.id === selectedPalette
                  ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'border-neutral-700 hover:border-neutral-500'
              }`}
              style={{ background: p.colors.background }}
            >
              {/* Colour swatch preview */}
              <div className="p-3">
                <div className="flex gap-1.5 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: p.colors.accent }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: p.colors['accent-hover'] }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: p.colors.muted }} />
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: p.colors.foreground }}>
                  {p.name}
                </div>
                <div className="text-[10px]" style={{ color: p.colors.muted }}>
                  {p.scheme}
                </div>
                {/* Small UI elements preview */}
                <div className="mt-2 rounded px-1.5 py-0.5 text-[10px] font-medium w-fit" style={{ background: p.colors.accent, color: p.colors['accent-foreground'] }}>
                  Button
                </div>
              </div>
              {p.id === selectedPalette && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-current">
                    <path d="M1 5l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Font Pairings section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Type size={16} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-200">Typography</h2>
        </div>
        <div className="space-y-2">
          {FONT_PAIRINGS.map((fp) => (
            <button
              key={fp.id}
              onClick={() => { setSelectedFont(fp.id); setDirty(true); setSaved(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                fp.id === selectedFont
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-neutral-700 hover:border-neutral-600 bg-neutral-900'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-neutral-100">{fp.name}</div>
                <div className="text-xs text-neutral-500">Heading: {fp.headingFont} · Body: {fp.bodyFont}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-neutral-100" style={{ fontFamily: fp.headingCss }}>Aa</div>
                <div className="text-xs text-neutral-400" style={{ fontFamily: fp.bodyCss }}>Bb Cc</div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Font previews above use system fonts. The selected font will be loaded from Google Fonts on the live site.
        </p>
      </section>

      {/* Raw CSS preview */}
      <details className="mb-4">
        <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">View generated CSS</summary>
        <pre className="mt-2 p-3 bg-neutral-900 rounded text-xs text-neutral-400 overflow-x-auto whitespace-pre-wrap">
          {previewCss}
        </pre>
      </details>
    </div>
  );
}
