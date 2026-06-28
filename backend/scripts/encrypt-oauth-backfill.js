'use strict';
/**
 * Step 10 backfill — encrypt existing OAuth access_token / refresh_token values.
 * Run after Step 10 Deploy 1, before Deploy 2.
 * Idempotent: skips rows where access_token_enc is already set.
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
  let processed = 0;
  let cursor = '';

  console.log('Starting Step 10 OAuth token backfill...');

  do {
    const rows = await prisma.oAuthAccount.findMany({
      where: { id: { gt: cursor }, access_token_enc: null },
      select: { id: true, access_token: true, refresh_token: true },
      take: 500,
      orderBy: { id: 'asc' },
    });

    for (const row of rows) {
      await prisma.oAuthAccount.update({
        where: { id: row.id },
        data: {
          access_token_enc: row.access_token ? encrypt(row.access_token, key) : null,
          refresh_token_enc: row.refresh_token ? encrypt(row.refresh_token, key) : null,
        },
      });
      processed++;
    }

    cursor = rows.at(-1)?.id ?? '';
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Encrypted: ${processed} OAuth accounts.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
