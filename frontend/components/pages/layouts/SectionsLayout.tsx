'use client';

import { useEffect, useRef } from 'react';
import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { SectionsPageContent, SectionBackground, SectionPadding, PageSection, ZoneScheme } from '@/types';

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

// ---------------------------------------------------------------------------
// Read-time fallback: migrate deprecated `attachment` → `transition`
// ---------------------------------------------------------------------------
function resolveTransition(bg: SectionBackground | undefined): NonNullable<SectionBackground['transition']> {
  if (!bg) return 'none';
  if (bg.transition) return bg.transition;
  if (bg.attachment === 'parallax') return 'parallax';
  if (bg.attachment === 'fixed') return 'fixed';
  return 'none';
}

function needsFixedStack(section: PageSection): boolean {
  const t = resolveTransition(section.background);
  return t !== 'none' && !!section.background && section.background.type !== 'none';
}

// ---------------------------------------------------------------------------
// Inline background style (for transition:'none' sections)
// ---------------------------------------------------------------------------
function buildInlineStyle(bg: SectionBackground): React.CSSProperties {
  if (bg.type === 'none') return {};
  if (bg.type === 'color') return { backgroundColor: bg.value };
  if (bg.type === 'gradient') return { background: bg.value };
  if (bg.type === 'image' && bg.value) {
    return {
      backgroundImage: `url(${bg.value})`,
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
      {section.zones.map((zone) => (
        <div
          key={zone.id}
          style={{ gridColumn: `span ${zone.span}` }}
          className={`px-[5%] min-w-0 ${ZONE_SCHEME_CLASSES[zone.scheme ?? 'inherit']}`}
        >
          <WidgetSizeProvider size="large">
            <RichTextContent
              content={zone.content ? JSON.stringify(zone.content) : ''}
              className="prose-article prose-page"
            />
          </WidgetSizeProvider>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FixedBackgroundLayer — one entry in the fixed-position background stack
// ---------------------------------------------------------------------------
interface FixedLayerProps {
  section: PageSection;
  transition: NonNullable<SectionBackground['transition']>;
  zIndex: number;
}

function FixedBackgroundLayer({ section, transition, zIndex }: FixedLayerProps) {
  const bg = section.background!;

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex,
    overflow: 'hidden',
  };

  if (bg.type === 'color') {
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{ ...baseStyle, backgroundColor: bg.value }}
      />
    );
  }

  if (bg.type === 'gradient') {
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{ ...baseStyle, background: bg.value }}
      >
        {bg.overlay && <OverlayDiv overlay={bg.overlay} />}
      </div>
    );
  }

  if (bg.type === 'image' && bg.value) {
    if (transition === 'parallax') {
      // Parallax: image and overlay are siblings so transform only moves the image
      return (
        <div aria-hidden data-section-layer={section.id} style={baseStyle}>
          <div
            data-section-parallax-image={section.id}
            style={{
              position: 'absolute',
              inset: '-10% 0',  // 20% oversized (10% each side) → prevents black bars
              backgroundImage: `url(${bg.value})`,
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

    // All other image transitions: overlay is a child (composite unit, animates together)
    return (
      <div
        aria-hidden
        data-section-layer={section.id}
        style={{
          ...baseStyle,
          backgroundImage: `url(${bg.value})`,
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

  // Resolve transition for every section (once per render)
  const resolved = content.sections.map((section) => ({
    section,
    transition: resolveTransition(section.background),
    inFixed: needsFixedStack(section),
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

  // Scroll-driven animation for fixed background layers
  useEffect(() => {
    if (fixedCount === 0) return;

    // Build per-section metadata from DOM
    const entries = fixedEntries.map(({ section, transition }) => ({
      id: section.id,
      transition,
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

        switch (entry.transition) {
          case 'fixed':
            // Window-pane: snap to hidden after fully scrolled
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

          case 'parallax': {
            // Layer itself fades out when spacer fully exits (clean handoff)
            layer.style.opacity = progress >= 1 ? '0' : '1';
            layer.style.clipPath = '';
            layer.style.transform = '';

            // Parallax drift on image only
            const img = entry.getParallaxImage();
            if (img) {
              const spacerCenter = spacerTop + spacerHeight / 2;
              const vpCenter = scrollY + vh / 2;
              const range = vh / 2 + spacerHeight / 2;
              const t = Math.max(-1, Math.min(1, (vpCenter - spacerCenter) / range));
              img.style.transform = `translateY(${t * 10}%)`;
            }
            break;
          }
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
      {fixedEntries.map(({ section, transition }, stackIndex) => (
        <FixedBackgroundLayer
          key={section.id}
          section={section}
          transition={transition}
          zIndex={fixedCount - 1 - stackIndex}
        />
      ))}

      {/* Pass 2 — content in normal flow */}
      {resolved.map(({ section, inFixed }) => {
        const paddingClass = PADDING_CLASSES[section.padding ?? 'normal'];
        const heightStyle = section.minHeight ? { minHeight: section.minHeight } : {};

        if (inFixed) {
          // Transparent scroll spacer — lets fixed layers show through
          return (
            <div
              key={section.id}
              data-section-spacer={section.id}
              className={`relative ${paddingClass}`}
              style={{ ...heightStyle, background: 'transparent', zIndex: contentZ }}
            >
              <ZoneGrid section={section} />
            </div>
          );
        }

        // Inline section — normal rendering with background on the section div
        const bg = section.background;
        const inlineStyle = bg && bg.type !== 'none' ? buildInlineStyle(bg) : {};
        const hasOverlay = bg?.overlay != null;

        return (
          <div
            key={section.id}
            className={`relative ${paddingClass}`}
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
