/**
 * Seed: Faux order history for Phase 9 testing
 *
 * Creates ~12 realistic orders spread across the past 90 days:
 *   - Various statuses: pending, processing, completed, cancelled, refunded
 *   - Member orders, guest orders, owner orders
 *   - Single-item and multi-item orders
 *   - Physical (hat) and service (lesson) products
 *
 * Safe to re-run — skips if orders already exist.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function orderNum(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rnd}`;
}

async function main() {
  console.log('\n[seed-orders] Seeding faux order history…');

  // Guard: skip if we already have a meaningful set of orders
  const existingCount = await prisma.order.count();
  if (existingCount >= 12) {
    console.log(`[seed-orders] ${existingCount} orders already exist — skipping.`);
    return;
  }

  // ── Look up users ──────────────────────────────────────────────────────────
  const [owner, member] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'owner@aecms.local' } }),
    prisma.user.findUnique({ where: { email: 'member@aecms.local' } }),
  ]);

  if (!owner || !member) {
    console.error('[seed-orders] Seeded users not found — run main seed first.');
    process.exit(1);
  }

  // ── Ensure the physical hat product exists ────────────────────────────────
  const hat = await prisma.product.upsert({
    where: { slug: 'american-shooter-hat' },
    update: {},
    create: {
      name: 'American Shooter Hat',
      slug: 'american-shooter-hat',
      description: '<p>Official American Shooter branded hat. One size fits most.</p>',
      price: 24.99,
      sku: 'AS-HAT-001',
      stock_quantity: 5,
      stock_status: 'in_stock',
      product_type: 'physical',
      status: 'published',
      visibility: 'public',
      author_id: owner.id,
    },
  });

  // ── Look up service products ───────────────────────────────────────────────
  const [lesson1, lesson2, lesson3, defensive] = await Promise.all([
    prisma.product.findFirst({ where: { slug: 'american-shooter-safe-gun-ownership' } }),
    prisma.product.findFirst({ where: { slug: 'american-shooter-classroom-lab' } }),
    prisma.product.findFirst({ where: { slug: 'american-shooter-defensive-shooting' } }),
    prisma.product.findFirst({ where: { product_type: 'service', status: 'published' } }),
  ]);

  // Build a usable product list (filter nulls, prefer known ones)
  const physicalProduct = hat;
  const serviceProducts = [lesson1, lesson2, lesson3, defensive].filter(Boolean);
  const anyProduct = serviceProducts[0] ?? physicalProduct;

  if (!anyProduct) {
    console.error('[seed-orders] No published products found — run seed-content first.');
    process.exit(1);
  }

  console.log(`[seed-orders] Found hat: ${hat?.name ?? 'none'}`);
  console.log(`[seed-orders] Found service products: ${serviceProducts.map(p => p!.slug).join(', ')}`);

  // ── Helper: create one order ───────────────────────────────────────────────
  type AnyProduct = typeof hat | typeof lesson1 | typeof lesson2 | null;

  async function createOrder(opts: {
    userId?: string;
    email: string;
    status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
    items: Array<{ product: AnyProduct; qty: number }>;
    daysBack: number;
    paymentMethod: 'stripe' | 'paypal';
    shipping?: {
      name: string; street: string; city: string; state: string; zip: string; country: string;
    } | null;
    paymentIntentId?: string;
  }) {
    const validItems = opts.items.filter(i => i.product != null) as Array<{ product: NonNullable<AnyProduct>; qty: number }>;
    if (validItems.length === 0) return null;

    const subtotal = validItems.reduce((sum, i) => sum + Number(i.product!.price) * i.qty, 0);
    const hasPhysical = validItems.some(i => i.product!.product_type === 'physical');
    const shippingCost = hasPhysical ? 5.99 : 0;
    const total = subtotal + shippingCost;
    const createdAt = daysAgo(opts.daysBack);

    const order = await prisma.order.create({
      data: {
        order_number: orderNum(),
        user_id: opts.userId ?? null,
        email: opts.email,
        status: opts.status,
        subtotal,
        tax: 0,
        shipping: shippingCost,
        total,
        payment_method: opts.paymentMethod,
        payment_intent_id: opts.paymentIntentId ?? null,
        paid_at: ['processing', 'completed', 'refunded'].includes(opts.status) ? createdAt : null,
        shipping_name: opts.shipping?.name ?? null,
        shipping_address: opts.shipping?.street ?? null,
        shipping_city: opts.shipping?.city ?? null,
        shipping_state: opts.shipping?.state ?? null,
        shipping_zip: opts.shipping?.zip ?? null,
        shipping_country: opts.shipping?.country ?? null,
        created_at: createdAt,
        updated_at: createdAt,
        items: {
          create: validItems.map(i => ({
            product_id: i.product!.id,
            quantity: i.qty,
            price: i.product!.price,
          })),
        },
      },
    });

    // Adjust stock for physical items
    for (const i of validItems) {
      if (i.product?.product_type === 'physical' && i.product.stock_quantity != null) {
        const newQty = Math.max(0, i.product.stock_quantity - i.qty);
        await prisma.product.update({
          where: { id: i.product.id },
          data: {
            stock_quantity: newQty,
            stock_status: newQty <= 0 ? 'out_of_stock' : 'in_stock',
          },
        });
      }
    }

    return order;
  }

  const defaultShipping = {
    name: 'John Smith',
    street: '123 Main St',
    city: 'Nashville',
    state: 'TN',
    zip: '37201',
    country: 'US',
  };

  // ── Create the faux orders ─────────────────────────────────────────────────
  const orders = [
    // 1. Completed order (member) — hat + a lesson, 60 days ago
    await createOrder({
      userId: member.id, email: member.email,
      status: 'completed',
      items: [
        { product: hat, qty: 1 },
        { product: serviceProducts[0] ?? null, qty: 1 },
      ],
      daysBack: 62, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_completed_001',
      shipping: physicalProduct ? defaultShipping : null,
    }),

    // 2. Completed order (member) — lesson only, 45 days ago
    await createOrder({
      userId: member.id, email: member.email,
      status: 'completed',
      items: [{ product: serviceProducts[1] ?? serviceProducts[0] ?? null, qty: 1 }],
      daysBack: 45, paymentMethod: 'paypal',
      paymentIntentId: 'PAYPAL-TEST-COMPLETED-002',
    }),

    // 3. Processing order (owner) — hat × 2, 30 days ago
    await createOrder({
      userId: owner.id, email: owner.email,
      status: 'processing',
      items: [{ product: hat, qty: 2 }],
      daysBack: 30, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_processing_003',
      shipping: physicalProduct ? defaultShipping : null,
    }),

    // 4. Completed order (guest) — single lesson, 25 days ago
    await createOrder({
      email: 'guest.buyer@example.com',
      status: 'completed',
      items: [{ product: serviceProducts[0] ?? null, qty: 1 }],
      daysBack: 25, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_completed_004',
    }),

    // 5. Refunded order (member) — hat, 20 days ago
    await createOrder({
      userId: member.id, email: member.email,
      status: 'refunded',
      items: [{ product: hat, qty: 1 }],
      daysBack: 20, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_refunded_005',
      shipping: physicalProduct ? defaultShipping : null,
    }),

    // 6. Cancelled order (guest) — lesson, 18 days ago
    await createOrder({
      email: 'another.guest@example.com',
      status: 'cancelled',
      items: [{ product: serviceProducts[2] ?? serviceProducts[0] ?? null, qty: 1 }],
      daysBack: 18, paymentMethod: 'paypal',
    }),

    // 7. Completed order (member) — two different lessons, 14 days ago
    await createOrder({
      userId: member.id, email: member.email,
      status: 'completed',
      items: [
        { product: serviceProducts[0] ?? null, qty: 1 },
        { product: serviceProducts[1] ?? null, qty: 1 },
      ],
      daysBack: 14, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_completed_007',
    }),

    // 8. Processing order (guest) — hat, 10 days ago
    await createOrder({
      email: 'recent.guest@example.com',
      status: 'processing',
      items: [{ product: hat, qty: 1 }],
      daysBack: 10, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_processing_008',
      shipping: physicalProduct ? defaultShipping : null,
    }),

    // 9. Completed order (owner) — lesson × 3 (bulk purchase), 7 days ago
    await createOrder({
      userId: owner.id, email: owner.email,
      status: 'completed',
      items: [{ product: serviceProducts[0] ?? null, qty: 3 }],
      daysBack: 7, paymentMethod: 'stripe',
      paymentIntentId: 'pi_test_completed_009',
    }),

    // 10. Pending order (member) — hat, just placed (2 days ago)
    await createOrder({
      userId: member.id, email: member.email,
      status: 'pending',
      items: [{ product: hat, qty: 1 }],
      daysBack: 2, paymentMethod: 'stripe',
      shipping: physicalProduct ? { ...defaultShipping, name: 'Jane Member' } : null,
    }),

    // 11. Processing order (member) — lesson, just placed (1 day ago)
    await createOrder({
      userId: member.id, email: member.email,
      status: 'processing',
      items: [{ product: serviceProducts[0] ?? null, qty: 1 }],
      daysBack: 1, paymentMethod: 'paypal',
      paymentIntentId: 'PAYPAL-TEST-PROCESSING-011',
    }),

    // 12. Pending order (guest) — hat, today
    await createOrder({
      email: 'today.buyer@example.com',
      status: 'pending',
      items: [{ product: hat, qty: 1 }],
      daysBack: 0, paymentMethod: 'stripe',
      shipping: physicalProduct ? { ...defaultShipping, name: 'Today Buyer' } : null,
    }),
  ];

  const created = orders.filter(Boolean).length;
  console.log(`[seed-orders] Created ${created} orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
