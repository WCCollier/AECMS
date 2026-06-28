'use strict';
/**
 * Step 9 backfill — encrypt existing totp_secret values into totp_secret_enc.
 * Run after Step 9 Deploy 1, before Deploy 2.
 * Requires: DATABASE_URL and SETTINGS_ENCRYPTION_KEY in env.
 * Idempotent: skips rows where totp_secret_enc is already set.
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('SETTINGS_ENCRYPTION_KEY must be a 64-char hex string');
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

async function main() {
  const key = getKey();
  const BATCH = 500;
  let cursor = '';
  let processed = 0;
  let skipped = 0;

  console.log('Starting Step 9 TOTP backfill...');

  do {
    const rows = await prisma.user.findMany({
      where: { id: { gt: cursor }, totp_secret_enc: null, totp_secret: { not: null } },
      select: { id: true, totp_secret: true },
      take: BATCH,
      orderBy: { id: 'asc' },
    });

    for (const row of rows) {
      await prisma.user.update({
        where: { id: row.id },
        data: { totp_secret_enc: encrypt(row.totp_secret, key) },
      });
      processed++;
    }

    cursor = rows.at(-1)?.id ?? '';
    if (rows.length > 0) console.log(`  Processed ${processed} rows...`);
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Encrypted: ${processed}, Skipped (already set): ${skipped}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
