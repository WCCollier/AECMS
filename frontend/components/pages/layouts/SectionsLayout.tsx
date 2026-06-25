'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { SectionsPageContent, SectionBackground, SectionPadding, PageSection, PageZone, ZoneScheme, ZoneAlign, ZoneWidth, SectionBorder, SectionVisibility, BgMovement, BgExit } from '@/types';

const PADDING_CLASSES: Record<SectionPadding, string> = {
  none:      'py-0',
  compact:   'py-8',
  normal:    'py-16',
  spacious:  'py-24',
};

const ZONE_SCHEME_CLASSES: Record<ZoneScheme, string> = {
  inherit: '',
  light:   'zone-scheme-light',
  dark:    'zone-scheme-dark',
};

const ZONE_ALIGN_STYLES: Record<ZoneAlign, React.CSSProperties> = {
  start:  { alignSelf: 'start' },
  center: { alignSelf: 'center' },
  end:    { alignSelf: 'end' },
};

const ZONE_WIDTH_CLASSES: Record<ZoneWidth, string> = {
  full:    '',
  reading: 'max-w-2xl mx-auto w-full',
  narrow:  'max-w-lg mx-auto w-full',
};

const BORDER_CLASSES: Record<SectionBorder, string> = {
  none:   '',
  top:    'border-t border-border',
  bottom: 'border-b border-border',
  both:   'border-t border-b border-border',
};

// ---------------------------------------------------------------------------
// Read-time backward-compat resolution: maps deprecated transition/attachment
// fields to the new mode/movement/exit model.
// ---------------------------------------------------------------------------
function resolveMode(bg: SectionBackground | undefined): 'traditional' | 'animated' {
  if (!bg) return 'traditional';
  if (bg.mode) return bg.mode;
  // Legacy: transition='none' or no transition → traditional
  if (!bg.transition || bg.transition === 'none') {
    if (!bg.attachment || bg.attachment === 'scroll') return 'traditional';
  }
  return 'animated';
}

function resolveMovement(bg: SectionBackground | undefined): BgMovement {
  if (!bg) return 'fixed';
  if (bg.movement) return bg.movement;
  // Legacy mapping
  if (bg.transition === 'parallax' || bg.attachment === 'parallax') return 'parallax';
  return 'fixed';
}

function resolveExit(bg: SectionBackground | undefined): BgExit {
  if (!bg) return 'none';
  if (bg.exit) return bg.exit;
  // Legacy mapping: transition values that represent exits
  const t = bg.transition;
  if (t === 'fade' || t === 'wipe-v' || t === 'wipe-left' || t === 'wipe-right' || t === 'slide-up') return t;
  return 'none';
}

function needsFixedStack(section: PageSection): boolean {
  const mode = resolveMode(section.background);
  return mode === 'animated' && !!section.background && section.background.type !== 'none';
}

