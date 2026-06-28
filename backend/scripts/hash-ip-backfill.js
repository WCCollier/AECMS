'use strict';
/**
 * Step 13 backfill — hash existing IP addresses (SHA-256, one-way).
 * Run after Step 13 Deploy 1, before Deploy 2.
 * Idempotent: skips rows where hash is already set.
 * Note: IP addresses are not currently being stored by the app, so
 * this script will typically process 0 rows — it exists for completeness.
 */
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

async function main() {
  console.log('Starting Step 13 IP hash backfill...');
  let userCount = 0;
  let tokenCount = 0;
  let cursor = '';

  // Hash users.last_login_ip
  do {
    const { rows } = await pool.query(
      `SELECT id, last_login_ip FROM users
       WHERE last_login_ip_hash IS NULL AND last_login_ip IS NOT NULL AND id > $1
       ORDER BY id ASC LIMIT 500`,
      [cursor],
    );
    for (const row of rows) {
      await pool.query('UPDATE users SET last_login_ip_hash = $1 WHERE id = $2', [hashIp(row.last_login_ip), row.id]);
      userCount++;
    }
    cursor = rows.at(-1)?.id ?? '';
    if (rows.length === 0) break;
  } while (true);

  // Hash refresh_tokens.ip_address
  cursor = '';
  do {
    const { rows } = await pool.query(
      `SELECT id, ip_address FROM refresh_tokens
       WHERE ip_address_hash IS NULL AND ip_address IS NOT NULL AND id > $1
       ORDER BY id ASC LIMIT 500`,
      [cursor],
    );
    for (const row of rows) {
      await pool.query('UPDATE refresh_tokens SET ip_address_hash = $1 WHERE id = $2', [hashIp(row.ip_address), row.id]);
      tokenCount++;
    }
    cursor = rows.at(-1)?.id ?? '';
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Hashed: ${userCount} user IPs, ${tokenCount} refresh token IPs.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
