import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { PrismaClient, ProductType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

// Load .env first so DATABASE_URL can be picked up if not already in env
config({ path: path.join(__dirname, '..', '.env') });

// DATABASE_URL must be set before running
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL env var required');
}

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with adapter
const prisma = new PrismaClient({ adapter });

// ============================================================================
// CONSTANTS
// ============================================================================

const TAR_PATH = '/workspaces/AECMS/seed_data/wp_uploads.tar';
const EXTRACT_TMP = '/tmp/wp_extract';
const UPLOADS_DIR = '/workspaces/AECMS/backend/uploads/wp-import';

// Images to import from the tar archive (path within tar → target filename)
const IMAGES_TO_IMPORT: string[] = [
  '2020/11/ali_union_draft.png',
  '2020/11/chuck_union_draft.png',
  '2020/11/female-rifleshooter1-1.jpg',
  '2020/11/female-rifleshooter1.jpg',
  '2020/11/female-shotgun-shooter.jpg',
  '2020/11/female-tac-pistol-1.jpg',
  '2020/11/female-tac-pistol.jpg',
  '2020/11/female-tac-rifle.jpg',
  '2020/11/Logo-base.png',
  '2020/12/outsiders-cover-prototype-small.png',
  '2021/01/457PremiumWeb.png',
  '2021/01/Alien1.jpg',
  '2021/01/Alien2.jpg',
  '2021/01/Alien3-1.jpg',
  '2021/01/Alien4.jpg',
  '2021/01/Alien5.jpg',
  '2021/01/Alien_portrait.jpg',
  '2021/01/colt-78539-M4.jpg',
  '2021/01/MkIV-2245-red.jpg',
  '2021/01/st-88693a-K98.jpg',
  '2021/01/urex-77832-G17.jpg',
  '2021/02/smithwesson-mp15-22-sport-robin-s-egg.jpg',
  '2021/05/Alien-Target.jpg',
  '2021/05/CZ_right_quarter.jpg',
  '2021/05/Gallery_15-22_rear.jpg',
  '2021/05/Gallery_Alien.jpg',
  '2021/05/Gallery_CZ_loading.jpg',
  '2021/05/Gallery_CZ_rear.jpg',
  '2021/05/Gallery_CZ_sling.jpg',
  '2021/05/Gallery_X95_rear.jpg',
  '2021/12/three_covers_spread.jpg',
  '2022/03/Cover-Page-Left.png',
  '2022/03/Cover-Page-Right.png',
  '2022/04/forgotten_ruin.jpg',
  '2022/04/splitSecond-BOD.jpg',
  '2025/06/healingstone.jpg',
  '2025/06/justifiedcover.jpg',
  '2025/06/reliquaryofthedead.jpg',
  '2025/06/stgeorgeandthedragon.jpg',
  '2025/06/waterwar.jpg',
  '2025/07/1.0-Cover.png',
  '2025/08/aftermosescover.jpg',
  '2025/08/sapphireprince.jpg',
  '2025/12/travel_by_star_cover.jpg',
];

// Title map keyed by wp_id
const ARTICLE_TITLES: Record<number, string> = {
  381: 'How Writing Works',
  383: 'The Mission',
  385: 'Meeting the Parents',
  387: 'The Ride',
  465: 'Rule of Thumb: Rights',
  591: 'How to attack the Bible',
  733: 'Sample Chapter: Discoveries',
};

// Excerpt overrides keyed by wp_id
const ARTICLE_EXCERPTS: Record<number, string> = {
  381: 'A short(ish) explanation of why you were taught to write the way you were taught in English class, the art we call Rhetoric.',
  591: 'Always thought about reading the Bible, or maybe tried it once or twice, but it was just TOO MUCH?',
};

// Category assignment: wp_id → category name
const ARTICLE_CATEGORIES: Record<number, string> = {
  383: 'Fiction',
  385: 'Fiction',
  387: 'Fiction',
  733: 'Fiction',
  381: 'Non-Fiction',
  465: 'Non-Fiction',
  591: 'Non-Fiction',
};

// Tag assignment: wp_id → tag names
const ARTICLE_TAGS: Record<number, string[]> = {
  381: ['writing', 'rhetoric'],
  383: ['novel', 'fiction', 'outsiders'],
  385: ['novel', 'fiction', 'outsiders'],
  387: ['novel', 'fiction', 'outsiders'],
  465: ['guns', 'rights'],
  591: ['bible', 'reading'],
  733: ['discoveries', 'novel'],
};

