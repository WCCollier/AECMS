'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Sun, Moon, Minus } from 'lucide-react';
import { MediaPicker } from '@/components/admin/MediaPicker';
import type { SectionBackground, PageZone, ZoneScheme } from '@/types';

// ── Gradient overlay presets ────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  {
    label: 'Bottom Vignette',
    value: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
  },
  {
    label: 'Top Vignette',
    value: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 60%)',
  },
  {
    label: 'Dual Vignette',
    value: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.5) 100%)',
  },
  {
    label: 'Radial',
    value: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
  },
  {
    label: 'Side Fade',
    value: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 50%)',
  },
];

// ── Transition picker options ───────────────────────────────────────────────

type TransitionValue = NonNullable<SectionBackground['transition']>;

interface TransitionOption {
  value: TransitionValue;
  label: string;
  icon: string;
  description: string;
}

const TRANSITION_OPTIONS: TransitionOption[] = [
  { value: 'none',       label: 'Scroll',    icon: '↕', description: 'Scrolls naturally with content' },
  { value: 'fixed',      label: 'Fixed',     icon: '⬛', description: 'Background plants; content flows through' },
  { value: 'fade',       label: 'Fade',      icon: '◐', description: 'Dissolves into next section below' },
  { value: 'wipe-v',     label: 'Wipe ↓',   icon: '▽', description: 'Vertical clip wipe' },
  { value: 'wipe-left',  label: 'Wipe ←',   icon: '◁', description: 'Clip reveals from right edge' },
  { value: 'wipe-right', label: 'Wipe →',   icon: '▷', description: 'Clip reveals from left edge' },
  { value: 'slide-up',   label: 'Slide ↑',  icon: '⬆', description: 'Background slides upward off screen' },
  { value: 'parallax',   label: 'Parallax',  icon: '〰', description: 'Image drifts at ~50% scroll speed' },
];

// ── Zone scheme option definitions ─────────────────────────────────────────

interface ZoneSchemeOption {
  value: ZoneScheme;
  label: string;
  icon: React.ReactNode;
  title: string;
}

const ZONE_SCHEME_OPTIONS: ZoneSchemeOption[] = [
  { value: 'inherit', label: 'Auto',  icon: <Minus className="w-3 h-3" />,  title: 'Auto — follows the site-wide colour scheme' },
  { value: 'light',   label: 'Light', icon: <Sun  className="w-3 h-3" />,   title: 'Light text — use on dark backgrounds' },
  { value: 'dark',    label: 'Dark',  icon: <Moon className="w-3 h-3" />,   title: 'Dark text — use on light backgrounds' },
];

// ── Collapsible sub-section ─────────────────────────────────────────────────

