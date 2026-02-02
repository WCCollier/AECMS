/**
 * WordPress Migration Import Script
 *
 * This script imports the extracted WordPress content into AECMS.
 * Run with: npx ts-node prisma/import-wp-migration.ts
 */

import { PrismaClient, UserRole, ContentStatus, ContentVisibility, ProductType, StockStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env') });

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with adapter
const prisma = new PrismaClient({ adapter });

const MIGRATION_OUTPUT_DIR = path.join(__dirname, '../../migration/output');

interface MigratedUser {
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  email_verified: boolean;
  password_reset_required: boolean;
  wp_id: number;
  wp_login: string;
}

interface MigratedArticle {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: string;
  visibility: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  wp_id: number;
}

interface MigratedProduct {
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  price: number;
  status: string;
  visibility: string;
  product_type: string;
  stock_status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  wp_id: number;
}

interface MigratedPage {
  title: string;
  slug: string;
  content: string;
  status: string;
  visibility: string;
  template: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  wp_id: number;
}

function loadJson<T>(filename: string): T[] {
  const filePath = path.join(MIGRATION_OUTPUT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function importUsers(): Promise<Map<number, string>> {
  console.log('\n[1/4] Importing users...');

  const users = loadJson<MigratedUser>('users.json');
  const wpIdToUserId = new Map<number, string>();

  // Generate temporary password hash
  const tempPasswordHash = await bcrypt.hash('MustResetPassword123!', 12);

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          password_hash: tempPasswordHash,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role as UserRole,
          email_verified: user.email_verified,
        },
      });
      wpIdToUserId.set(user.wp_id, created.id);
      console.log(`  ✓ Created user: ${user.email} (role: ${user.role})`);
    } else {
      wpIdToUserId.set(user.wp_id, existing.id);
      console.log(`  ○ Skipped existing user: ${user.email}`);
    }
  }

  return wpIdToUserId;
}

async function importArticles(authorId: string): Promise<void> {
  console.log('\n[2/4] Importing articles...');

  const articles = loadJson<MigratedArticle>('articles.json');
  let created = 0;
  let skipped = 0;

  for (const article of articles) {
    const existing = await prisma.article.findUnique({
      where: { slug: article.slug },
    });

    if (!existing) {
      await prisma.article.create({
        data: {
          title: article.title,
          slug: article.slug,
          content: article.content,
          excerpt: article.excerpt,
          author_id: authorId,
          status: ContentStatus.published,
          visibility: ContentVisibility.public,
          published_at: article.published_at ? new Date(article.published_at) : new Date(),
          created_at: article.created_at ? new Date(article.created_at) : new Date(),
          updated_at: article.updated_at ? new Date(article.updated_at) : new Date(),
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✓ Created ${created} articles, skipped ${skipped} existing`);
}

async function importProducts(): Promise<void> {
  console.log('\n[3/4] Importing products...');

  const products = loadJson<MigratedProduct>('products.json');
  let created = 0;
  let skipped = 0;

  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          name: product.name,
          slug: product.slug,
          description: product.description,
          short_description: product.short_description,
          price: product.price / 100, // Convert cents to dollars for Decimal
          status: ContentStatus.published,
          visibility: ContentVisibility.public,
          product_type: ProductType.digital,
          stock_status: StockStatus.in_stock,
          published_at: product.published_at ? new Date(product.published_at) : new Date(),
          created_at: product.created_at ? new Date(product.created_at) : new Date(),
          updated_at: product.updated_at ? new Date(product.updated_at) : new Date(),
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✓ Created ${created} products, skipped ${skipped} existing`);
}

async function importPages(): Promise<void> {
  console.log('\n[4/4] Importing pages...');

  const pages = loadJson<MigratedPage>('pages.json');
  let created = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await prisma.page.findUnique({
      where: { slug: page.slug },
    });

    if (!existing) {
      await prisma.page.create({
        data: {
          title: page.title,
          slug: page.slug,
          content: page.content,
          status: ContentStatus.published,
          visibility: ContentVisibility.public,
          template: page.template || 'default',
          published_at: page.published_at ? new Date(page.published_at) : new Date(),
          created_at: page.created_at ? new Date(page.created_at) : new Date(),
          updated_at: page.updated_at ? new Date(page.updated_at) : new Date(),
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✓ Created ${created} pages, skipped ${skipped} existing`);
}

async function main() {
  console.log('=== WordPress Migration Import ===');
  console.log(`Migration data from: ${MIGRATION_OUTPUT_DIR}`);

  try {
    // Import users and get mapping
    const wpIdToUserId = await importUsers();

    // Get owner user for authorship
    const owner = await prisma.user.findFirst({
      where: { role: UserRole.owner },
    });

    if (!owner) {
      throw new Error('No owner user found. Run prisma db seed first.');
    }

    console.log(`\nUsing author: ${owner.email}`);

    // Import content
    await importArticles(owner.id);
    await importProducts();
    await importPages();

    // Summary
    const articleCount = await prisma.article.count();
    const productCount = await prisma.product.count();
    const pageCount = await prisma.page.count();
    const userCount = await prisma.user.count();

    console.log('\n=== Import Complete ===');
    console.log(`Total users: ${userCount}`);
    console.log(`Total articles: ${articleCount}`);
    console.log(`Total products: ${productCount}`);
    console.log(`Total pages: ${pageCount}`);

  } catch (error) {
    console.error('\nImport failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
