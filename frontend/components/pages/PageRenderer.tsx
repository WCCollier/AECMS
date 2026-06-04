'use client';

import { parsePageContent } from '@/lib/pageContent';
import { NoSidebarLayout } from './layouts/NoSidebarLayout';
import { SidebarLeftLayout } from './layouts/SidebarLeftLayout';
import { SidebarRightLayout } from './layouts/SidebarRightLayout';
import { SplitComparisonLayout } from './layouts/SplitComparisonLayout';
import type { Page } from '@/types';

interface PageRendererProps {
  page: Page;
}

export function PageRenderer({ page }: PageRendererProps) {
  const content = parsePageContent(page.content);

  switch (content.layout) {
    case 'sidebar_left':     return <SidebarLeftLayout zones={content.zones} />;
    case 'sidebar_right':    return <SidebarRightLayout zones={content.zones} />;
    case 'split_comparison': return <SplitComparisonLayout zones={content.zones} />;
    default:                 return <NoSidebarLayout zones={content.zones} />;
  }
}
