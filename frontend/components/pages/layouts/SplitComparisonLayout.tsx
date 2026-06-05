'use client';

import { WidgetSizeProvider, type WidgetSize } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import type { PageContent } from '@/types';

export function SplitComparisonLayout({ zones }: { zones: PageContent['zones'] }) {
  const isDesktop = useIsDesktop();
  const size: WidgetSize = isDesktop ? 'large' : 'small';

  return (
    <div className="grid lg:grid-cols-2 min-h-screen px-[10%]">
      <div className="border-r border-border p-8">
        <WidgetSizeProvider size={size}>
          <RichTextContent
            content={zones.left ? JSON.stringify(zones.left) : ''}
            className="prose-article prose-page"
          />
        </WidgetSizeProvider>
      </div>
      <div className="p-8">
        <WidgetSizeProvider size={size}>
          <RichTextContent
            content={zones.right ? JSON.stringify(zones.right) : ''}
            className="prose-article prose-page"
          />
        </WidgetSizeProvider>
      </div>
    </div>
  );
}
