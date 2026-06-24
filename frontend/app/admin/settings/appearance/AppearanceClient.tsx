'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Save, Loader2, Palette, Type, ExternalLink, Plus, Trash2, BookOpen } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { PALETTES, FONT_PAIRINGS, buildCssOverrides, getPaletteById, getFontPairingById, type ThemePalette } from '@/lib/themes';
import { CURATED_FONTS, type FontEntry } from '@/lib/fonts';

export function AppearanceClient() {
  const { data: currentTheme, mutate: mutateTheme } = useSWR<{ palette: string; fontPairing: string; customPalettes?: ThemePalette[] }>(
    '/settings-public/theme',
    (url: string) => adminApi.get(url).then((r) => r.data),
  );

  const { data: fontsData, mutate: mutateFonts } = useSWR<{ customFonts: FontEntry[] }>(
    '/settings-public/fonts',
    (url: string) => adminApi.get(url).then((r) => r.data),
  );
  const customFonts: FontEntry[] = fontsData?.customFonts ?? [];
  const customPalettes: ThemePalette[] = currentTheme?.customPalettes ?? [];

  const [selectedPalette, setSelectedPalette] = useState('midnight');
  const [selectedFont, setSelectedFont] = useState('default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Custom font form state
  const [showAddFont, setShowAddFont] = useState(false);
  const [newFont, setNewFont] = useState({ name: '', importUrl: '', headingFamily: '', bodyFamily: '' });
  const [savingFont, setSavingFont] = useState(false);
  const [fontError, setFontError] = useState('');

  useEffect(() => {
    if (!currentTheme) return;
    if (currentTheme.palette) setSelectedPalette(currentTheme.palette);
    if (currentTheme.fontPairing) setSelectedFont(currentTheme.fontPairing);
  }, [currentTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.patch('/settings/appearance', {
        updates: {
          theme: JSON.stringify({ palette: selectedPalette, fontPairing: selectedFont }),
        },
      });
      // Inject updated CSS variables immediately so the owner sees the change without a reload.
      // Mirrors what RootLayout's <style dangerouslySetInnerHTML> does on the server.
      let liveStyle = document.getElementById('aecms-theme-live') as HTMLStyleElement | null;
      if (!liveStyle) {
        liveStyle = document.createElement('style');
        liveStyle.id = 'aecms-theme-live';
        document.head.appendChild(liveStyle);
      }
      liveStyle.textContent = previewCss;
      setSaved(true);
      setDirty(false);
    } catch {
      // leave saving=true state on network error so the button re-enables
    } finally {
      setSaving(false);
    }
  };

  const palette = getPaletteById(selectedPalette, customPalettes);
  const fontPairing = getFontPairingById(selectedFont);
  const previewCss = buildCssOverrides(palette, fontPairing);

  async function handleAddFont() {
    if (!newFont.name || !newFont.importUrl || !newFont.headingFamily || !newFont.bodyFamily) {
      setFontError('All fields are required.');
      return;
    }
    setSavingFont(true);
    setFontError('');
    try {
      const entry: FontEntry = {
        id: `custom-${Date.now()}`,
        name: newFont.name,
        importUrl: newFont.importUrl,
        headingFamily: newFont.headingFamily,
        bodyFamily: newFont.bodyFamily,
        category: 'editorial',
      };
      const updated = [...customFonts, entry];
      await adminApi.patch('/settings/appearance', {
        updates: { 'appearance.fonts': JSON.stringify(updated) },
      });
      await mutateFonts();
      setNewFont({ name: '', importUrl: '', headingFamily: '', bodyFamily: '' });
      setShowAddFont(false);
    } catch {
      setFontError('Failed to save. Try again.');
    } finally {
      setSavingFont(false);
    }
  }

  async function handleDeleteFont(id: string) {
    const updated = customFonts.filter(f => f.id !== id);
    await adminApi.patch('/settings/appearance', {
      updates: { 'appearance.fonts': JSON.stringify(updated) },
    });
    await mutateFonts();
  }

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
          {[...PALETTES, ...customPalettes].map((p) => {
            const isCustom = !PALETTES.find((bp) => bp.id === p.id);
            return (
              <div key={p.id} className="relative">
                <button
                  onClick={() => { setSelectedPalette(p.id); setDirty(true); setSaved(false); }}
                  className={`relative w-full rounded-xl overflow-hidden border-2 transition-all text-left ${
                    p.id === selectedPalette
                      ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                      : 'border-neutral-700 hover:border-neutral-500'
                  }`}
                  style={{ background: p.colors.background }}
                >
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
                      {isCustom && <span className="ml-1 opacity-70">· Custom</span>}
                    </div>
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
                {isCustom && (
                  <button
                    onClick={async () => {
                      const updated = customPalettes.filter((cp) => cp.id !== p.id);
                      await adminApi.patch('/settings/appearance', { customPalettes: updated });
                      mutateTheme();
                      if (selectedPalette === p.id) setSelectedPalette('midnight');
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-900/80 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center z-10"
                    title="Delete custom palette"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
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

      {/* Page Font Library section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-200">Page Font Library</h2>
          </div>
          <button
            onClick={() => setShowAddFont(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <Plus size={12} />
            Add Google Font
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
          These fonts are available in the page editor font picker. Curated pairs are always available; custom entries are stored here.
        </p>

        {/* Add custom font form */}
        {showAddFont && (
          <div className="mb-4 p-4 bg-neutral-900 border border-neutral-700 rounded-lg space-y-3">
            <p className="text-xs font-medium text-neutral-300">Add Custom Google Font</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Display name</label>
                <input
                  value={newFont.name}
                  onChange={e => setNewFont(v => ({ ...v, name: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100"
                  placeholder="Playfair / Source Serif"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Google Fonts URL</label>
                <input
                  value={newFont.importUrl}
                  onChange={e => setNewFont(v => ({ ...v, importUrl: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 font-mono"
                  placeholder="https://fonts.googleapis.com/css2?..."
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Heading font-family CSS</label>
                <input
                  value={newFont.headingFamily}
                  onChange={e => setNewFont(v => ({ ...v, headingFamily: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 font-mono"
                  placeholder="'Playfair Display', Georgia, serif"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Body font-family CSS</label>
                <input
                  value={newFont.bodyFamily}
                  onChange={e => setNewFont(v => ({ ...v, bodyFamily: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 font-mono"
                  placeholder="'Source Serif 4', Georgia, serif"
                />
              </div>
            </div>
            {fontError && <p className="text-xs text-red-400">{fontError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddFont}
                disabled={savingFont}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded"
              >
                {savingFont ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add to library
              </button>
              <button
                onClick={() => { setShowAddFont(false); setFontError(''); }}
                className="text-xs px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-neutral-400 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Curated fonts */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2">Curated (always available)</p>
          {CURATED_FONTS.filter(f => !f.isSystem).map(f => (
            <div key={f.id} className="flex items-center justify-between p-2.5 bg-neutral-900 rounded border border-neutral-800">
              <div>
                <span className="text-xs font-medium text-neutral-200">{f.name}</span>
                <span className="ml-2 text-[10px] text-neutral-600">{f.category}</span>
              </div>
              <div className="text-[10px] text-neutral-500">
                H: {f.headingFamily.split(',')[0].replace(/'/g, '')} · B: {f.bodyFamily.split(',')[0].replace(/'/g, '')}
              </div>
            </div>
          ))}
        </div>

        {/* Custom fonts */}
        {customFonts.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2">Custom</p>
            {customFonts.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2.5 bg-neutral-900 rounded border border-neutral-700">
                <div>
                  <span className="text-xs font-medium text-neutral-200">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-neutral-500">
                    H: {f.headingFamily.split(',')[0].replace(/'/g, '')} · B: {f.bodyFamily.split(',')[0].replace(/'/g, '')}
                  </span>
                  <button
                    onClick={() => handleDeleteFont(f.id)}
                    className="text-neutral-600 hover:text-red-400 transition-colors"
                    title="Remove custom font"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
