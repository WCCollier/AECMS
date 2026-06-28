'use strict';
/**
 * Step 11 backfill — encrypt existing orders shipping PII fields.
 * Run after Step 11 Deploy 1, before Deploy 2.
 * Processes in batches of 500 to avoid long-running transactions.
 * Idempotent: skips rows where customer_name_enc is already set.
 */
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
    const { rows } = await pool.query(
      `SELECT id, customer_name, shipping_name, shipping_address, shipping_city, shipping_zip
       FROM orders
       WHERE customer_name_enc IS NULL AND id > $1
       ORDER BY id ASC LIMIT 500`,
      [cursor],
    );

    for (const row of rows) {
      await pool.query(
        `UPDATE orders SET
           customer_name_enc    = $1,
           shipping_name_enc    = $2,
           shipping_address_enc = $3,
           shipping_city_enc    = $4,
           shipping_zip_enc     = $5
         WHERE id = $6`,
        [
          encrypt(row.customer_name, key),
          encrypt(row.shipping_name, key),
          encrypt(row.shipping_address, key),
          encrypt(row.shipping_city, key),
          encrypt(row.shipping_zip, key),
          row.id,
        ],
      );
      processed++;
    }

    cursor = rows.at(-1)?.id ?? '';
    if (rows.length > 0) console.log(`  Processed ${processed} orders...`);
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Encrypted PII in ${processed} orders.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
