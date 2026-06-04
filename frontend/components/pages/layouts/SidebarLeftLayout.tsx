'use client';

import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { PageContent } from '@/types';

export function SidebarLeftLayout({ zones }: { zones: PageContent['zones'] }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[280px_1fr] gap-8">
      <aside>
        <WidgetSizeProvider size="small">
          <RichTextContent
            content={zones.sidebar ? JSON.stringify(zones.sidebar) : ''}
            className="prose prose-sm max-w-none"
          />
        </WidgetSizeProvider>
      </aside>
      <main>
        <WidgetSizeProvider size="large">
          <RichTextContent
            content={zones.main ? JSON.stringify(zones.main) : ''}
            className="prose-article"
          />
        </WidgetSizeProvider>
      </main>
    </div>
  );
}
