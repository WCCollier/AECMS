/**
 * Resend Broadcast backfill — permanent operator tool.
 *
 * Syncs all AECMS subscribers into the configured Resend Audience + Topics.
 * Run once after configuring Resend Broadcast in Admin → Settings → Email.
 * Safe to re-run at any time — upserts are idempotent.
 *
 * Usage (from backend/ directory):
 *   npx ts-node --project tsconfig.json scripts/resend-backfill.ts
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const RESEND_BASE = 'https://api.resend.com';

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
  if (!row) return null;
  if (key.endsWith('_enc') && row.value) {
    try { return decrypt(row.value, sek); } catch { return null; }
  }
  return row.value || null;
}

async function resendFetch(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${RESEND_BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

async function findContactId(email: string, apiKey: string, audienceId: string): Promise<string | null> {
  const r = await resendFetch(`audiences/${audienceId}/contacts`, 'GET', apiKey);
  if (!r.ok) return null;
  const contacts: any[] = r.data?.data ?? [];
  return contacts.find((c: any) => c.email === email)?.id ?? null;
}

async function upsertContact(email: string, firstName: string, lastName: string, apiKey: string, audienceId: string): Promise<string | null> {
  const r = await resendFetch(`audiences/${audienceId}/contacts`, 'POST', apiKey, {
    email,
    first_name: firstName,
    last_name: lastName,
    unsubscribed: false,
  });
  if (r.ok && r.data?.id) return r.data.id as string;
  // If already exists (may return 422 or 409), fetch the contact
  if (!r.ok) {
    return findContactId(email, apiKey, audienceId);
  }
  return r.data?.id ?? null;
}

async function subscribeContactToTopic(contactId: string, topicId: string, apiKey: string, audienceId: string): Promise<void> {
  const r = await resendFetch(`audiences/${audienceId}/contacts/${contactId}`, 'PATCH', apiKey, {
    subscriptions: [{ topic_id: topicId, status: 'active' }],
  });
  if (!r.ok) {
    console.warn(`  ⚠ Topic subscribe failed contactId=${contactId} topicId=${topicId}: ${JSON.stringify(r.data)}`);
  }
}

async function main() {
  const sek = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!sek) throw new Error('SETTINGS_ENCRYPTION_KEY env var is required');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required');

  console.log('Loading Resend configuration from ISM…');

  const [provider, apiKey, audienceId, articlesTopicId, productsTopicId, newsTopicId] = await Promise.all([
    getSetting('email.broadcast_provider', sek),
    getSetting('email.broadcast_resend_api_key_enc', sek),
    getSetting('email.broadcast_resend_audience_id', sek),
    getSetting('email.broadcast_resend_articles_topic_id', sek),
    getSetting('email.broadcast_resend_products_topic_id', sek),
    getSetting('email.broadcast_resend_news_topic_id', sek),
  ]);

  if (provider !== 'resend') {
    console.error('ERROR: email.broadcast_provider is not set to "resend". Configure it in Admin → Settings → Email first.');
    process.exit(1);
  }
  if (!apiKey) { console.error('ERROR: email.broadcast_resend_api_key_enc not configured.'); process.exit(1); }
  if (!audienceId) { console.error('ERROR: email.broadcast_resend_audience_id not configured.'); process.exit(1); }

  console.log(`Audience ID: ${audienceId}`);
  console.log(`Articles topic: ${articlesTopicId ?? '(not set)'}`);
  console.log(`Products topic: ${productsTopicId ?? '(not set)'}`);
  console.log(`News topic:     ${newsTopicId ?? '(not set)'}`);
  console.log('');

  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      OR: [
        { subscribe_new_articles: true },
        { subscribe_new_products: true },
        { subscribe_news_alerts: true },
      ],
    },
    select: {
      email: true,
      first_name_enc: true,
      last_name_enc: true,
      subscribe_new_articles: true,
      subscribe_new_products: true,
      subscribe_news_alerts: true,
    },
  });

  console.log(`Found ${users.length} users with at least one active subscription.`);
  if (users.length === 0) { console.log('Nothing to sync.'); process.exit(0); }

  let ok = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // Decrypt names (fall back to empty string if not set)
      let firstName = '';
      let lastName = '';
      if (user.first_name_enc) {
        try { firstName = decrypt(user.first_name_enc, sek); } catch { /* ignore */ }
      }
      if (user.last_name_enc) {
        try { lastName = decrypt(user.last_name_enc, sek); } catch { /* ignore */ }
      }

      const contactId = await upsertContact(user.email, firstName, lastName, apiKey, audienceId);
      if (!contactId) {
        console.warn(`  ⚠ Could not upsert contact for ${user.email}`);
        failed++;
        continue;
      }

      const syncs: Promise<void>[] = [];
      if (user.subscribe_new_articles && articlesTopicId) {
        syncs.push(subscribeContactToTopic(contactId, articlesTopicId, apiKey, audienceId));
      }
      if (user.subscribe_new_products && productsTopicId) {
        syncs.push(subscribeContactToTopic(contactId, productsTopicId, apiKey, audienceId));
      }
      if (user.subscribe_news_alerts && newsTopicId) {
        syncs.push(subscribeContactToTopic(contactId, newsTopicId, apiKey, audienceId));
      }
      await Promise.all(syncs);

      console.log(`  ✓ ${user.email}`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ ${user.email}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Done. ${ok} synced, ${failed} failed.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
