'use client';

import { parseAnyPageContent, isSectionsContent } from '@/lib/pageContent';
import { NoSidebarLayout } from './layouts/NoSidebarLayout';
import { SidebarLeftLayout } from './layouts/SidebarLeftLayout';
import { SidebarRightLayout } from './layouts/SidebarRightLayout';
import { SplitComparisonLayout } from './layouts/SplitComparisonLayout';
import { SectionsLayout } from './layouts/SectionsLayout';
import type { Page, PageContent } from '@/types';

interface PageRendererProps {
  page: Page;
}

export function PageRenderer({ page }: PageRendererProps) {
  const content = parseAnyPageContent(page.content);

  if (isSectionsContent(content)) {
    return <SectionsLayout content={content} />;
  }

  const legacy = content as PageContent;
  switch (legacy.layout) {
    case 'sidebar_left':     return <SidebarLeftLayout zones={legacy.zones} />;
    case 'sidebar_right':    return <SidebarRightLayout zones={legacy.zones} />;
    case 'split_comparison': return <SplitComparisonLayout zones={legacy.zones} />;
    default:                 return <NoSidebarLayout zones={legacy.zones} />;
  }
}
