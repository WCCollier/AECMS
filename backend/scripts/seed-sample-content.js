'use strict';
/**
 * seed-sample-content.js
 *
 * Creates 4 draft/published tutorial artifacts for a fresh install.
 * Called by docker-start.sh on first boot (capabilities count = 0).
 * Also called by seed-all.sh for local dev.
 *
 * Artifacts:
 *   _home_         — published page (homepage placeholder)
 *   about-pages    — draft page    (explains the page system)
 *   welcome        — draft article (explains the article system)
 *   about-products — draft product (explains product types)
 *
 * All creation calls are slug-guarded (skip if already exists).
 * Pages are created without an owner — the Page model has no author_id.
 * Article and product require an owner; skipped gracefully if none exists yet.
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── TipTap JSON helpers ──────────────────────────────────────────────────────

// For Articles and Products — raw TipTap JSON string
function doc(...children) {
  return JSON.stringify({ type: 'doc', content: children });
}

// For Pages — zone-based layout wrapping a TipTap doc object
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

// Empty string runs are filtered out; p() with no non-empty runs emits a
// bare { type:'paragraph' } — the correct TipTap representation of a spacer.
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
  p('Pages can be nested. A child page with slug “contact” under a parent with slug “about” is served at /about/contact. The catch-all router resolves any depth automatically.'),
  h2('Navigation'),
  p('Pages with “Show in Nav” enabled appear in the site header. Use “Nav Order” to control their position. Nested pages become sub-menu items under their parent.'),
  h2('The homepage waterfall'),
  p('When Homepage Mode is set to “Static Page” in Admin → Settings → General, the site resolves the root URL (/) in this order:'),
  ol(
    'The page you explicitly designated as homepage in General Settings — served at / and also at its own slug URL.',
    'If that page is unpublished, deleted, or not set: the page with the reserved slug _home_ (this page). Publish _home_ and it silently catches the gap.',
    'If _home_ is also missing or unpublished: the site redirects / to /articles so visitors always see something.',
  ),
  p(bold('Tip:'), ' Keep _home_ published as a safety net, even if a different page is your real homepage. The _home_ page cannot be deleted via the API — only its content can be changed.'),
);

const WELCOME_ARTICLE_CONTENT = doc(
  h1('About Articles'),
  p('Articles are the primary publishing format — blog posts, essays, news items, tutorials, and anything else that belongs in a reverse-chronological feed.'),
  h2('What an Article contains'),
  ul(
    'Title and slug',
    'Rich content body (TipTap editor — headings, lists, images, embeds)',
    'Excerpt (shown in listing cards)',
    'Categories and Tags (for filtering and discovery)',
    'Featured image',
    'Author',
    'Status: draft or published',
    'Visibility: public, logged-in users only, or admin only',
    'Comments and reviews (can be enabled per article)',
  ),
  h2('Publishing'),
  p('Set status to Published and the article appears on /articles and in any category or tag feeds. Drafts are visible only to admins in the backstage.'),
  h2('Comments and reviews'),
  p('Logged-in members can leave comments. Reviews add a star rating. You can moderate, approve, or delete any comment from Admin → Comments.'),
  h2('Version history'),
  p('Every save creates a version. You can restore any previous version from the article editor in the backstage.'),
);

const ABOUT_PRODUCTS_CONTENT = doc(
  h1('About Products'),
  p('Products are the commerce layer. Each product can be physical, digital, or a service — the checkout flow adapts to the type automatically.'),
  h2('Product types'),
  ul(
    'Physical — shipped to the buyer. Requires a shipping address at checkout. Has stock quantity and SKU.',
    'Digital — delivered by download link or email after payment. Upload source files (PDF, EPUB, ZIP, MP3, etc.) in the Digital Files panel.',
    'Service — a consultation, session, or subscription. No shipping, no file. Stock is replaced by an “available / unavailable” toggle.',
  ),
  h2('Key fields'),
  ul(
    'Title and slug',
    'Price and Compare-at Price (for showing a sale discount)',
    'SKU (unique product code)',
    'Stock quantity (physical only)',
    'Short description (shown in listing cards)',
    'Full description (rich text body)',
    'Categories and Tags',
    'Product images',
    'Status: draft or published',
  ),
  h2('Digital file delivery'),
  p('For digital products, upload source files in the Digital Files panel (visible after saving the product). You can upload multiple formats (e.g. PDF + EPUB). After purchase, the buyer receives a timed download link. Optionally, files can be personalised with the buyer\'s name.'),
  h2('Payments'),
  p('Stripe handles cards, Apple Pay, Google Pay, and Amazon Pay via Stripe Checkout. PayPal is available as an alternative. Configure your payment credentials in Admin → Settings → Payment Providers.'),
);

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed-sample-content] Starting...');

  // Pages have no author_id — create them regardless of whether an owner exists.
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

  // Article and product require an owner for author_id.
  const owner = await prisma.user.findFirst({ where: { role: 'owner' } });
  if (!owner) {
    console.log('[seed-sample-content] No owner account yet — skipping article and product (wizard will create them).');
    console.log('[seed-sample-content] Done.');
    return;
  }

  const existingArticle = await prisma.article.findFirst({ where: { slug: 'welcome' } });
  if (existingArticle) {
    console.log('[seed-sample-content] welcome article already exists — skipping.');
  } else {
    await prisma.article.create({
      data: {
        title: 'About Articles',
        slug: 'welcome',
        content: WELCOME_ARTICLE_CONTENT,
        excerpt: 'An introduction to the article system — what articles contain, how to publish them, and how comments and version history work.',
        author_id: owner.id,
        status: 'draft',
        visibility: 'public',
      },
    });
    console.log('[seed-sample-content] ✓ Created welcome article (draft)');
  }

  const existingProduct = await prisma.product.findFirst({ where: { slug: 'about-products' } });
  if (existingProduct) {
    console.log('[seed-sample-content] about-products product already exists — skipping.');
  } else {
    await prisma.product.create({
      data: {
        title: 'About Products',
        slug: 'about-products',
        description: ABOUT_PRODUCTS_CONTENT,
        short_description: 'An introduction to the product system — physical, digital, and service types; pricing; digital file delivery; and payment providers.',
        price: 0,
        sku: 'SAMPLE-ABOUT-PRODUCTS',
        stock_status: 'in_stock',
        stock_quantity: 0,
        product_type: 'physical',
        author_id: owner.id,
        status: 'draft',
        visibility: 'public',
      },
    });
    console.log('[seed-sample-content] ✓ Created about-products product (draft)');
  }

  console.log('[seed-sample-content] Done.');
}

main()
  .catch((e) => { console.error('[seed-sample-content] ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
