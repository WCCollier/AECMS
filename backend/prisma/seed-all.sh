#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Running all seed scripts ==="
npx ts-node prisma/seed.ts
npx ts-node prisma/seed-content.ts
npx ts-node prisma/seed_lessons.ts
npx ts-node prisma/seed-reviews.ts
npx ts-node prisma/seed-short-thoughts.ts
echo "=== All seeds complete ==="
