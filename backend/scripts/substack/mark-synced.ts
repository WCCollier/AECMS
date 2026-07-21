/**
 * Marks one or more articles as already syndicated to Substack, without
 * creating a draft or calling the Substack API. For articles that were
 * published on Substack by hand (before or outside of sync.ts) — so sync.ts
 * knows to skip them on its next run.
 *
 * Usage (from backend/ directory):
 *   npx ts-node -r tsconfig-paths/register scripts/substack/mark-synced.ts <slug> [slug...]
 *
 * Idempotent: re-running with a slug that's already marked is a no-op (logs
 * and skips rather than erroring), so it's safe to re-run with an overlapping
 * list.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('Usage: mark-synced.ts <slug> [slug...]');
    process.exit(1);
  }

  for (const slug of slugs) {
    const article = await prisma.article.findUnique({ where: { slug }, include: { substack_sync: true } });
    if (!article) {
      console.warn(`  ⚠ No article with slug "${slug}" — skipping.`);
      continue;
    }
    if (article.substack_sync) {
      console.log(`  – "${article.title}" already marked synced (${article.substack_sync.synced_at.toISOString()}) — skipping.`);
      continue;
    }
    await prisma.substackSyncRecord.create({
      data: { article_id: article.id, substack_draft_id: null },
    });
    console.log(`  ✓ "${article.title}" (${slug}) marked as already synced.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
