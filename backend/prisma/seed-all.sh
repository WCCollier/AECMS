#!/bin/bash
set -e
cd "$(dirname "$0")/.."

PROFILE=${SEED_PROFILE:-minimal}
echo "=== Running seed scripts (SEED_PROFILE=${PROFILE}) ==="

# Always: capabilities, roles, site settings defaults
npx ts-node prisma/seed.ts

# Always (minimal+): sample draft content for fresh installs
node scripts/seed-sample-content.js

# fvr profile: FvR-specific content + test orders
if [ "$PROFILE" = "fvr" ] || [ "$PROFILE" = "demo" ]; then
  echo "--- Profile '${PROFILE}': seeding FvR content ---"
  npx ts-node prisma/seed-fvr.ts
  npx ts-node prisma/seed-orders.ts
fi

echo "=== Seed complete ==="
