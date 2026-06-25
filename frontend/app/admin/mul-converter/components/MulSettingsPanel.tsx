'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, ChevronDown } from 'lucide-react';
import type { MulSettings } from '../mul-converter.types';

type ModelOption = { value: string; label: string };

const TEXT_PROVIDERS: { value: string; label: string; models: ModelOption[] }[] = [
  {
    value: 'anthropic', label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 — Recommended' },
      { value: 'claude-opus-4-8',           label: 'Claude Opus 4.8 — Most capable' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — Fastest' },
    ],
  },
  {
    value: 'openai', label: 'OpenAI',
    models: [
      { value: 'gpt-4o',       label: 'GPT-4o — Recommended' },
      { value: 'gpt-4o-mini',  label: 'GPT-4o Mini — Fast' },
      { value: 'gpt-4.1',      label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { value: 'o3',           label: 'o3 — Reasoning' },
      { value: 'o4-mini',      label: 'o4-mini — Reasoning, fast' },
    ],
  },
  {
    value: 'xai', label: 'xAI (Grok)',
    models: [
      { value: 'grok-4',      label: 'Grok 4 — Recommended' },
      { value: 'grok-3',      label: 'Grok 3' },
      { value: 'grok-3-mini', label: 'Grok 3 Mini — Fast' },
    ],
  },
];

const IMAGE_PROVIDERS: { value: string; label: string; models?: ModelOption[] }[] = [
  { value: '', label: 'Disabled' },
  {
    value: 'openai', label: 'OpenAI',
    models: [
      { value: 'gpt-image-1', label: 'GPT Image 1' },
    ],
  },
  {
    value: 'xai', label: 'xAI (Aurora)',
    models: [
      { value: 'grok-imagine-image-quality', label: 'Aurora — Quality' },
      { value: 'grok-imagine-image-speed',   label: 'Aurora — Speed' },
    ],
  },
  {
    value: 'flux', label: 'Flux (fal.ai)',
    models: [
      { value: 'fal-ai/flux/schnell',  label: 'FLUX Schnell — Fastest' },
      { value: 'fal-ai/flux/dev',      label: 'FLUX Dev — Quality' },
      { value: 'fal-ai/flux-pro',      label: 'FLUX Pro — Best quality' },
      { value: 'flux-kontext-pro',     label: 'FLUX Kontext Pro — Editing' },
    ],
  },
  {
    value: 'stability', label: 'Stability AI',
    models: [
      { value: 'stable-image-ultra',            label: 'Stable Image Ultra — Best' },
      { value: 'stable-image-core',             label: 'Stable Image Core' },
      { value: 'stable-diffusion-xl-1024-v1-0', label: 'SDXL 1.0' },
    ],
  },
];

interface Props {
  settings: MulSettings;
  onSave: (updates: Partial<MulSettings>) => Promise<void>;
}

export function MulSettingsPanel({ settings, onSave }: Props) {
  const [open, setOpen] = useState(!settings['mul.text_provider']);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [textProvider, setTextProvider] = useState(settings['mul.text_provider'] || 'anthropic');
  const [textModel, setTextModel] = useState(settings['mul.text_model'] || 'claude-sonnet-4-6');
  const [textKey, setTextKey] = useState('');

  const [imageProvider, setImageProvider] = useState(
    settings['mul.image_provider'] === 'disabled' ? '' : (settings['mul.image_provider'] || ''),
  );
  const [imageModel, setImageModel] = useState(settings['mul.image_model'] || '');
  const [imageKey, setImageKey] = useState('');
  const [referenceMode, setReferenceMode] = useState(settings['mul.image_reference_mode'] === 'reference');

  useEffect(() => {
    const def = TEXT_PROVIDERS.find((p) => p.value === textProvider);
    if (def && !textModel) setTextModel(def.models[0]?.value ?? '');
  }, [textProvider]);

  useEffect(() => {
    if (imageProvider) {
      const def = IMAGE_PROVIDERS.find((p) => p.value === imageProvider);
      if (def?.models?.length && !imageModel) setImageModel(def.models[0].value);
    }
  }, [imageProvider]);

  const sameProvider = textProvider === imageProvider && Boolean(imageProvider);

  const handleSave = async () => {
    setSaving(true);
    const updates: Record<string, string> = {
      'mul.text_provider': textProvider,
      'mul.text_model': textModel,
      'mul.image_provider': imageProvider,
      'mul.image_model': imageModel,
      'mul.image_reference_mode': referenceMode ? 'reference' : 'brief-only',
    };

    // Only send keys if user typed something
    if (textKey) updates[`mul.${textProvider}_api_key_enc`] = textKey;
    if (imageKey && !sameProvider) {
      const imgKeyName = imageProvider === 'flux' ? 'fal' : imageProvider;
      updates[`mul.${imgKeyName}_api_key_enc`] = imageKey;
    }

    try {
      await onSave(updates as Partial<MulSettings>);
      setSaved(true);
      setTextKey('');
      setImageKey('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-raised text-sm font-medium text-foreground/80 transition-colors"
      >
        <span>AI Provider Settings</span>
        <div className="flex items-center gap-2 text-xs text-muted">
          {settings['mul.text_provider'] && (
            <span>{settings['mul.text_provider'].toUpperCase()} · {settings['mul.text_model'] || 'default model'}</span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="p-4 border-t border-border bg-surface space-y-6">
          {!settings['mul.text_provider'] && (
            <div className="p-3 bg-accent/10 border border-accent/20 rounded text-xs text-accent">
              Configure your AI provider before running your first analysis.
            </div>
          )}

          {/* Text Model group */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Text Model</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Provider</label>
                <div className="flex gap-2">
                  {TEXT_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setTextProvider(p.value);
                        setTextModel(p.models[0]?.value ?? '');
                      }}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        textProvider === p.value
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'border-border text-muted hover:border-muted'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Model</label>
                <select
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {(TEXT_PROVIDERS.find((p) => p.value === textProvider)?.models ?? []).map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">API Key</label>
                <input
                  type="password"
                  value={textKey}
                  onChange={(e) => setTextKey(e.target.value)}
                  placeholder={settings[`mul.${textProvider}_api_key_enc` as keyof MulSettings] ? '••••••••' : textProvider === 'anthropic' ? 'Leave blank to use server ANTHROPIC_API_KEY' : 'Paste API key'}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Image Generation group */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Image Generation</h3>
            <p className="text-xs text-muted mb-3">Configure a provider here. Use the toggle next to Analyze to enable/disable per run.</p>

            <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Provider</label>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_PROVIDERS.filter((p) => p.value).map((p) => (
                      <button
                        key={p.value}
                        onClick={() => {
                          setImageProvider(p.value);
                          setImageModel(p.models?.[0]?.value ?? '');
                        }}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                          imageProvider === p.value
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'border-border text-muted hover:border-muted'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Model</label>
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {(IMAGE_PROVIDERS.find((p) => p.value === imageProvider)?.models ?? []).map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                {!sameProvider && imageProvider && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">API Key</label>
                    <input
                      type="password"
                      value={imageKey}
                      onChange={(e) => setImageKey(e.target.value)}
                      placeholder="Paste API key"
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
                {sameProvider && (
                  <p className="text-xs text-muted">API key shared with text model provider.</p>
                )}
                <div>
                  <label className="text-xs text-muted mb-2 block">Mode</label>
                  <div className="flex gap-2">
                    {[
                      { value: false, label: 'Brief-only' },
                      { value: true,  label: '+ Reference images' },
                    ].map((m) => (
                      <button
                        key={String(m.value)}
                        onClick={() => setReferenceMode(m.value)}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                          referenceMode === m.value
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'border-border text-muted hover:border-muted'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {referenceMode && (
                    <p className="mt-2 text-xs text-amber-400/80 border border-amber-500/20 rounded p-2 bg-amber-500/5">
                      Reference mode passes images from the source URL to your image provider for style reference. Only enable if you own or have rights to the source images.
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Image generation adds ~10–30s per image. Generated images are saved to your Media Library.
                  {imageProvider && imageProvider === textProvider && (
                    <span className="ml-1 text-accent/80">Native optimization active — analysis and images run in one conversation.</span>
                  )}
                </p>
              </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted">{saved ? 'Saved' : ''}</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-xs font-medium px-4 py-2 rounded transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