function SubSection({ title, children, defaultOpen = true, tooltip }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
      >
        {title}
        {open
          ? <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          : <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        }
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export interface SectionBackgroundPanelProps {
  open: boolean;
  background?: SectionBackground;
  zones?: PageZone[];
  onUpdate: (bg: SectionBackground) => void;
  onZonesUpdate?: (zones: PageZone[]) => void;
  onClose: () => void;
}

export function SectionBackgroundPanel({
  open,
  background,
  zones,
  onUpdate,
  onZonesUpdate,
  onClose,
}: SectionBackgroundPanelProps) {
  const bg: SectionBackground = background ?? { type: 'none' };

  // Derive current transition (fallback from deprecated attachment)
  const currentTransition: TransitionValue =
    bg.transition ?? (bg.attachment === 'parallax' ? 'parallax' : bg.attachment === 'fixed' ? 'fixed' : 'none');

  // Overlay mode
  type OverlayMode = 'none' | 'solid' | 'gradient';
  const overlayMode: OverlayMode = bg.overlay?.gradient
    ? 'gradient'
    : bg.overlay
    ? 'solid'
    : 'none';

  // Trap scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  function update(patch: Partial<SectionBackground>) {
    onUpdate({ ...bg, ...patch });
  }

  function setOverlayMode(mode: OverlayMode) {
    if (mode === 'none') {
      const { overlay: _, ...rest } = bg;
      onUpdate({ ...rest } as SectionBackground);
    } else if (mode === 'solid') {
      update({ overlay: { color: bg.overlay?.color ?? '#000000', opacity: bg.overlay?.opacity ?? 0.4 } });
    } else {
      update({ overlay: { color: '#000000', opacity: 1, gradient: bg.overlay?.gradient ?? GRADIENT_PRESETS[0].value } });
    }
  }

  function setZoneScheme(zoneIdx: number, scheme: ZoneScheme) {
    if (!zones || !onZonesUpdate) return;
    onZonesUpdate(zones.map((z, i) => (i === zoneIdx ? { ...z, scheme } : z)));
  }

  const showTransition = bg.type === 'image' || bg.type === 'gradient';
  const hasZones = zones && zones.length > 0 && onZonesUpdate;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Slide-in drawer — w-96 = 384px */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-surface border-l border-border shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised flex-shrink-0">
          <span className="text-sm font-semibold">Section Background</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface transition-colors text-foreground/50 hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 1. Background ─────────────────────────────────────── */}
          <SubSection title="Background">
            {/* Type selector */}
            <div>
              <p className="text-[11px] text-foreground/50 mb-1.5">Type</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(['none', 'color', 'gradient', 'image'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ type: t, value: bg.value })}
                    className={`py-1.5 rounded text-[11px] border transition-colors capitalize ${
                      bg.type === t
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:bg-surface-raised'
                    }`}
                  >
                    {t === 'none' ? 'None' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            {bg.type === 'color' && (
              <div>
                <p className="text-[11px] text-foreground/50 mb-1.5">Color</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={bg.value ?? '#1a2b3c'}
                    onChange={(e) => update({ value: e.target.value })}
                    className="w-9 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={bg.value ?? ''}
                    onChange={(e) => update({ value: e.target.value })}
                    className="flex-1 text-xs px-2 py-1.5 border border-border rounded font-mono bg-background"
                    placeholder="#1a2b3c"
                  />
                </div>
              </div>
            )}

            {/* Gradient */}
            {bg.type === 'gradient' && (
              <div className="space-y-2">
                <p className="text-[11px] text-foreground/50">CSS Gradient</p>
                <textarea
                  value={bg.value ?? ''}
                  onChange={(e) => update({ value: e.target.value })}
                  rows={3}
                  className="w-full text-[11px] px-2 py-1.5 border border-border rounded font-mono bg-background resize-none"
                  placeholder="linear-gradient(135deg, #0f2027 0%, #2c5364 100%)"
                />
                {bg.value && (
                  <div className="h-10 rounded border border-border" style={{ background: bg.value }} />
                )}
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: 'Dark Depth', value: 'linear-gradient(160deg, #0d1b2a 0%, #1b263b 60%, #415a77 100%)' },
                    { label: 'Warm Dusk',  value: 'linear-gradient(135deg, #2c1654 0%, #9b4dca 100%)' },
                    { label: 'Forest',     value: 'linear-gradient(160deg, #0f3443 0%, #34e89e 100%)' },
                    { label: 'Editorial',  value: 'linear-gradient(180deg, #f5f0e8 0%, #e8dcc8 100%)' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => update({ value: p.value })}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border hover:bg-surface-raised text-[11px] text-left"
                    >
                      <span
                        className="w-4 h-4 rounded-sm flex-shrink-0 border border-border/50"
                        style={{ background: p.value }}
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image — media picker */}
            {bg.type === 'image' && (
              <div className="space-y-2">
                <p className="text-[11px] text-foreground/50">
                  Select or upload an image. Larger, landscape images work best as section backgrounds.
                </p>
                <MediaPicker
                  value={bg.value && bg.value.startsWith('http') ? bg.value : undefined}
                  onChange={(url) => update({ value: url ?? '' })}
                  mimeFilter="image/*"
                  showDimensions
                  compact
                />
                {/* Fallback: paste an external URL */}
                <details className="mt-1">
                  <summary className="text-[10px] text-foreground/40 cursor-pointer hover:text-foreground/60 select-none">
                    Or paste an external URL
                  </summary>
                  <input
                    type="url"
                    value={bg.value ?? ''}
                    onChange={(e) => update({ value: e.target.value })}
                    className="mt-1.5 w-full text-xs px-2 py-1.5 border border-border rounded bg-background"
                    placeholder="https://…"
                  />
                </details>
              </div>
            )}
          </SubSection>

          {/* ── 2. Overlay ────────────────────────────────────────── */}
          {bg.type !== 'none' && (
            <SubSection title="Overlay">
              {/* Mode selector */}
              <div>
                <p className="text-[11px] text-foreground/50 mb-1.5">Mode</p>
                <div className="flex gap-1">
                  {(['none', 'solid', 'gradient'] as OverlayMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOverlayMode(m)}
                      className={`flex-1 py-1 rounded text-[11px] border transition-colors capitalize ${
                        overlayMode === m
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border hover:bg-surface-raised'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {overlayMode === 'solid' && bg.overlay && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={bg.overlay.color}
                      onChange={(e) => update({ overlay: { ...bg.overlay!, color: e.target.value } })}
                      className="w-9 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={bg.overlay.color}
                      onChange={(e) => update({ overlay: { ...bg.overlay!, color: e.target.value } })}
                      className="w-20 text-xs px-2 py-1.5 border border-border rounded font-mono bg-background"
                    />
                    <span className="text-[11px] text-foreground/50 w-8 text-right flex-shrink-0">
                      {Math.round(bg.overlay.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={bg.overlay.opacity}
                    onChange={(e) => update({ overlay: { ...bg.overlay!, opacity: parseFloat(e.target.value) } })}
                    className="w-full"
                  />
                  {/* Live preview */}
                  <div className="h-8 rounded border border-border relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: bg.overlay.color, opacity: bg.overlay.opacity }}
                    />
                  </div>
                </div>
              )}

              {overlayMode === 'gradient' && bg.overlay?.gradient != null && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-1">
                    {GRADIENT_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => update({ overlay: { color: '#000000', opacity: 1, gradient: p.value } })}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] text-left transition-colors ${
                          bg.overlay?.gradient === p.value
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border hover:bg-surface-raised'
                        }`}
                      >
                        <span
                          className="w-8 h-5 rounded-sm flex-shrink-0 border border-border/50"
                          style={{ background: p.value }}
                        />
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={bg.overlay.gradient}
                    onChange={(e) => update({ overlay: { color: '#000000', opacity: 1, gradient: e.target.value } })}
                    rows={2}
                    className="w-full text-[11px] px-2 py-1.5 border border-border rounded font-mono bg-background resize-none"
                    placeholder="linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"
                  />
                  {/* Live preview */}
                  <div className="h-8 rounded border border-border relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: bg.overlay.gradient }}
                    />
                  </div>
                </div>
              )}
            </SubSection>
          )}

          {/* ── 3. Transition ─────────────────────────────────────── */}
          {showTransition && (
            <SubSection title="Transition">
              <p className="text-[11px] text-foreground/50 -mt-1 mb-2">
                How this section&apos;s background enters and exits as you scroll.
              </p>
              <div className="space-y-1">
                {TRANSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ transition: opt.value })}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded border text-left transition-colors ${
                      currentTransition === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:bg-surface-raised'
                    }`}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0 leading-none">
                      {opt.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{opt.label}</p>
                      <p className="text-[10px] text-foreground/50 leading-tight">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              {(currentTransition !== 'none' && currentTransition !== 'fixed') && (
                <p className="text-[10px] text-foreground/40 mt-2 leading-relaxed">
                  Tip: set a min-height of 60vh or more for image backgrounds with transitions so they have room to animate.
                </p>
              )}
            </SubSection>
          )}

          {/* ── 4. Zone Text ──────────────────────────────────────── */}
          {hasZones && (
            <SubSection
              title="Zone Text"
              defaultOpen={false}
              tooltip="Set the text colour scheme for each zone to match the section background. Use Light text on dark backgrounds, Dark text on light ones."
            >
              <p className="text-[11px] text-foreground/50 -mt-1 mb-2 leading-relaxed">
                Match text colour to the background. <strong className="text-foreground/70">Light</strong> on dark backgrounds,{' '}
                <strong className="text-foreground/70">Dark</strong> on light ones.
              </p>
              <div className="space-y-2">
                {zones.map((zone, idx) => (
                  <div key={zone.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-foreground/50 w-14 flex-shrink-0">
                      {zones.length === 1 ? 'Text' : `Zone ${idx + 1}`}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {ZONE_SCHEME_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setZoneScheme(idx, opt.value)}
                          title={opt.title}
                          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[11px] transition-colors ${
                            (zone.scheme ?? 'inherit') === opt.value
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border hover:bg-surface-raised text-foreground/60'
                          }`}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SubSection>
          )}

        </div>
      </div>
    </>
  );
}
