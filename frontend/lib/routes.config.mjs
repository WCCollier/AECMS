/**
 * Canonical public URL segments for AECMS content — the ONE place to change them.
 *
 * Plain .mjs (no TypeScript) so that next.config.mjs, the app code (lib/routes.ts) and the
 * backend's consistency test can all read the same file.
 *
 * Content kinds: products and articles each live under a fixed segment; pages are served at
 * their hierarchical slug path from the site root (`/parent/child`), so they have no segment.
 *
 * To rename a segment (e.g. products from "shop" to "store"):
 *   1. change it here,
 *   2. rename the matching folder under app/(site)/ (Next.js routes are folder-based),
 *   3. move the old name into LEGACY_ROUTE_SEGMENTS so existing links keep working,
 *   4. mirror the change in backend/src/common/public-routes.ts
 *      (backend/src/common/public-routes.spec.ts fails if the two disagree).
 */
export const ROUTE_SEGMENTS = {
  product: 'shop',
  article: 'articles',
};

/**
 * Former or commonly mistyped segments. next.config.mjs permanently redirects each of these
 * to the current segment, which repairs links already saved in content, sent emails and
 * bookmarks. They are also reserved so a CMS page cannot be created that the redirect would shadow.
 */
export const LEGACY_ROUTE_SEGMENTS = {
  product: ['products', 'product'],
  article: ['latest'],
};
