'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Search, AlertCircle, Loader2, ExternalLink, Info } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import type { ThemePalette } from '@/lib/themes';
import { MulSettingsPanel } from './components/MulSettingsPanel';
import { PaletteResult } from './components/PaletteResult';
import { LayoutResult } from './components/LayoutResult';
import { AiNotes } from './components/AiNotes';
import { ActionBar } from './components/ActionBar';
import type { MulResult, MulSettings } from './mul-converter.types';

type Phase = 'url' | 'preview' | 'analyzing' | 'results' | 'error';
type AnalyzeStep = 'fetching' | 'analyzing' | 'generating' | null;

const STEP_LABELS: Record<NonNullable<AnalyzeStep>, string> = {
  fetching:   'Fetching page…',
  analyzing:  'Sending to AI…',
  generating: 'Generating images…',
};

export function MulConverterClient() {
  const router = useRouter();

  const { data: settingsData, mutate: mutateSettings } = useSWR<MulSettings>(
    '/mul/settings',
    (url: string) => adminApi.get(url).then((r) => r.data),
  );

  const { data: themeData, mutate: mutateTheme } = useSWR<{ customPalettes?: ThemePalette[] }>(
    '/settings-public/theme',
    (url: string) => adminApi.get(url).then((r) => r.data),
  );

  const [url, setUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('url');
  const [useImages, setUseImages] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<AnalyzeStep>(null);
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<MulResult | null>(null);
  const [editPalette, setEditPalette] = useState<MulResult['palette'] | null>(null);
  const [error, setError] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const settings = settingsData ?? {} as MulSettings;
  const customPalettes = themeData?.customPalettes ?? [];

  // Auto-enable images on first load if a provider is configured; user can toggle per-run
  const hasImageProvider = Boolean(settings['mul.image_provider']) && settings['mul.image_provider'] !== 'disabled';
  useEffect(() => {
    if (settingsData) setUseImages(hasImageProvider);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settingsData]);

  const handleLoadPreview = () => {
    if (!url) return;
    try { new URL(url); } catch {
      setError('Please enter a valid URL including https://');
      return;
    }
    setPreviewUrl(url);
    setPhase('preview');
    setError('');
  };

  const handleAnalyze = async () => {
    setPhase('analyzing');
    setError('');
    setAnalyzeStep('fetching');

    // Simulate progress steps (real work happens server-side in one call)
    const stepTimer = setTimeout(() => setAnalyzeStep('analyzing'), 1500);
    const hasImages = useImages && hasImageProvider;

    try {
      if (hasImages) {
        const imageTimer = setTimeout(() => {
          clearTimeout(stepTimer);
          setAnalyzeStep('generating');
        }, 4000);
        const res = await adminApi.post<MulResult>('/mul/analyze', { url, generateImages: true });
        clearTimeout(imageTimer);
        setResult(res.data);
        setEditPalette(res.data.palette);
      } else {
        const res = await adminApi.post<MulResult>('/mul/analyze', { url, generateImages: false });
        clearTimeout(stepTimer);
        setResult(res.data);
        setEditPalette(res.data.palette);
      }
      setPhase('results');
    } catch (e: any) {
      clearTimeout(stepTimer);
      const msg = e.response?.data?.message ?? e.message ?? 'Analysis failed.';
      setError(msg);
      setPhase('error');
    } finally {
      setAnalyzeStep(null);
    }
  };

  const handleSaveSettings = async (updates: Partial<MulSettings>) => {
    await adminApi.patch('/mul/settings', { updates });
    mutateSettings();
  };

  const handlePageCreated = (pageId: string) => {
    router.push(`/admin/pages/${pageId}`);
  };

  if (!settingsData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mul Converter</h1>
          <p className="text-sm text-muted mt-0.5">Extract a color palette and page scaffold from any public URL.</p>
        </div>
      </div>

      {/* Settings panel */}
      <MulSettingsPanel settings={settings} onSave={handleSaveSettings} />

      {/* URL input */}
      <div className="mb-6">
        <label className="text-xs text-muted font-medium mb-2 block">Target URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (phase !== 'url') setPhase('url'); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadPreview()}
            placeholder="https://example.com/page-to-analyze"
            className="flex-1 px-3 py-2 bg-surface border border-border rounded text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleLoadPreview}
            disabled={!url}
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-raised border border-border rounded text-sm disabled:opacity-50 transition-colors"
          >
            <ExternalLink size={14} />
            Load Preview
          </button>
        </div>
        {error && phase !== 'analyzing' && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Preview iframe */}
      {(phase === 'preview' || phase === 'analyzing' || phase === 'results') && previewUrl && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Preview</span>
            <span className="text-xs text-muted flex items-center gap-1">
              <Info size={11} />
              If the preview is blank, the site blocks embedding — analysis still works.
            </span>
          </div>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-[400px] rounded-xl border border-border bg-surface"
            title="Target page preview"
          />

          {phase === 'preview' && (
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => { setPhase('url'); setPreviewUrl(''); }}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                ← Try a different URL
              </button>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => hasImageProvider && setUseImages(!useImages)}
                  title={hasImageProvider ? undefined : 'Configure an image provider in AI Provider Settings'}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${hasImageProvider ? 'cursor-pointer' : 'cursor-default opacity-40'} ${useImages && hasImageProvider ? 'text-accent' : 'text-muted'}`}
                >
                  <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${useImages && hasImageProvider ? 'bg-accent' : 'bg-border'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${useImages && hasImageProvider ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                  Images
                </button>
                <button
                  onClick={handleAnalyze}
                  className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium rounded transition-colors"
                >
                  <Search size={14} />
                  Looks right — Analyze
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analyzing state */}
      {phase === 'analyzing' && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span className="text-sm">{analyzeStep ? STEP_LABELS[analyzeStep] : 'Working…'}</span>
          {analyzeStep === 'analyzing' && (
            <span className="text-xs text-center max-w-sm">
              This can take a minute or more. If no error appears, your request is still processing — please don't close this tab.
            </span>
          )}
          {imageProgress && (
            <span className="text-xs">
              Generating image {imageProgress.current} of {imageProgress.total}…
            </span>
          )}
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
          <div className="flex items-start gap-2 text-red-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Analysis failed</p>
              <p className="text-xs mt-1 text-red-400/80">{error}</p>
            </div>
          </div>
          <button
            onClick={() => { setPhase('preview'); setError(''); }}
            className="mt-3 text-xs text-muted hover:text-foreground transition-colors"
          >
            ← Try again
          </button>
        </div>
      )}

      {/* Results */}
      {phase === 'results' && result && editPalette && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Palette */}
            <div className="border border-border rounded-xl p-4 bg-surface">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Color Palette</h2>
              <PaletteResult
                palette={editPalette}
                onChange={setEditPalette}
              />
            </div>

            {/* Layout */}
            <div className="border border-border rounded-xl p-4 bg-surface">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Page Layout</h2>
              <LayoutResult sections={result.page.sections} />
            </div>
          </div>

          {/* AI Notes */}
          <div className="border border-border rounded-xl p-4 bg-surface">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">AI Notes</h2>
            <AiNotes
              confidence={result.metadata.confidence}
              notes={result.metadata.notes}
              imagePromptStyle={result.imagePromptStyle}
            />
          </div>

          {/* Actions */}
          <div className="border border-border rounded-xl p-4 bg-surface">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Save Results</h2>
            <ActionBar
              result={{ ...result, palette: editPalette }}
              customPalettes={customPalettes}
              onPaletteSaved={() => mutateTheme()}
              onPageCreated={handlePageCreated}
            />
          </div>

          <div className="text-center">
            <button
              onClick={() => { setPhase('preview'); setResult(null); setEditPalette(null); }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Analyze a different URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
