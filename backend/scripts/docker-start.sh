#!/bin/sh
# Docker container startup script.
# Runs on every container start (migrations are idempotent).
# Seeds capabilities and defaults only when the capabilities table is empty (fresh DB).
set -e

echo "[startup] Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "[startup] Checking capabilities table..."
CAPS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const p = new PrismaClient({ adapter });
p.capability.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); });
")

if [ "$CAPS" = "0" ]; then
  echo "[startup] Capabilities table empty — seeding minimal defaults..."
  node scripts/seed-minimal.js
else
  echo "[startup] Capabilities already seeded (count=${CAPS}) — skipping seed."
fi

echo "[startup] Starting application..."
exec node dist/src/main
