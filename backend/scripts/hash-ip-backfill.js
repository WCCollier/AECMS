'use strict';
/**
 * Step 13 backfill — hash existing IP addresses (SHA-256, one-way).
 * Run after Step 13 Deploy 1, before Deploy 2.
 * Idempotent: skips rows where hash is already set.
 * Note: IP addresses are not currently being stored by the app, so
 * this script will typically process 0 rows — it exists for completeness.
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
    const rows = await prisma.user.findMany({
      where: { id: { gt: cursor }, last_login_ip_hash: null, last_login_ip: { not: null } },
      select: { id: true, last_login_ip: true },
      take: 500,
      orderBy: { id: 'asc' },
    });
    for (const row of rows) {
      await prisma.user.update({ where: { id: row.id }, data: { last_login_ip_hash: hashIp(row.last_login_ip) } });
      userCount++;
    }
    cursor = rows.at(-1)?.id ?? '';
    if (rows.length === 0) break;
  } while (true);

  // Hash refresh_tokens.ip_address
  cursor = '';
  do {
    const rows = await prisma.refreshToken.findMany({
      where: { id: { gt: cursor }, ip_address_hash: null, ip_address: { not: null } },
      select: { id: true, ip_address: true },
      take: 500,
      orderBy: { id: 'asc' },
    });
    for (const row of rows) {
      await prisma.refreshToken.update({ where: { id: row.id }, data: { ip_address_hash: hashIp(row.ip_address) } });
      tokenCount++;
    }
    cursor = rows.at(-1)?.id ?? '';
    if (rows.length === 0) break;
  } while (true);

  console.log(`Done. Hashed: ${userCount} user IPs, ${tokenCount} refresh token IPs.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
