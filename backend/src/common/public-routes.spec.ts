import * as fs from 'fs';
import * as path from 'path';
import {
  ROUTE_SEGMENTS,
  LEGACY_ROUTE_SEGMENTS,
  publicProductUrl,
  publicArticleUrl,
  RESERVED_ROUTE_SLUGS,
} from './public-routes';

describe('public route helpers', () => {
  it('builds product and article URLs from the segments', () => {
    expect(publicProductUrl('https://example.com', 'my-book')).toBe('https://example.com/shop/my-book');
    expect(publicArticleUrl('https://example.com/', 'a-post')).toBe('https://example.com/articles/a-post');
  });

  it('reserves the current and legacy segments so pages cannot shadow them', () => {
    expect(RESERVED_ROUTE_SLUGS).toEqual(
      expect.arrayContaining(['shop', 'articles', 'products', 'product', 'latest']),
    );
  });
});

describe('backend routes match the frontend source of truth', () => {
  const configPath = path.resolve(__dirname, '../../../frontend/lib/routes.config.mjs');
  const available = fs.existsSync(configPath);
  const run = available ? it : it.skip;

  // Pull `key: 'value'` / `key: ['a','b']` pairs out of the named exported object literal.
  const parse = (src: string, exportName: string): Record<string, string | string[]> => {
    const body = new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\};`).exec(src)?.[1] ?? '';
    const out: Record<string, string | string[]> = {};
    for (const m of body.matchAll(/(\w+):\s*(\[[^\]]*\]|'[^']*')/g)) {
      const raw = m[2];
      out[m[1]] = raw.startsWith('[')
        ? [...raw.matchAll(/'([^']*)'/g)].map((x) => x[1])
        : raw.slice(1, -1);
    }
    return out;
  };

  run('ROUTE_SEGMENTS and LEGACY_ROUTE_SEGMENTS are identical', () => {
    const src = fs.readFileSync(configPath, 'utf8');
    expect(parse(src, 'ROUTE_SEGMENTS')).toEqual({ ...ROUTE_SEGMENTS });
    expect(parse(src, 'LEGACY_ROUTE_SEGMENTS')).toEqual(
      Object.fromEntries(Object.entries(LEGACY_ROUTE_SEGMENTS).map(([k, v]) => [k, [...v]])),
    );
  });
});
