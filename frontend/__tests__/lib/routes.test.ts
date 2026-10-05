import fs from 'fs';
import path from 'path';
import {
  PRODUCTS_PATH,
  ARTICLES_PATH,
  productPath,
  articlePath,
  pagePath,
  linkKind,
} from '@/lib/routes';
import { ROUTE_SEGMENTS, LEGACY_ROUTE_SEGMENTS } from '@/lib/routes.config.mjs';

describe('route helpers', () => {
  it('builds product and article paths from the configured segments', () => {
    expect(PRODUCTS_PATH).toBe(`/${ROUTE_SEGMENTS.product}`);
    expect(ARTICLES_PATH).toBe(`/${ROUTE_SEGMENTS.article}`);
    expect(productPath('my-book')).toBe('/shop/my-book');
    expect(articlePath('a-post')).toBe('/articles/a-post');
  });

  it('builds hierarchical page paths from ancestors', () => {
    const pages = new Map<string, any>([
      ['a', { slug: 'about', parent_id: null }],
      ['b', { slug: 'team', parent_id: 'a' }],
    ]);
    expect(pagePath({ slug: 'about', parent_id: null }, pages)).toBe('/about');
    expect(pagePath({ slug: 'jane', parent_id: 'b' }, pages)).toBe('/about/team/jane');
  });

  it('builds the path from what is known when an ancestor is missing, and survives cycles', () => {
    expect(pagePath({ slug: 'orphan', parent_id: 'gone' }, new Map())).toBe('/orphan');
    const cyc = new Map<string, any>([['x', { slug: 'x', parent_id: 'y' }], ['y', { slug: 'y', parent_id: 'x' }]]);
    expect(pagePath({ slug: 'leaf', parent_id: 'x' }, cyc)).toBe('/y/x/leaf');
  });

  it('classifies links, accepting current and legacy segments', () => {
    expect(linkKind('/shop/x')).toBe('product');
    expect(linkKind('/products/x')).toBe('product');
    expect(linkKind('/product/x')).toBe('product');
    expect(linkKind('/articles/x')).toBe('article');
    expect(linkKind('/latest/x')).toBe('article');
    expect(linkKind('/about/team')).toBe('page');
    expect(linkKind('#top')).toBe('anchor');
    expect(linkKind('https://example.com/shop/x')).toBe('external');
    expect(linkKind(undefined)).toBe('page');
    // a page whose slug merely starts with a segment name is still a page
    expect(linkKind('/shopping-tips')).toBe('page');
  });
});

describe('legacy segment redirects', () => {
  it('redirects every legacy segment to the current one, permanently', async () => {
    const mod = await import('@/next.config.mjs');
    const redirects: Array<{ source: string; destination: string; permanent: boolean }> =
      await mod.default.redirects();
    const find = (source: string) => redirects.find((r) => r.source === source);

    expect(find('/products/:path*')).toMatchObject({ destination: '/shop/:path*', permanent: true });
    expect(find('/product/:path*')).toMatchObject({ destination: '/shop/:path*', permanent: true });
    expect(find('/latest/:path*')).toMatchObject({ destination: '/articles/:path*', permanent: true });
    for (const [kind, legacy] of Object.entries(LEGACY_ROUTE_SEGMENTS)) {
      for (const from of legacy as string[]) {
        expect(find(`/${from}`)?.destination).toBe(`/${(ROUTE_SEGMENTS as any)[kind]}`);
      }
    }
  });
});

describe('no hand-written content links', () => {
  const root = path.resolve(__dirname, '../..');
  const skipDirs = new Set(['node_modules', '.next', '__tests__', 'e2e', 'coverage']);
  const skipFiles = [/lib\/routes\.(ts|config\.mjs)$/, /app\/\(site\)\/latest\//];

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) return skipDirs.has(e.name) ? [] : walk(path.join(dir, e.name));
      return /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [];
    });

  const files = ['app', 'components', 'lib', 'hooks']
    .flatMap((d) => walk(path.join(root, d)))
    .filter((f) => !skipFiles.some((re) => re.test(f.replace(/\\/g, '/'))));

  it('never hard-codes the product/article segments in links — use lib/routes', () => {
    const offenders: string[] = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const hardShop = /['"`]\/shop(['"`/?]|\$\{)/.test(line);
        const hardHref = /href[=:][^\n]*['"`]\/(products|articles|latest)\b/.test(line)
          && !/\/admin\//.test(line);
        if (hardShop || hardHref) offenders.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
