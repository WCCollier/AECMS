/**
 * Substack syndication sync — permanent operator tool (FR-019).
 *
 * Each run:
 *   1. Catalogues all published, non-deleted articles tagged "Articles"
 *      (configurable via syndication.substack_tag_name).
 *   2. Excludes any article that already has a SubstackSyncRecord.
 *   3. Takes the next N (oldest→newest by published_at; N = batch size,
 *      default 5) and creates a Substack draft for each.
 *   4. On success, writes a SubstackSyncRecord so it's never sent again.
 *
 * Never publishes — only ever creates drafts. A human still reviews and
 * clicks Publish in the Substack UI. See FR-019 for why.
 *
 * Usage (from backend/ directory):
 *   npx ts-node -r tsconfig-paths/register scripts/substack/sync.ts
 *   npx ts-node -r tsconfig-paths/register scripts/substack/sync.ts --dry-run
 *
 * --dry-run: catalogues and converts content exactly as a real run would,
 * prints the title/subtitle/HTML that would be sent to Substack for each
 * candidate, but makes no network call and writes no SubstackSyncRecord.
 * Use this to sanity-check the batch and the HTML conversion before trusting
 * the live path, especially on the first run against real articles.
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { articleContentToSubstackHtml } from './converter';
import { createSubstackDraft } from './client';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const DEFAULT_TAG_NAME = 'Articles';
const DEFAULT_BATCH_SIZE = 5;

// ── Decryption (mirrors LocalKeyProvider) — same pattern as resend-backfill.ts ──

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decrypt(stored: string, sek: string): string {
  const key = Buffer.from(sek, 'hex');
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function getSetting(key: string, sek: string): Promise<string | null> {
  const row = await prisma.siteSettings.findUnique({ where: { key } });
  if (!row?.value) return null;
  if (key.endsWith('_enc')) {
    try { return decrypt(row.value, sek); } catch { return null; }
  }
  return row.value;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const sek = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!sek) throw new Error('SETTINGS_ENCRYPTION_KEY env var is required');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required');

  const [publicationUrl, cookie, tagNameSetting, batchSizeSetting] = await Promise.all([
    getSetting('syndication.substack_publication_url', sek),
    getSetting('syndication.substack_cookie_enc', sek),
    getSetting('syndication.substack_tag_name', sek),
    getSetting('syndication.substack_batch_size', sek),
  ]);

  const tagName = tagNameSetting || DEFAULT_TAG_NAME;
  const batchSize = Number.parseInt(batchSizeSetting || '', 10) || DEFAULT_BATCH_SIZE;

  if (!dryRun && (!publicationUrl || !cookie)) {
    console.error(
      'ERROR: syndication.substack_publication_url and/or syndication.substack_cookie_enc not configured.\n' +
      'Run scripts/substack/set-credentials.ts first (see FR-019), or use --dry-run to preview without credentials.',
    );
    process.exit(1);
  }

  console.log(`Tag: "${tagName}"  |  Batch size: ${batchSize}  |  Mode: ${dryRun ? 'DRY RUN (no network, no DB writes)' : 'LIVE'}`);
  console.log('');

  const tag = await prisma.tag.findFirst({ where: { name: tagName } });
  if (!tag) {
    console.log(`No tag named "${tagName}" exists. Nothing to do.`);
    process.exit(0);
  }

  const candidates = await prisma.article.findMany({
    where: {
      deleted_at: null,
      status: 'published',
      tags: { some: { tag_id: tag.id } },
    },
    orderBy: { published_at: 'asc' },
    include: { substack_sync: true },
  });

  const alreadySynced = candidates.filter((a) => a.substack_sync);
  const pending = candidates.filter((a) => !a.substack_sync).slice(0, batchSize);

  console.log(`Catalogued ${candidates.length} article(s) tagged "${tagName}" — ${alreadySynced.length} already synced, ${candidates.length - alreadySynced.length} pending overall.`);
  console.log(`Taking next ${pending.length} (oldest → newest).`);
  console.log('');

  if (pending.length === 0) {
    console.log('Nothing new to sync.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const article of pending) {
    const bodyHtml = articleContentToSubstackHtml(article.content);
    const subtitle = article.excerpt ?? undefined;

    if (dryRun) {
      console.log(`── ${article.title} (${article.slug}) ──`);
      console.log(`  Subtitle: ${subtitle ?? '(none)'}`);
      console.log(`  Body HTML (${bodyHtml.length} chars):`);
      console.log(bodyHtml.slice(0, 1000) + (bodyHtml.length > 1000 ? '\n  …(truncated for preview)…' : ''));
      console.log('');
      ok++;
      continue;
    }

    try {
      const draft = await createSubstackDraft(
        { publicationUrl: publicationUrl!, cookie: cookie! },
        { title: article.title, subtitle, bodyHtml },
      );
      await prisma.substackSyncRecord.create({
        data: { article_id: article.id, substack_draft_id: draft.id },
      });
      console.log(`  ✓ ${article.title} → Substack draft ${draft.id}`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ ${article.title}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(dryRun ? `Dry run complete. ${ok} previewed.` : `Done. ${ok} drafted, ${failed} failed.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
