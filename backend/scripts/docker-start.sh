#!/bin/sh
# Docker container startup script.
# Runs on every container start (migrations are idempotent).
# seed-minimal.js (capabilities + settings) always runs — it is fully idempotent.
# seed-sample-content.js only runs on a fresh DB (capabilities table empty).
set -e

# Prisma advisory locking requires a persistent (non-pooled) connection.
# Neon's pooler URL contains '-pooler.' in the hostname; derive the direct URL
# by removing it so pg_advisory_lock works reliably during migrations.
# If DATABASE_URL is already a direct URL the substitution is a no-op.
MIGRATION_DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/-pooler\././')

echo "[startup] Running database migrations..."
DATABASE_URL="$MIGRATION_DATABASE_URL" node_modules/.bin/prisma migrate deploy

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
