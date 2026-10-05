/**
 * Public URL paths for content, as seen by visitors (emails, feeds, links the backend
 * generates). Mirrors frontend/lib/routes.config.mjs, which is the source of truth for the
 * website's routes; public-routes.spec.ts fails if the two disagree.
 *
 * Never hand-write "/shop/..." or "/articles/..." in backend code — use these helpers.
 */
export const ROUTE_SEGMENTS = {
  product: 'shop',
  article: 'articles',
} as const;

/** Former or commonly mistyped segments; the website redirects them to the current ones. */
export const LEGACY_ROUTE_SEGMENTS = {
  product: ['products', 'product'],
  article: ['latest'],
} as const;

const base = (appUrl: string) => appUrl.replace(/\/+$/, '');

export const publicProductUrl = (appUrl: string, slug: string): string =>
  `${base(appUrl)}/${ROUTE_SEGMENTS.product}/${slug}`;

export const publicArticleUrl = (appUrl: string, slug: string): string =>
  `${base(appUrl)}/${ROUTE_SEGMENTS.article}/${slug}`;

/** Top-level paths owned by the application, which a CMS page may not use as its slug. */
export const RESERVED_ROUTE_SLUGS: string[] = [
  ROUTE_SEGMENTS.product,
  ROUTE_SEGMENTS.article,
  ...LEGACY_ROUTE_SEGMENTS.product,
  ...LEGACY_ROUTE_SEGMENTS.article,
];