// ---------------------------------------------------------------------------
// Resolve the effective value for a background, supporting both the new
// per-type fields (colorValue/gradientValue/imageValue) and the legacy
// single `value` field for sections saved before this change.
// ---------------------------------------------------------------------------
function resolveValue(bg: SectionBackground): string | undefined {
  if (bg.type === 'color')    return bg.colorValue    ?? bg.value;
  if (bg.type === 'gradient') return bg.gradientValue ?? bg.value;
  if (bg.type === 'image')    return bg.imageValue    ?? bg.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Inline background style — Traditional/Scroll sections, cover mode only.
// Fit-width is handled separately in the render path using an <img> element
// so that overlays are bounded by the image's natural height, not the section.
// ---------------------------------------------------------------------------
function buildInlineStyle(bg: SectionBackground): React.CSSProperties {
  if (bg.type === 'none') return {};
  const v = resolveValue(bg);
  if (bg.type === 'color') return { backgroundColor: v };
  if (bg.type === 'gradient') return { background: v };
  if (bg.type === 'image' && v) {
    return {
      backgroundImage: `url(${v})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// OverlayDiv — solid or gradient overlay
// ---------------------------------------------------------------------------
function OverlayDiv({ overlay }: { overlay: NonNullable<SectionBackground['overlay']> }) {
  const style: React.CSSProperties = overlay.gradient
    ? { background: overlay.gradient }
    : { backgroundColor: overlay.color, opacity: overlay.opacity };
  return <div aria-hidden className="absolute inset-0 pointer-events-none" style={style} />;
}

// ---------------------------------------------------------------------------
// ZoneGrid — shared zone content renderer
// ---------------------------------------------------------------------------
function ZoneGrid({ section }: { section: PageSection }) {
  return (
    <div
      className="relative"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${section.columns}, 1fr)`, gap: '0' }}
    >
      {section.zones.map((zone) => {
        const alignStyle = ZONE_ALIGN_STYLES[zone.align ?? 'start'];
        const widthClass = ZONE_WIDTH_CLASSES[zone.contentWidth ?? 'full'];
        const paddingClass = zone.fullBleed ? '' : 'px-[5%]';
        const schemeClass = ZONE_SCHEME_CLASSES[zone.scheme ?? 'inherit'];
        return (
          <div
            key={zone.id}
            style={{ gridColumn: `span ${zone.span}`, ...alignStyle }}
            className={`${paddingClass} min-w-0 ${schemeClass}`}
          >
            <div className={widthClass}>
              <WidgetSizeProvider size="large">
                <RichTextContent
                  content={zone.content ? JSON.stringify(zone.content) : ''}
                  className="prose-article prose-page"
                />
              </WidgetSizeProvider>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FixedBackgroundLayer — one entry in the fixed-position background stack
// ---------------------------------------------------------------------------
interface FixedLayerProps {
  section: PageSection;
  movement: BgMovement;
  exit: BgExit;
  zIndex: number;
}

function FixedBackgroundLayer({ section, movement, exit, zIndex }: FixedLayerProps) {
  const bg = section.background!;
  const v = resolveValue(bg);

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top: 'var(--header-height, 0px)',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex,
    overflow: 'hidden',
  };

  if (bg.type === 'color') {
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{ ...baseStyle, backgroundColor: v }}
      />
    );
  }

  if (bg.type === 'gradient') {
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{ ...baseStyle, background: v }}
      >
        {bg.overlay && <OverlayDiv overlay={bg.overlay} />}
      </div>
    );
  }

  if (bg.type === 'image' && v) {
    if (movement === 'parallax') {
      // Parallax: image and overlay are siblings so transform only moves the image
      return (
        <div aria-hidden data-section-layer={section.id} style={baseStyle}>
          <div
            data-section-parallax-image={section.id}
            style={{
              position: 'absolute',
              inset: '-10% 0',  // 20% oversized (10% each side) → prevents black bars
              backgroundImage: `url(${v})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              willChange: 'transform',
            }}
          />
          {bg.overlay && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={
                bg.overlay.gradient
                  ? { background: bg.overlay.gradient }
                  : { backgroundColor: bg.overlay.color, opacity: bg.overlay.opacity }
              }
            />
          )}
        </div>
      );
    }

    if (movement === 'zoom') {
      // Ken Burns: slow scale animation on the image; overlay stays planted
      return (
        <div aria-hidden data-section-layer={section.id} style={{ ...baseStyle, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${v})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: 'aecms-zoom-in 12s ease-in-out infinite alternate',
              willChange: 'transform',
            }}
          />
          {bg.overlay && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={
                bg.overlay.gradient
                  ? { background: bg.overlay.gradient }
                  : { backgroundColor: bg.overlay.color, opacity: bg.overlay.opacity }
              }
            />
          )}
        </div>
      );
    }

    // All other image transitions: overlay is a child (composite unit, animates together)
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{
          ...baseStyle,
          backgroundImage: `url(${v})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          willChange: 'opacity, transform, clip-path',
        }}
      >
        {bg.overlay && <OverlayDiv overlay={bg.overlay} />}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main SectionsLayout
// ---------------------------------------------------------------------------
export function SectionsLayout({ content }: { content: SectionsPageContent }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  // Filter sections by visibility before any further processing
  const visibleSections = content.sections.filter((section) => {
    const v = section.visibility ?? 'public';
    if (v === 'draft') return false;
    if (v === 'logged_in' && !isLoggedIn) return false;
    return true;
  });

  // Resolve rendering axes for every section (once per render)
  const resolved = visibleSections.map((section) => ({
    section,
    mode:     resolveMode(section.background),
    movement: resolveMovement(section.background),
    exit:     resolveExit(section.background),
    inFixed:  needsFixedStack(section),
  }));

  const fixedEntries = resolved.filter((r) => r.inFixed);
  const fixedIds = new Set(fixedEntries.map((r) => r.section.id));
  const fixedCount = fixedEntries.length;

  // Inject page-scoped font import
  useEffect(() => {
    if (!content.fontImport) return;
    const id = 'sections-font-import';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = content.fontImport;
      document.head.appendChild(link);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, [content.fontImport]);

  // Scroll-driven animation for fixed background layers.
  // useLayoutEffect fires before the browser paints so the initial transform
  // is applied from frame one — eliminates the one-frame snap on page load.
  useLayoutEffect(() => {
    if (fixedCount === 0) return;

    // Build per-section metadata from DOM
    const entries = fixedEntries.map(({ section, movement, exit }) => ({
      id: section.id,
      movement,
      exit,
      getLayer: () => document.querySelector<HTMLElement>(`[data-section-layer="${section.id}"]`),
      getSpacer: () => document.querySelector<HTMLElement>(`[data-section-spacer="${section.id}"]`),
      getParallaxImage: () => document.querySelector<HTMLElement>(`[data-section-parallax-image="${section.id}"]`),
    }));

    function onScroll() {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;

      for (const entry of entries) {
        const layer = entry.getLayer();
        const spacer = entry.getSpacer();
        if (!layer || !spacer) continue;

        const spacerTop = spacer.offsetTop;
        const spacerHeight = spacer.offsetHeight || vh;

        // progress: 0 = section at/below viewport top, 1 = section fully scrolled off top
        const progress = Math.max(0, Math.min(1, (scrollY - spacerTop) / spacerHeight));

        // ── Movement axis (parallax drift on image child) ────────────────
        if (entry.movement === 'parallax') {
          const img = entry.getParallaxImage();
          if (img) {
            const spacerCenter = spacerTop + spacerHeight / 2;
            const vpCenter = scrollY + vh / 2;
            const range = vh / 2 + spacerHeight / 2;
            const t = Math.max(-1, Math.min(1, (vpCenter - spacerCenter) / range));
            img.style.transform = `translateY(${-t * 10}%)`;
          }
        }

        // ── Exit axis (what happens at the section boundary) ─────────────
        switch (entry.exit) {
          case 'none':
            // Snap cut: layer visible until fully scrolled off, then hidden
            layer.style.opacity = progress >= 1 ? '0' : '1';
            layer.style.transform = '';
            layer.style.clipPath = '';
            break;

          case 'fade':
            layer.style.opacity = String(1 - progress);
            layer.style.transform = '';
            layer.style.clipPath = '';
            break;

          case 'wipe-v':
            layer.style.opacity = '1';
            layer.style.clipPath = `inset(${progress * 100}% 0 0 0)`;
            layer.style.transform = '';
            break;

          case 'wipe-left':
            layer.style.opacity = '1';
            layer.style.clipPath = `inset(0 ${progress * 100}% 0 0)`;
            layer.style.transform = '';
            break;

          case 'wipe-right':
            layer.style.opacity = '1';
            layer.style.clipPath = `inset(0 0 0 ${progress * 100}%)`;
            layer.style.transform = '';
            break;

          case 'slide-up':
            layer.style.opacity = '1';
            layer.style.transform = `translateY(-${progress * 100}%)`;
            layer.style.clipPath = '';
            break;
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial paint
    return () => window.removeEventListener('scroll', onScroll);
  }, [fixedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontVarStyle: React.CSSProperties = content.fontVariables
    ? ({
        '--font-heading': content.fontVariables.heading,
        '--font-body': content.fontVariables.body,
      } as React.CSSProperties)
    : {};

  // Content sections and inline sections must sit above the fixed stack
  const contentZ = fixedCount + 1;

  return (
    <div ref={rootRef} className="w-full" style={fontVarStyle}>
      {/* Pass 1 — fixed background stack (earlier section = higher z-index) */}
      {fixedEntries.map(({ section, movement, exit }, stackIndex) => (
        <FixedBackgroundLayer
          key={section.id}
          section={section}
          movement={movement}
          exit={exit}
          zIndex={fixedCount - 1 - stackIndex}
        />
      ))}

      {/* Pass 2 — content in normal flow */}
      {resolved.map(({ section, inFixed }) => {
        const paddingClass = PADDING_CLASSES[section.padding ?? 'normal'];
        const heightStyle = section.minHeight ? { minHeight: section.minHeight } : {};
        const borderClass = BORDER_CLASSES[section.border ?? 'none'];

        if (inFixed) {
          // Transparent scroll spacer — lets fixed layers show through
          return (
            <div
              key={section.id}
              data-section-spacer={section.id}
              className={`relative ${paddingClass} ${borderClass}`}
              style={{ ...heightStyle, background: 'transparent', zIndex: contentZ }}
            >
              <ZoneGrid section={section} />
            </div>
          );
        }

        const bg = section.background;

        // Fit-width: render image as a real <img> element so its natural height
        // defines the geometry, then place the overlay as absolute inset-0 inside
        // that same wrapper. Zone content flows below. CSS gradients have no
        // intrinsic height, so a stacked background-image approach cannot constrain
        // the overlay to the image area — a DOM structure change is required.
        if (bg?.type === 'image' && bg.imageSize === 'fit-width') {
          const v = resolveValue(bg);
          return (
            <div
              key={section.id}
              className={`relative ${borderClass}`}
              style={{ ...heightStyle, zIndex: contentZ }}
            >
              {v && (
                <div className="relative w-full">
                  <img src={v} alt="" aria-hidden className="w-full h-auto block" />
                  {bg.overlay && <OverlayDiv overlay={bg.overlay} />}
                </div>
              )}
              {/* Padding wraps only the zone content, not the image */}
              <div className={paddingClass}>
                <ZoneGrid section={section} />
              </div>
            </div>
          );
        }

        // Standard inline section — background applied as CSS on the section div
        const inlineStyle = bg && bg.type !== 'none' ? buildInlineStyle(bg) : {};
        const hasOverlay = bg?.overlay != null && bg.type !== 'none';

        return (
          <div
            key={section.id}
            className={`relative ${paddingClass} ${borderClass}`}
            style={{ ...heightStyle, ...inlineStyle, position: 'relative', zIndex: contentZ }}
          >
            {hasOverlay && bg?.overlay && <OverlayDiv overlay={bg.overlay} />}
            <ZoneGrid section={section} />
          </div>
        );
      })}
    </div>
  );
}
