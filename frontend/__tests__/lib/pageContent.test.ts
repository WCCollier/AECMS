import { parsePageContent, getZonesForLayout, isPageContent, LAYOUT_LABELS } from '@/lib/pageContent';
import type { PageLayout } from '@/types';

describe('parsePageContent', () => {
  it('parses a valid PageContent JSON string', () => {
    const content = JSON.stringify({ layout: 'no_sidebar', zones: { main: { type: 'doc', content: [] } } });
    const result = parsePageContent(content);
    expect(result.layout).toBe('no_sidebar');
    expect(result.zones.main).toBeDefined();
  });

  it('returns default for null/undefined', () => {
    expect(parsePageContent(null)).toEqual({ layout: 'no_sidebar', zones: {} });
    expect(parsePageContent(undefined)).toEqual({ layout: 'no_sidebar', zones: {} });
  });

  it('returns default for invalid JSON string', () => {
    expect(parsePageContent('not json')).toEqual({ layout: 'no_sidebar', zones: {} });
  });

  it('returns default for JSON that is not a PageContent envelope', () => {
    expect(parsePageContent(JSON.stringify({ foo: 'bar' }))).toEqual({ layout: 'no_sidebar', zones: {} });
  });

  it('handles a plain object input (not a string)', () => {
    const obj = { layout: 'sidebar_right', zones: {} };
    const result = parsePageContent(obj);
    expect(result.layout).toBe('sidebar_right');
  });
});

describe('getZonesForLayout', () => {
  const cases: [PageLayout, string[]][] = [
    ['no_sidebar',       ['main']],
    ['sidebar_left',     ['sidebar', 'main']],
    ['sidebar_right',    ['main', 'sidebar']],
    ['split_comparison', ['left', 'right']],
  ];

  it.each(cases)('layout %s → zones %j', (layout, expected) => {
    expect(getZonesForLayout(layout)).toEqual(expected);
  });
});

describe('isPageContent', () => {
  it('returns true for a valid PageContent string', () => {
    expect(isPageContent(JSON.stringify({ layout: 'no_sidebar', zones: {} }))).toBe(true);
  });

  it('returns false for an invalid JSON string', () => {
    expect(isPageContent('not json')).toBe(false);
  });

  it('returns false for JSON without layout/zones', () => {
    expect(isPageContent(JSON.stringify({ foo: 'bar' }))).toBe(false);
  });
});

describe('LAYOUT_LABELS', () => {
  it('has a label for every layout variant', () => {
    const layouts: PageLayout[] = ['no_sidebar', 'sidebar_left', 'sidebar_right', 'split_comparison'];
    layouts.forEach((l) => expect(LAYOUT_LABELS[l]).toBeTruthy());
  });
});
