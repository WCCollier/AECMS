'use strict';
/**
 * Step 11 backfill — encrypt existing orders shipping PII fields.
 * Run after Step 11 Deploy 1, before Deploy 2.
 * Processes in batches of 500 to avoid long-running transactions.
 * Idempotent: skips rows where customer_name_enc is already set.
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

function getKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('SETTINGS_ENCRYPTION_KEY must be a 64-char hex string');
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext, key) {
  if (!plaintext) return null;
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

  console.log('Starting Step 11 orders PII backfill...');

  do {
    const rows = await prisma.order.findMany({
      where: { id: { gt: cursor }, customer_name_enc: null },
      select: { id: true, customer_name: true, shipping_name: true, shipping_address: true, shipping_city: true, shipping_zip: true },
      take: 500,
      orderBy: { id: 'asc' },
    });

    for (const row of rows) {
      await prisma.order.update({
        where: { id: row.id },
        data: {
          customer_name_enc:    encrypt(row.customer_name, key),
          shipping_name_enc:    encrypt(row.shipping_name, key),
          shipping_address_enc: encrypt(row.shipping_address, key),
          shipping_city_enc:    encrypt(row.shipping_city, key),
          shipping_zip_enc:     encrypt(row.shipping_zip, key),
        },
      });
      processed++;
    }

    cursor = rows.at(-1)?.id ?? '';
    if (rows.length > 0) console.log(`  Processed ${processed} orders...`);
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Encrypted PII in ${processed} orders.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
