/**
 * seed-fvr.ts — FvR (fantasyvreality.com) content seed
 *
 * Reads FvR_Deployment/fvr-content.xml and upserts all articles, reviews,
 * short thoughts, and lesson products. Idempotent: skips any slug that
 * already exists. Run via seed-all.sh (replaces seed-content.ts,
 * seed-short-thoughts.ts, seed-reviews.ts, seed_lessons.ts).
 */

import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient, ProductType, StockStatus, ContentStatus, ContentVisibility } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { DOMParser } from '@xmldom/xmldom';

config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var required');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

// ── XML path ──────────────────────────────────────────────────────────────────
const XML_PATH = path.join(__dirname, '..', '..', 'FvR_Deployment', 'fvr-content.xml');

// ── Lesson image map: slug → filename in uploads/wp-import/ ──────────────────
const LESSON_IMAGES: Record<string, string> = {
  'american-shooter-lesson-1-marksmanship':                    'female-rifleshooter1-1.jpg',
  'american-shooter-lesson-2-wing-shooting':                   'female-shotgun-shooter.jpg',
  'american-shooter-lesson-3-defensive-shooting-basics':       'female-tac-pistol-1.jpg',
  'american-shooter-lesson-4-defensive-shooting-additional-skills': 'female-tac-rifle.jpg',
  'american-shooter-supplemental-traditional-static-shooting': 'female-rifleshooter1-1.jpg',
  'american-shooter-supplemental-traditional-dynamic-shooting':'female-shotgun-shooter.jpg',
  'american-shooter-alternative-direct-to-defensive-shooting': 'female-tac-pistol-1.jpg',
};
const LOGO_IMAGE = 'Logo-base.png';

// ── XML helpers ───────────────────────────────────────────────────────────────
function text(el: Element | null, tag: string): string {
  if (!el) return '';
  const child = el.getElementsByTagName(tag)[0];
  return child ? (child.textContent ?? '') : '';
}

interface ArticleEntry {
  wp_id: string;
  slug: string;
  date: string;
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  content: string;
}

interface LessonEntry {
  slug: string;
  sku: string;
  price: number;
  title: string;
  short_description: string;
  description: string;
}

