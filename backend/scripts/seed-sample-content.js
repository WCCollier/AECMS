'use strict';
/**
 * seed-sample-content.js
 *
 * Creates 2 tutorial pages for a fresh install. Called by docker-start.sh
 * on first boot (capabilities count = 0) and by seed-all.sh for local dev.
 *
 * Pages have no author_id so they are created unconditionally — no owner
 * account is required. The tutorial article and product (which DO need an
 * owner ID) are created by setup.service.ts after the wizard completes.
 *
 * Artifacts:
 *   _home_      — published page (homepage placeholder)
 *   about-pages — draft page    (explains the page system)
 *
 * All creation calls are slug-guarded (skip if already exists).
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── TipTap JSON helpers ──────────────────────────────────────────────────────

// For Pages — zone-based layout wrapping a TipTap doc object.
// Pages must use this format; raw TipTap JSON (type:'doc') maps to empty zones.
function pageDoc(...children) {
  return JSON.stringify({
    layout: 'no_sidebar',
    zones: { main: { type: 'doc', content: children } },
  });
}

function h1(text) {
  return { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] };
}

function h2(text) {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] };
}

// Empty string runs are filtered out; p() with no non-empty runs emits a bare
// { type:'paragraph' } — the correct TipTap representation of a spacer line.
function p(...runs) {
  const content = runs
    .map((r) => (typeof r === 'string' ? { type: 'text', text: r } : { type: 'text', ...r }))
    .filter((n) => n.text !== '');
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function bold(text) {
  return { text, marks: [{ type: 'bold' }] };
}

function ul(...items) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  };
}

function ol(...items) {
  return {
    type: 'orderedList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  };
}

// ── Content definitions ──────────────────────────────────────────────────────

const HOME_CONTENT = pageDoc(
  h1('Welcome'),
  p('This is your homepage. Edit it from Admin → Pages → _home_ whenever you are ready to build your real homepage.'),
  { type: 'paragraph' },
  h2('Latest Writing'),
  p('Essays, commentary, and analysis — browse the full archive to find what interests you.'),
  { type: 'paragraph' },
  h2('The Shop'),
  p('Books, courses, and digital products available in the shop.'),
);

const ABOUT_PAGES_CONTENT = pageDoc(
  h1('About Pages'),
  p('Pages are the structural backbone of your site. Unlike Articles (which are chronological and discovery-oriented), Pages are evergreen and accessed by URL.'),
  h2('What a Page contains'),
  ul(
    'Title and slug (the URL path segment)',
    'Rich content body — the same TipTap editor as Articles, with support for headings, lists, images, embeds, and inline widgets',
    'Layout template (full-width, sidebar, etc.)',
    'Parent/child relationship for URL hierarchy',
    'Status: draft or published',
    'SEO fields (meta title, meta description)',
    'Navigation options (show in nav, nav order)',
  ),
  h2('Page hierarchy and URLs'),
  p('Pages can be nested. A child page with slug "contact" under a parent with slug "about" is served at /about/contact. The catch-all router resolves any depth automatically.'),
  h2('Navigation'),
  p('Pages with "Show in Nav" enabled appear in the site header. Use "Nav Order" to control their position. Nested pages become sub-menu items under their parent.'),
  h2('The homepage waterfall'),
  p('When Homepage Mode is set to "Static Page" in Admin → Settings → General, the site resolves the root URL (/) in this order:'),
  ol(
    'The page you explicitly designated as homepage in General Settings — served at / and also at its own slug URL.',
    'If that page is unpublished, deleted, or not set: the page with the reserved slug _home_ (this page). Publish _home_ and it silently catches the gap.',
    'If _home_ is also missing or unpublished: the site redirects / to /articles so visitors always see something.',
  ),
  p(bold('Tip:'), ' Keep _home_ published as a safety net, even if a different page is your real homepage. The _home_ page cannot be deleted via the API — only its content can be changed.'),
);

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed-sample-content] Starting...');

  const existingHome = await prisma.page.findFirst({ where: { slug: '_home_', parent_id: null } });
  if (existingHome) {
    console.log('[seed-sample-content] _home_ page already exists — skipping.');
  } else {
    await prisma.page.create({
      data: {
        title: 'Home',
        slug: '_home_',
        content: HOME_CONTENT,
        status: 'published',
        visibility: 'public',
        template: 'full-width',
        show_in_nav: false,
        nav_order: 0,
        author_can_delete: false,
        admin_can_delete: false,
      },
    });
    console.log('[seed-sample-content] ✓ Created _home_ page (published)');
  }

  const existingAboutPages = await prisma.page.findFirst({ where: { slug: 'about-pages', parent_id: null } });
  if (existingAboutPages) {
    console.log('[seed-sample-content] about-pages page already exists — skipping.');
  } else {
    await prisma.page.create({
      data: {
        title: 'About Pages',
        slug: 'about-pages',
        content: ABOUT_PAGES_CONTENT,
        status: 'draft',
        visibility: 'public',
        template: 'full-width',
        show_in_nav: false,
        nav_order: 0,
      },
    });
    console.log('[seed-sample-content] ✓ Created about-pages page (draft)');
  }

  console.log('[seed-sample-content] Done.');
}

main()
  .catch((e) => { console.error('[seed-sample-content] ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
