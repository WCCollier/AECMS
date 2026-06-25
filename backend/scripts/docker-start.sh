#!/bin/sh
# Docker container startup script.
# Runs on every container start (migrations are idempotent).
# seed-minimal.js (capabilities + settings) always runs — it is fully idempotent.
# seed-sample-content.js only runs on a fresh DB (capabilities table empty).
set -e

echo "[startup] Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "[startup] Syncing capabilities and default settings..."
node scripts/seed-minimal.js

echo "[startup] Checking if sample content seed is needed..."
CAPS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const p = new PrismaClient({ adapter });
p.article.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); });
")

if [ "$CAPS" = "0" ]; then
  echo "[startup] No articles found — seeding sample draft content..."
  node scripts/seed-sample-content.js
else
  echo "[startup] Content already exists (articles=${CAPS}) — skipping sample content seed."
fi

echo "[startup] Starting application..."
exec node dist/src/main
