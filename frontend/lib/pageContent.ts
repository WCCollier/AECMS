import type { PageContent, PageLayout } from '@/types';

export type { PageContent, PageLayout };

export function getZonesForLayout(layout: PageLayout): (keyof PageContent['zones'])[] {
  switch (layout) {
    case 'no_sidebar':       return ['main'];
    case 'sidebar_left':     return ['sidebar', 'main'];
    case 'sidebar_right':    return ['main', 'sidebar'];
    case 'split_comparison': return ['left', 'right'];
  }
}

export function parsePageContent(content: string | object | null | undefined): PageContent {
  if (!content) return { layout: 'no_sidebar', zones: {} };
  try {
    const obj = typeof content === 'string' ? JSON.parse(content) : content;
    if (obj && typeof obj === 'object' && 'layout' in obj && 'zones' in obj) {
      return obj as PageContent;
    }
  } catch { /* ignore */ }
  return { layout: 'no_sidebar', zones: {} };
}

export function isPageContent(s: string): boolean {
  try {
    const obj = JSON.parse(s);
    return Boolean(obj && typeof obj === 'object' && 'layout' in obj && 'zones' in obj);
  } catch { return false; }
}

export function layoutContainerClass(layout: PageLayout): string {
  switch (layout) {
    case 'no_sidebar':       return 'max-w-3xl mx-auto px-4 py-8';
    case 'sidebar_left':     return 'max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[280px_1fr] gap-8';
    case 'sidebar_right':    return 'max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_280px] gap-8';
    case 'split_comparison': return 'grid lg:grid-cols-2 gap-0 min-h-screen';
  }
}

export const LAYOUT_LABELS: Record<PageLayout, string> = {
  no_sidebar:       'Full Width',
  sidebar_left:     'Sidebar Left',
  sidebar_right:    'Sidebar Right',
  split_comparison: 'Split Comparison',
};
