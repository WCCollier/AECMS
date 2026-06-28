'use strict';
/**
 * Step 12 backfill — encrypt existing users first_name / last_name fields.
 * Run after Step 12 Deploy 1, before Deploy 2.
 * Idempotent: skips rows where first_name_enc is already set.
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

  console.log('Starting Step 12 user name backfill...');

  do {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name FROM users
       WHERE first_name_enc IS NULL AND id > $1
       ORDER BY id ASC LIMIT 500`,
      [cursor],
    );

    for (const row of rows) {
      await pool.query(
        'UPDATE users SET first_name_enc = $1, last_name_enc = $2 WHERE id = $3',
        [encrypt(row.first_name, key), encrypt(row.last_name, key), row.id],
      );
      processed++;
    }

    cursor = rows.at(-1)?.id ?? '';
    if (rows.length > 0) console.log(`  Processed ${processed} users...`);
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Encrypted names for ${processed} users.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
