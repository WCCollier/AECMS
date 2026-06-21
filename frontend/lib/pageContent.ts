import type { PageContent, PageLayout, PageSection, PageZone, SectionsPageContent, AnyPageContent } from '@/types';

export type { PageContent, PageLayout, SectionsPageContent, AnyPageContent };

// ── Legacy layout utilities ────────────────────────────────────────────────────

export function getZonesForLayout(layout: PageLayout): (keyof PageContent['zones'])[] {
  switch (layout) {
    case 'no_sidebar':       return ['main'];
    case 'sidebar_left':     return ['sidebar', 'main'];
    case 'sidebar_right':    return ['main', 'sidebar'];
    case 'split_comparison': return ['left', 'right'];
  }
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

// ── Section content detection ──────────────────────────────────────────────────

export function isSectionsContent(obj: unknown): obj is SectionsPageContent {
  return (
    Boolean(obj) &&
    typeof obj === 'object' &&
    (obj as Record<string, unknown>)['type'] === 'sections' &&
    Array.isArray((obj as Record<string, unknown>)['sections'])
  );
}

// ── Unified parsing ────────────────────────────────────────────────────────────

export function parseAnyPageContent(content: string | object | null | undefined): AnyPageContent {
  if (!content) return { layout: 'no_sidebar', zones: {} };
  try {
    const obj = typeof content === 'string' ? JSON.parse(content) : content;
    if (isSectionsContent(obj)) return obj;
    if (obj && typeof obj === 'object' && 'layout' in obj && 'zones' in obj) {
      return obj as PageContent;
    }
  } catch { /* ignore */ }
  return { layout: 'no_sidebar', zones: {} };
}

/** Legacy-only parse — returns PageContent; falls back to no_sidebar for sections content. */
export function parsePageContent(content: string | object | null | undefined): PageContent {
  const result = parseAnyPageContent(content);
  if (isSectionsContent(result)) return { layout: 'no_sidebar', zones: {} };
  return result;
}

export function isPageContent(s: string): boolean {
  try {
    const obj = JSON.parse(s);
    return Boolean(obj && typeof obj === 'object' && 'layout' in obj && 'zones' in obj);
  } catch { return false; }
}

// ── Legacy → sections upgrade ─────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

/** Losslessly converts a legacy PageContent to a single-section SectionsPageContent. */
export function legacyToSections(content: PageContent): SectionsPageContent {
  let columns: number;
  let zoneSpecs: { span: number; content: object }[];

  switch (content.layout) {
    case 'sidebar_left':
      columns = 4;
      zoneSpecs = [
        { span: 1, content: (content.zones.sidebar ?? {}) as object },
        { span: 3, content: (content.zones.main ?? {}) as object },
      ];
      break;
    case 'sidebar_right':
      columns = 4;
      zoneSpecs = [
        { span: 3, content: (content.zones.main ?? {}) as object },
        { span: 1, content: (content.zones.sidebar ?? {}) as object },
      ];
      break;
    case 'split_comparison':
      columns = 2;
      zoneSpecs = [
        { span: 1, content: (content.zones.left ?? {}) as object },
        { span: 1, content: (content.zones.right ?? {}) as object },
      ];
      break;
    default:
      columns = 1;
      zoneSpecs = [{ span: 1, content: (content.zones.main ?? {}) as object }];
  }

  const section: PageSection = {
    id: uid(),
    columns,
    zones: zoneSpecs.map((z): PageZone => ({ id: uid(), span: z.span, content: z.content })),
  };

  return { type: 'sections', sections: [section] };
}

// ── Default sections content (for new pages) ──────────────────────────────────

export function defaultSectionsContent(): SectionsPageContent {
  return {
    type: 'sections',
    sections: [
      {
        id: uid(),
        columns: 1,
        zones: [{ id: uid(), span: 1, content: {} }],
      },
    ],
  };
}
