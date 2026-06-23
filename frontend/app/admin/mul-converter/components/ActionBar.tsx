'use client';

import React, { useState } from 'react';
import { Loader2, Save, FileText, Layers } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import type { MulResult } from '../mul-converter.types';
import type { ThemePalette } from '@/lib/themes';

interface Props {
  result: MulResult;
  customPalettes: ThemePalette[];
  onPaletteSaved: () => void;
  onPageCreated: (id: string) => void;
}

type State = 'idle' | 'savingPalette' | 'creatingPage' | 'savingBoth' | 'done' | 'error';

export function ActionBar({ result, customPalettes, onPaletteSaved, onPageCreated }: Props) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  const newPalette: ThemePalette = {
    id: `custom-${crypto.randomUUID()}`,
    name: result.palette.name,
    scheme: result.palette.scheme,
    colors: result.palette.colors as unknown as ThemePalette['colors'],
  };

  const savePalette = async () => {
    await adminApi.patch('/settings/appearance', {
      customPalettes: [...customPalettes, newPalette],
    });
    onPaletteSaved();
  };

  const createPage = async (): Promise<string> => {
    const pageContent = {
      type: 'sections',
      fontImport: result.page.fontImport ?? undefined,
      fontVariables: result.page.fontVariables ?? undefined,
      sections: result.page.sections,
    };

    const res = await adminApi.post('/pages', {
      title: result.page.suggestedTitle || 'Mul Converter Draft',
      slug: `mul-draft-${Date.now()}`,
      status: 'draft',
      content: pageContent,
    });
    return res.data.id;
  };

  const handlePaletteOnly = async () => {
    setState('savingPalette');
    setError('');
    try {
      await savePalette();
      setState('done');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save palette.');
      setState('error');
    }
  };

  const handlePageOnly = async () => {
    setState('creatingPage');
    setError('');
    try {
      const id = await createPage();
      setState('done');
      onPageCreated(id);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create page draft.');
      setState('error');
    }
  };

  const handleBoth = async () => {
    setState('savingBoth');
    setError('');
    try {
      const [, id] = await Promise.all([savePalette(), createPage()]);
      setState('done');
      onPageCreated(id);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save.');
      setState('error');
    }
  };

  const busy = state === 'savingPalette' || state === 'creatingPage' || state === 'savingBoth';

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded p-2">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handlePaletteOnly}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-border rounded hover:bg-surface-raised disabled:opacity-50 transition-colors"
        >
          {state === 'savingPalette' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Palette Only
        </button>

        <button
          onClick={handlePageOnly}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-border rounded hover:bg-surface-raised disabled:opacity-50 transition-colors"
        >
          {state === 'creatingPage' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Create Page Draft
        </button>

        <button
          onClick={handleBoth}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-accent-foreground rounded disabled:opacity-50 transition-colors font-medium"
        >
          {state === 'savingBoth' ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
          {state === 'savingBoth' ? 'Saving…' : 'Save Both'}
        </button>
      </div>

      {state === 'done' && (
        <p className="text-xs text-green-400">Done! Check your Media Library for generated images.</p>
      )}
    </div>
  );
}
