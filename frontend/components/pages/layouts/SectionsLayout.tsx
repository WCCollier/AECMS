'use client';

import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { SectionsPageContent, SectionBackground } from '@/types';

function buildBackgroundStyle(bg: SectionBackground | undefined): React.CSSProperties {
  if (!bg || bg.type === 'none') return {};
  if (bg.type === 'color') return { backgroundColor: bg.value };
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

export function SectionsLayout({ content }: { content: SectionsPageContent }) {
  return (
    <div className="w-full">
      {content.sections.map((section) => (
        <div
          key={section.id}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${section.columns}, 1fr)`,
            ...(section.minHeight ? { minHeight: section.minHeight } : {}),
            ...buildBackgroundStyle(section.background),
          }}
        >
          {section.zones.map((zone) => (
            <div
              key={zone.id}
              style={{ gridColumn: `span ${zone.span}` }}
              className="px-[5%] py-8 min-w-0"
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
      ))}
    </div>
  );
}