// Products to create
const PRODUCTS = [
  {
    name: 'American Shooter: Safe Gun Ownership and Handling',
    slug: 'american-shooter-safe-gun-ownership',
    description:
      'A comprehensive online course covering the fundamentals of safe gun ownership and handling. Includes classroom instruction and practical exercises.',
    short_description: 'Online course: Safe gun ownership fundamentals',
    price: 49.95,
    sku: 'AS-SGO-001',
    product_type: ProductType.digital,
    visibility: 'public' as const,
    status: 'published' as const,
  },
  {
    name: 'American Shooter Supplemental: Classroom and Lab',
    slug: 'american-shooter-classroom-lab',
    description:
      'Supplemental coursework for the American Shooter curriculum. Covers classroom instruction and hands-on lab exercises for safe firearm handling.',
    short_description: 'Supplemental classroom and lab curriculum',
    price: 29.95,
    sku: 'AS-CL-001',
    product_type: ProductType.digital,
    visibility: 'public' as const,
    status: 'published' as const,
  },
  {
    name: 'American Shooter Alternative: Direct to Defensive Shooting',
    slug: 'american-shooter-defensive-shooting',
    description:
      'An accelerated course taking students directly to defensive shooting techniques. Designed for those with prior firearm experience.',
    short_description: 'Accelerated defensive shooting curriculum',
    price: 89.95,
    sku: 'AS-DDS-001',
    product_type: ProductType.digital,
    visibility: 'public' as const,
    status: 'published' as const,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

async function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    // Import sharp dynamically to avoid issues if not available
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch {
    return null;
  }
}

function stripWpBlockComments(content: string): string {
  // Remove WordPress block comments like <!-- wp:paragraph --> and <!-- /wp:paragraph -->
  return content.replace(/<!--\s*\/?wp:[^>]*-->/g, '');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== AECMS Content Seed Script ===\n');

  // --------------------------------------------------
  // 0. Look up owner user
  // --------------------------------------------------
  const owner = await prisma.user.findUnique({
    where: { email: 'owner@aecms.local' },
    select: { id: true },
  });

  if (!owner) {
    throw new Error(
      'Owner user not found. Run the base seed script first: npx prisma db seed',
    );
  }

  const ownerId = owner.id;
  console.log(`Owner user ID: ${ownerId}\n`);

  // --------------------------------------------------
  // 1. Extract images and create Media records
  // --------------------------------------------------
  console.log('[1/4] Importing images and creating Media records...');

  // Ensure directories exist
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(EXTRACT_TMP, { recursive: true });

  let mediaCreated = 0;
  let mediaSkipped = 0;
  const mediaByFilename: Record<string, string> = {}; // filename → media UUID

  for (const tarPath of IMAGES_TO_IMPORT) {
    const filename = path.basename(tarPath);
    const destPath = path.join(UPLOADS_DIR, filename);

    // Extract from tar to tmp location
    const tmpFilePath = path.join(EXTRACT_TMP, filename);

    try {
      // Extract to tmp dir
      execSync(
        `tar -xf "${TAR_PATH}" -C "${EXTRACT_TMP}" "${tarPath}" --strip-components=${tarPath.split('/').length - 1}`,
        { stdio: 'pipe' },
      );

      // Copy to uploads dir
      fs.copyFileSync(tmpFilePath, destPath);

      // Cleanup tmp file
      try {
        fs.unlinkSync(tmpFilePath);
      } catch {
        // ignore cleanup errors
      }
    } catch (err) {
      console.warn(`  [WARN] Could not extract ${tarPath}: ${err}`);
      continue;
    }

    const stat = fs.statSync(destPath);
    const mimeType = getMimeType(filename);
    const dimensions = await getImageDimensions(destPath);

    // Upsert Media record (idempotent by file_path)
    const existing = await prisma.media.findFirst({
      where: { file_path: destPath },
      select: { id: true },
    });

    if (existing) {
      mediaByFilename[filename] = existing.id;
      mediaSkipped++;
      continue;
    }

    const media = await prisma.media.create({
      data: {
        filename,
        original_name: filename,
        mime_type: mimeType,
        size: stat.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        file_path: destPath,
        uploaded_by: ownerId,
      },
    });

    mediaByFilename[filename] = media.id;
    mediaCreated++;
    console.log(`  ✓ ${filename} (${media.id})`);
  }

  console.log(
    `\nMedia: ${mediaCreated} created, ${mediaSkipped} already existed\n`,
  );

  // --------------------------------------------------
  // 2. Create Categories
  // --------------------------------------------------
  console.log('[2/4] Creating article categories...');

  const categoryNames = ['Fiction', 'Non-Fiction'];
  const categoryMap: Record<string, string> = {}; // name → UUID

  for (const name of categoryNames) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    categoryMap[name] = category.id;
    console.log(`  ✓ Category: ${name} (${category.id})`);
  }

  // --------------------------------------------------
  // 3. Create Tags
  // --------------------------------------------------
  console.log('\n[3/4] Creating tags...');

  const allTagNames = new Set<string>();
  for (const tags of Object.values(ARTICLE_TAGS)) {
    tags.forEach((t) => allTagNames.add(t));
  }

  const tagMap: Record<string, string> = {}; // name → UUID

  for (const name of allTagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tagMap[name] = tag.id;
    console.log(`  ✓ Tag: ${name} (${tag.id})`);
  }

  // --------------------------------------------------
  // 4. Create Articles
  // --------------------------------------------------
  console.log('\n[4a/4] Creating articles...');

  interface WpArticle {
    wp_id: number;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
  }

  const rawArticles: WpArticle[] = JSON.parse(
    fs.readFileSync('/tmp/wp_articles.json', 'utf8'),
  );

  let articlesCreated = 0;
  let articlesSkipped = 0;

  for (const raw of rawArticles) {
    const title = ARTICLE_TITLES[raw.wp_id] ?? raw.title;
    const slug = raw.slug;
    const content = stripWpBlockComments(raw.content);
    const excerpt =
      ARTICLE_EXCERPTS[raw.wp_id] ??
      (raw.excerpt && raw.excerpt.trim() ? raw.excerpt.trim() : undefined);
    const categoryName = ARTICLE_CATEGORIES[raw.wp_id];
    const tagNames = ARTICLE_TAGS[raw.wp_id] ?? [];

    // Check if article already exists by slug
    const existing = await prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] Article already exists: ${slug}`);
      articlesSkipped++;
      // Still wire up categories and tags if missing
      if (categoryName && categoryMap[categoryName]) {
        await prisma.articleCategory
          .upsert({
            where: {
              article_id_category_id: {
                article_id: existing.id,
                category_id: categoryMap[categoryName],
              },
            },
            update: {},
            create: {
              article_id: existing.id,
              category_id: categoryMap[categoryName],
            },
          })
          .catch(() => {});
      }
      for (const tagName of tagNames) {
        if (tagMap[tagName]) {
          await prisma.articleTag
            .upsert({
              where: {
                article_id_tag_id: {
                  article_id: existing.id,
                  tag_id: tagMap[tagName],
                },
              },
              update: {},
              create: {
                article_id: existing.id,
                tag_id: tagMap[tagName],
              },
            })
            .catch(() => {});
        }
      }
      continue;
    }

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt ?? null,
        status: 'published',
        visibility: 'public',
        author_id: ownerId,
        author_can_edit: true,
        author_can_delete: true,
        admin_can_edit: true,
        admin_can_delete: true,
        published_at: new Date(),
      },
    });

    // Link category
    if (categoryName && categoryMap[categoryName]) {
      await prisma.articleCategory.create({
        data: {
          article_id: article.id,
          category_id: categoryMap[categoryName],
        },
      });
    }

    // Link tags
    for (const tagName of tagNames) {
      if (tagMap[tagName]) {
        await prisma.articleTag.create({
          data: {
            article_id: article.id,
            tag_id: tagMap[tagName],
          },
        });
      }
    }

    articlesCreated++;
    console.log(`  ✓ Article: "${title}" (${article.id})`);
  }

  console.log(
    `\nArticles: ${articlesCreated} created, ${articlesSkipped} already existed\n`,
  );

  // --------------------------------------------------
  // 5. Create Products
  // --------------------------------------------------
  console.log('[4b/4] Creating products...');

  let productsCreated = 0;
  let productsSkipped = 0;

  for (const prod of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { slug: prod.slug },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] Product already exists: ${prod.slug}`);
      productsSkipped++;
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        short_description: prod.short_description,
        price: prod.price,
        sku: prod.sku,
        stock_quantity: 0,
        product_type: prod.product_type,
        visibility: prod.visibility,
        status: prod.status,
        author_can_edit: true,
        author_can_delete: true,
        admin_can_edit: true,
        admin_can_delete: true,
        published_at: new Date(),
      },
    });

    productsCreated++;
    console.log(`  ✓ Product: "${prod.name}" (${product.id})`);
  }

  console.log(
    `\nProducts: ${productsCreated} created, ${productsSkipped} already existed\n`,
  );

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  console.log('=== Seed Summary ===');
  console.log(
    `Media records:   ${mediaCreated} created, ${mediaSkipped} skipped`,
  );
  console.log(
    `Articles:        ${articlesCreated} created, ${articlesSkipped} skipped`,
  );
  console.log(
    `Products:        ${productsCreated} created, ${productsSkipped} skipped`,
  );
  console.log('\nContent seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during content seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
