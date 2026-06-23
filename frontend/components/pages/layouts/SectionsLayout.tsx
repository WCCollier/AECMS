'use client';

import { useEffect } from 'react';
import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { SectionsPageContent, SectionBackground, SectionPadding, ZoneScheme } from '@/types';

const PADDING_CLASSES: Record<SectionPadding, string> = {
  none:      'py-0',
  compact:   'py-8',
  normal:    'py-16',
  spacious:  'py-24',
};

function buildBackgroundStyle(bg: SectionBackground | undefined): React.CSSProperties {
  if (!bg || bg.type === 'none') return {};
  if (bg.type === 'color') return { backgroundColor: bg.value };
  if (bg.type === 'gradient') return { background: bg.value };
  if (bg.type === 'image' && bg.value) {
    const attachment =
      bg.attachment === 'fixed' || bg.attachment === 'parallax' ? 'fixed' : 'scroll';
    return {
      backgroundImage: `url(${bg.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: attachment,
    };
  }
  return {};
}

const ZONE_SCHEME_CLASSES: Record<ZoneScheme, string> = {
  inherit: '',
  light:   'zone-scheme-light',
  dark:    'zone-scheme-dark',
};

export function SectionsLayout({ content }: { content: SectionsPageContent }) {
  // Inject page-scoped font import and CSS variable overrides
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
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [content.fontImport]);

  const fontVarStyle: React.CSSProperties = content.fontVariables
    ? ({
        '--font-heading': content.fontVariables.heading,
        '--font-body': content.fontVariables.body,
      } as React.CSSProperties)
    : {};

  return (
    <div className="w-full" style={fontVarStyle}>
      {content.sections.map((section) => {
        const paddingClass = PADDING_CLASSES[section.padding ?? 'normal'];
        const bgStyle = buildBackgroundStyle(section.background);
        const hasOverlay = section.background?.overlay != null;

        return (
          <div
            key={section.id}
            className={`relative ${paddingClass}`}
            style={{
              ...(section.minHeight ? { minHeight: section.minHeight } : {}),
              ...bgStyle,
            }}
          >
            {/* Background overlay (scrim) — sits between bg and content */}
            {hasOverlay && (
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: section.background!.overlay!.color,
                  opacity: section.background!.overlay!.opacity,
                }}
              />
            )}

            {/* Zone grid — positioned above overlay via relative/z-10 */}
            <div
              className="relative"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${section.columns}, 1fr)`,
                gap: '0',
              }}
            >
              {section.zones.map((zone) => {
                const schemeClass = ZONE_SCHEME_CLASSES[zone.scheme ?? 'inherit'];
                return (
                  <div
                    key={zone.id}
                    style={{ gridColumn: `span ${zone.span}` }}
                    className={`px-[5%] min-w-0 ${schemeClass}`}
                  >
                    <WidgetSizeProvider size="large">
                      <RichTextContent
                        content={zone.content ? JSON.stringify(zone.content) : ''}
                        className="prose-article prose-page"
                      />
                    </WidgetSizeProvider>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
