/**
 * One-off / re-run-when-cookie-expires setup: writes Substack syndication
 * config into the ISM (site_settings), encrypting the session cookie the
 * same way LocalKeyProvider does. Mirrors migrate-env-to-ism.ts.
 *
 * How to get the cookie value:
 *   1. Log into substack.com as the account that owns the publication.
 *   2. Open DevTools → Network tab.
 *   3. Reload the page (or visit the publication's own dashboard).
 *   4. Click any request to substack.com, find the "Cookie" request header,
 *      copy its FULL value (not just substack.sid — the whole header string).
 *   5. Paste it as SUBSTACK_COOKIE below. It will stop working when the
 *      session expires or you log out elsewhere — re-run this script with a
 *      fresh cookie when that happens.
 *
 * Usage (from backend/ directory):
 *   SUBSTACK_PUBLICATION_URL="https://fantasyvreality.substack.com" \
 *   SUBSTACK_COOKIE="..." \
 *   npx ts-node -r tsconfig-paths/register scripts/substack/set-credentials.ts
 *
 * Optional: SUBSTACK_TAG_NAME (default "Articles"), SUBSTACK_BATCH_SIZE (default "5")
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

async function upsert(key: string, value: string, isSecret: boolean, sek: string) {
  const stored = isSecret ? encrypt(value, sek) : value;
  await prisma.siteSettings.upsert({
    where: { key },
    update: { value: stored },
    create: { key, value: stored },
  });
  console.log(`  ✓  ${key} = ${isSecret ? '••••••••' : value}`);
}

async function main() {
  const sek = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!sek) throw new Error('SETTINGS_ENCRYPTION_KEY env var is required');

  const publicationUrl = process.env.SUBSTACK_PUBLICATION_URL;
  const cookie = process.env.SUBSTACK_COOKIE;
  if (!publicationUrl || !cookie) {
    throw new Error('SUBSTACK_PUBLICATION_URL and SUBSTACK_COOKIE env vars are required');
  }

  console.log('\nWriting Substack syndication config to ISM (site_settings)\n');

  await upsert('syndication.substack_publication_url', publicationUrl.replace(/\/$/, ''), false, sek);
  await upsert('syndication.substack_cookie_enc', cookie, true, sek);

  if (process.env.SUBSTACK_TAG_NAME) {
    await upsert('syndication.substack_tag_name', process.env.SUBSTACK_TAG_NAME, false, sek);
  }
  if (process.env.SUBSTACK_BATCH_SIZE) {
    await upsert('syndication.substack_batch_size', process.env.SUBSTACK_BATCH_SIZE, false, sek);
  }

  console.log('\nDone. Run scripts/substack/sync.ts --dry-run to verify before a live run.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
