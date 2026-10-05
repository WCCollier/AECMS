/**
 * Public URL paths for content. Every link to a product, article or page must be built here,
 * never by hand-writing "/shop/..." or "/articles/...". The segments themselves are defined
 * in routes.config.mjs.
 */
import { ROUTE_SEGMENTS, LEGACY_ROUTE_SEGMENTS } from './routes.config.mjs';

export const PRODUCTS_PATH = `/${ROUTE_SEGMENTS.product}`;
export const ARTICLES_PATH = `/${ROUTE_SEGMENTS.article}`;

export const productPath = (slug: string): string => `${PRODUCTS_PATH}/${slug}`;
export const articlePath = (slug: string): string => `${ARTICLES_PATH}/${slug}`;

interface PageLike {
  slug: string;
  parent_id?: string | null;
}

/**
 * Path of a CMS page: its slug preceded by its ancestors' slugs (`/parent/child`).
 * `pagesById` must contain the page's ancestors; if an ancestor is missing the path is
 * built from what is known.
 */
export function pagePath(
  page: PageLike,
  pagesById: ReadonlyMap<string, PageLike & { id?: string }> | Record<string, PageLike>,
): string {
  const lookup = (id: string): PageLike | undefined =>
    pagesById instanceof Map ? pagesById.get(id) : (pagesById as Record<string, PageLike>)[id];

  const slugs = [page.slug];
  const seen = new Set<string>();
  let parentId = page.parent_id ?? null;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = lookup(parentId);
    if (!parent) break;
    slugs.unshift(parent.slug);
    parentId = parent.parent_id ?? null;
  }
  return '/' + slugs.join('/');
}

export type LinkKind = 'product' | 'article' | 'page' | 'anchor' | 'external';

const startsWithSegment = (href: string, segments: readonly string[]) =>
  segments.some((s) => href === `/${s}` || href.startsWith(`/${s}/`) || href.startsWith(`/${s}?`));

/**
 * Classify a link target by what it points at, accepting current and legacy segments
 * (so old saved links still open on the right tab in the editor's link dialog).
 */
export function linkKind(href: string | undefined | null): LinkKind {
  if (!href) return 'page';
  if (href.startsWith('#')) return 'anchor';
  if (!href.startsWith('/')) return 'external';
  if (startsWithSegment(href, [ROUTE_SEGMENTS.product, ...LEGACY_ROUTE_SEGMENTS.product])) return 'product';
  if (startsWithSegment(href, [ROUTE_SEGMENTS.article, ...LEGACY_ROUTE_SEGMENTS.article])) return 'article';
  return 'page';
}
