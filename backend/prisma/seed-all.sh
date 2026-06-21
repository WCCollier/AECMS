#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Running seed scripts ==="

# Capabilities, roles, site settings defaults
npx ts-node prisma/seed.ts

# Tutorial pages for fresh installs (no owner required)
node scripts/seed-sample-content.js

echo "=== Seed complete ==="