function parseXml(): { articles: ArticleEntry[]; lessons: LessonEntry[] } {
  if (!fs.existsSync(XML_PATH)) {
    throw new Error(`FvR content XML not found at ${XML_PATH}. Generate it first with the extraction script.`);
  }
  const xml = fs.readFileSync(XML_PATH, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement!;

  const articles: ArticleEntry[] = [];
  const lessons: LessonEntry[] = [];

  const articleSections = root.getElementsByTagName('articles');
  for (let s = 0; s < articleSections.length; s++) {
    const section = articleSections[s]!;
    const nodes = section.getElementsByTagName('article');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const tagsRaw = text(node as any, 'tags');
      articles.push({
        wp_id:    node.getAttribute('wp_id') ?? '',
        slug:     node.getAttribute('slug') ?? '',
        date:     node.getAttribute('date') ?? '',
        title:    text(node as any, 'title'),
        category: text(node as any, 'category'),
        tags:     tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
        excerpt:  text(node as any, 'excerpt'),
        content:  text(node as any, 'content'),
      });
    }
  }

  const productSections = root.getElementsByTagName('products');
  for (let s = 0; s < productSections.length; s++) {
    const section = productSections[s]!;
    const nodes = section.getElementsByTagName('product');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      lessons.push({
        slug:              node.getAttribute('slug') ?? '',
        sku:               node.getAttribute('sku') ?? '',
        price:             parseFloat(node.getAttribute('price') ?? '0'),
        title:             text(node as any, 'title'),
        short_description: text(node as any, 'short_description'),
        description:       text(node as any, 'description'),
      });
    }
  }

  return { articles, lessons };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n[FvR Seed] Reading content from XML…');
  const { articles, lessons } = parseXml();
  console.log(`  ${articles.length} articles, ${lessons.length} lesson products`);

  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'owner@aecms.local' } });

  // ── Categories ──────────────────────────────────────────────────────────────
  console.log('\n[1/4] Ensuring categories…');
  const categoryDefs = [
    { name: 'Fiction',       slug: 'fiction',       description: 'Fictional short stories, novel excerpts, and creative writing' },
    { name: 'Non-Fiction',   slug: 'non-fiction',   description: 'Essays, analysis, and non-fiction writing' },
    { name: 'Short Thoughts',slug: 'short-thoughts',description: 'Brief philosophical and political essays' },
    { name: 'Reviews',       slug: 'reviews',       description: 'Book, game, and gear reviews' },
    { name: 'Promos',        slug: 'promos',        description: 'Upcoming books, games, and projects' },
    { name: 'Books',         slug: 'books',         description: 'Feature articles about books and writing' },
    { name: 'Reality',       slug: 'reality',       description: 'Reality-based articles' },
  ];
  const categoryMap: Record<string, string> = {};
  for (const def of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: { name: def.name, slug: def.slug, description: def.description },
    });
    categoryMap[def.name] = cat.id;
  }
  console.log(`  ✓ ${categoryDefs.length} categories ready (Long-form, Short Thoughts, Reviews, Promos, Books, Reality, Fiction)`);

  // ── Tags ─────────────────────────────────────────────────────────────────────
  console.log('\n[2/4] Ensuring tags…');
  const allTagNames = [...new Set(articles.flatMap(a => a.tags))].filter(Boolean);
  const tagMap: Record<string, string> = {};
  for (const name of allTagNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tagMap[name] = tag.id;
  }
  console.log(`  ✓ ${allTagNames.length} tags ready`);

  // ── Articles ─────────────────────────────────────────────────────────────────
  console.log('\n[3/4] Upserting articles…');
  let created = 0, skipped = 0;

  for (const a of articles) {
    if (!a.slug || !a.title) continue;

    const existing = await prisma.article.findUnique({ where: { slug: a.slug }, select: { id: true } });

    if (existing) {
      // Ensure category / tag associations are present even on skip
      const catId = categoryMap[a.category];
      if (catId) {
        await prisma.articleCategory.upsert({
          where: { article_id_category_id: { article_id: existing.id, category_id: catId } },
          update: {}, create: { article_id: existing.id, category_id: catId },
        }).catch(() => {});
      }
      for (const tagName of a.tags) {
        const tagId = tagMap[tagName];
        if (tagId) {
          await prisma.articleTag.upsert({
            where: { article_id_tag_id: { article_id: existing.id, tag_id: tagId } },
            update: {}, create: { article_id: existing.id, tag_id: tagId },
          }).catch(() => {});
        }
      }
      skipped++;
      continue;
    }

    const article = await prisma.article.create({
      data: {
        title:            a.title,
        slug:             a.slug,
        content:          a.content,
        excerpt:          a.excerpt || null,
        status:           'published',
        visibility:       'public',
        author_id:        owner.id,
        author_can_edit:  true,
        author_can_delete:true,
        admin_can_edit:   true,
        admin_can_delete: true,
        published_at:     a.date ? new Date(a.date) : new Date(),
        created_at:       a.date ? new Date(a.date) : new Date(),
      },
    });

    const catId = categoryMap[a.category];
    if (catId) {
      await prisma.articleCategory.create({ data: { article_id: article.id, category_id: catId } });
    }
    for (const tagName of a.tags) {
      const tagId = tagMap[tagName];
      if (tagId) {
        await prisma.articleTag.create({ data: { article_id: article.id, tag_id: tagId } });
      }
    }

    created++;
    if (created <= 10 || created % 10 === 0) console.log(`  ✓ [${created}] ${a.title.slice(0,55)}`);
  }
  console.log(`  Articles: ${created} created, ${skipped} already existed`);

  // ── Lesson images ─────────────────────────────────────────────────────────────
  console.log('\n[4/4] Upserting lesson products…');
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'wp-import');
  const imageMediaMap: Record<string, string> = {};

  const imageFiles = [
    { filename: 'female-rifleshooter1-1.jpg', alt: 'Marksmanship lesson',         mime: 'image/jpeg' },
    { filename: 'female-shotgun-shooter.jpg',  alt: 'Wing shooting lesson',         mime: 'image/jpeg' },
    { filename: 'female-tac-pistol-1.jpg',    alt: 'Defensive shooting basics',     mime: 'image/jpeg' },
    { filename: 'female-tac-rifle.jpg',        alt: 'Defensive shooting advanced',   mime: 'image/jpeg' },
    { filename: 'Logo-base.png',              alt: 'Fantasy v Reality logo',         mime: 'image/png' },
  ];
  for (const img of imageFiles) {
    if (!fs.existsSync(path.join(uploadsDir, img.filename))) continue;
    const existing = await prisma.media.findFirst({ where: { filename: img.filename } });
    if (existing) {
      imageMediaMap[img.filename] = existing.id;
    } else {
      const m = await prisma.media.create({
        data: {
          filename:      img.filename,
          original_name: img.filename,
          mime_type:     img.mime,
          size:          0,
          file_path:     `wp-import/${img.filename}`,
          alt_text:      img.alt,
          uploaded_by:   owner.id,
        },
      });
      imageMediaMap[img.filename] = m.id;
    }
  }

  // ── Lessons ──────────────────────────────────────────────────────────────────
  let lCreated = 0, lSkipped = 0;
  for (const lesson of lessons) {
    const existing = await prisma.product.findFirst({ where: { slug: lesson.slug }, select: { id: true } });
    if (existing) { lSkipped++; continue; }

    const imageFile = LESSON_IMAGES[lesson.slug] ?? LOGO_IMAGE;
    const mediaId = imageMediaMap[imageFile];

    await prisma.product.create({
      data: {
        title:             lesson.title,
        slug:              lesson.slug,
        sku:               lesson.sku || null,
        description:       lesson.description,
        short_description: lesson.short_description,
        price:             lesson.price,
        product_type:      ProductType.service,
        stock_status:      StockStatus.available,
        stock_quantity:    null,
        status:            ContentStatus.published,
        visibility:        ContentVisibility.public,
        guest_purchaseable:true,
        published_at:      new Date(),
        ...(mediaId && {
          media: { create: { media_id: mediaId, is_primary: true, order: 0 } },
        }),
      },
    });
    lCreated++;
    console.log(`  ✓ ${lesson.title}`);
  }
  console.log(`  Lessons: ${lCreated} created, ${lSkipped} already existed`);

  console.log('\n[FvR Seed] Done.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
