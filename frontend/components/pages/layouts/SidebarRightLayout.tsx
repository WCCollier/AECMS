'use client';

import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { PageContent } from '@/types';

export function SidebarRightLayout({ zones }: { zones: PageContent['zones'] }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_280px] gap-8">
      <main>
        <WidgetSizeProvider size="large">
          <RichTextContent
            content={zones.main ? JSON.stringify(zones.main) : ''}
            className="prose-article"
          />
        </WidgetSizeProvider>
      </main>
      <aside>
        <WidgetSizeProvider size="small">
          <RichTextContent
            content={zones.sidebar ? JSON.stringify(zones.sidebar) : ''}
            className="prose prose-sm max-w-none"
          />
        </WidgetSizeProvider>
      </aside>
    </div>
  );
}
