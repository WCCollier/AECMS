#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Running all seed scripts ==="
npx ts-node prisma/seed.ts        # users, capabilities, site settings
npx ts-node prisma/seed-fvr.ts    # FvR articles + lessons (reads FvR_Deployment/fvr-content.xml)
npx ts-node prisma/seed-orders.ts # faux order history
echo "=== All seeds complete ==="
