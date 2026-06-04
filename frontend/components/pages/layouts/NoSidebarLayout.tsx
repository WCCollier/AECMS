'use client';

import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { PageContent } from '@/types';

export function NoSidebarLayout({ zones }: { zones: PageContent['zones'] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <WidgetSizeProvider size="large">
        <RichTextContent
          content={zones.main ? JSON.stringify(zones.main) : ''}
          className="prose-article"
        />
      </WidgetSizeProvider>
    </div>
  );
}
