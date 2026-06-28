import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env') });

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  const profile = (process.env.SEED_PROFILE ?? 'minimal').trim();
  console.log(`Starting database seeding (SEED_PROFILE=${profile})...`);

  // ============================================
  // SEED CAPABILITIES
  // ============================================
  console.log('\n[1/3] Seeding capabilities...');

  // All current capabilities are backstage-scoped — they require the admin dashboard to exercise.
  // Customer-scoped capabilities (e.g. comment.create) would carry scope:'customer' when added.
  const capabilities = [
    // Content Management
    { name: 'article.create',      category: 'content',   scope: 'backstage', description: 'Create articles' },
    { name: 'article.edit.own',    category: 'content',   scope: 'backstage', description: 'Edit own articles' },
    { name: 'article.edit.any',    category: 'content',   scope: 'backstage', description: 'Edit any article' },
    { name: 'article.delete.own',  category: 'content',   scope: 'backstage', description: 'Delete own articles' },
    { name: 'article.delete.any',  category: 'content',   scope: 'backstage', description: 'Delete any article' },
    { name: 'article.publish',     category: 'content',   scope: 'backstage', description: 'Publish articles' },
    { name: 'page.create',         category: 'content',   scope: 'backstage', description: 'Create pages' },
    { name: 'page.edit',           category: 'content',   scope: 'backstage', description: 'Edit pages' },
    { name: 'page.delete',         category: 'content',   scope: 'backstage', description: 'Delete pages' },
    { name: 'media.upload',        category: 'content',   scope: 'backstage', description: 'Upload media files' },
    { name: 'media.delete',        category: 'content',   scope: 'backstage', description: 'Delete media files' },
    { name: 'media.manage',        category: 'content',   scope: 'backstage', description: 'Bulk-delete media files and replace file content' },

    // Ecommerce
    { name: 'product.create',      category: 'ecommerce', scope: 'backstage', description: 'Create products' },
    { name: 'product.edit.own',    category: 'ecommerce', scope: 'backstage', description: 'Edit own products' },
    { name: 'product.edit',        category: 'ecommerce', scope: 'backstage', description: 'Edit any product' },
    { name: 'product.delete.own',  category: 'ecommerce', scope: 'backstage', description: 'Delete own products' },
    { name: 'product.delete',      category: 'ecommerce', scope: 'backstage', description: 'Delete any product' },
    { name: 'order.view.all',      category: 'ecommerce', scope: 'backstage', description: 'View all orders' },
    { name: 'order.edit',          category: 'ecommerce', scope: 'backstage', description: 'Edit orders' },
    { name: 'order.refund',        category: 'ecommerce', scope: 'backstage', description: 'Process refunds' },

    // Users
    { name: 'user.create',         category: 'users',     scope: 'backstage', description: 'Create users' },
    { name: 'user.edit',           category: 'users',     scope: 'backstage', description: 'Edit users' },
    { name: 'user.delete',         category: 'users',     scope: 'backstage', description: 'Delete users' },
    { name: 'user.assign_role',    category: 'users',     scope: 'backstage', description: 'Assign user roles' },
    { name: 'user.assign_capability', category: 'users',  scope: 'backstage', description: 'Assign capabilities' },

    // Comments & Reviews
    { name: 'comment.view.all',    category: 'content',   scope: 'backstage', description: 'View all comments' },
    { name: 'comment.moderate',    category: 'content',   scope: 'backstage', description: 'Moderate comments' },
    { name: 'comment.delete',      category: 'content',   scope: 'backstage', description: 'Delete any comment' },
    { name: 'review.moderate',     category: 'ecommerce', scope: 'backstage', description: 'Moderate reviews' },

    // System — granular configure atoms (all Owner-only by default; designed to be delegatable)
    { name: 'system.configure.general',  category: 'system', scope: 'backstage', description: 'Edit General and Site Identity settings (title, tagline, homepage, favicon, logo, brand colour)' },
    { name: 'system.configure.email',    category: 'system', scope: 'backstage', description: 'Edit SMTP / email settings and send test emails' },
    { name: 'system.configure.payments', category: 'system', scope: 'backstage', description: 'Edit payment provider credentials and verify Stripe/PayPal connections' },
    { name: 'system.configure.storage',  category: 'system', scope: 'backstage', description: 'Edit file storage provider settings and run storage connection tests' },
    { name: 'system.view_audit',   category: 'system',    scope: 'backstage', description: 'View audit logs' },
    { name: 'system.export_data',  category: 'system',    scope: 'backstage', description: 'Export data (CSV)' },

    // Domain Management (Owner-only by default)
    { name: 'domain.manage',       category: 'system',    scope: 'backstage', description: 'Manage domain aliases' },

    // System — Appearance (Owner-only by default; split so it can be delegated to Admin)
    { name: 'system.appearance',   category: 'system',    scope: 'backstage', description: 'Change site visual theme (colour palette and typography)' },

    // Mul Converter (Owner-only — AI tool with external API key spend)
    { name: 'mul.convert',         category: 'system',    scope: 'backstage', description: 'Run the Mul Converter AI tool to extract palettes and page layouts from external URLs' },

    // Digital Delivery (Admin by default; separate from product editing)
    { name: 'digital.deliver',     category: 'ecommerce', scope: 'backstage', description: 'Manage digital delivery — extend/regenerate download tokens, create admin grants' },

    // Tag Management
    { name: 'tag.edit',            category: 'content',   scope: 'backstage', description: 'Create, rename, delete, and bulk-assign tags' },
    // Shop Configuration (Owner-only)
    { name: 'shop.configure',      category: 'system',    scope: 'backstage', description: 'Configure shop identity, tax, and shipping settings' },
    // Customer-facing: comment & review actions (scope:'customer' — no backstage required)
    { name: 'comment.article',     category: 'content',   scope: 'customer',  description: 'Post a comment on an article' },
    { name: 'review.article',      category: 'content',   scope: 'customer',  description: 'Post a rated review on an article' },
    { name: 'comment.product',     category: 'ecommerce', scope: 'customer',  description: 'Post a comment on a product' },
    { name: 'review.product',      category: 'ecommerce', scope: 'customer',  description: 'Post a rated review on a product (verified purchase required)' },
    { name: 'comment.edit.own',    category: 'content',   scope: 'customer',  description: 'Edit own comments and reviews' },
    { name: 'comment.delete.own',  category: 'content',   scope: 'customer',  description: 'Delete own comments and reviews' },

    // Customer-facing: checkout and purchase actions
    { name: 'checkout.guest',      category: 'ecommerce', scope: 'customer',  description: 'Complete a purchase without creating an account (guest checkout)' },
    { name: 'purchase.physical',   category: 'ecommerce', scope: 'customer',  description: 'Purchase physical products requiring a shipping address' },
    { name: 'purchase.digital',    category: 'ecommerce', scope: 'customer',  description: 'Purchase digital products and receive download access' },
    { name: 'purchase.service',    category: 'ecommerce', scope: 'customer',  description: 'Purchase service products (consultations, access passes, etc.)' },
  ];

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: { scope: cap.scope, description: cap.description },
      create: cap,
    });
  }

  console.log(`✓ Seeded ${capabilities.length} capabilities`);

  // Remove legacy system.configure atom replaced by the four granular atoms above
  const legacyCap = await prisma.capability.findUnique({ where: { name: 'system.configure' } });
  if (legacyCap) {
    await prisma.userCapability.deleteMany({ where: { capability_id: legacyCap.id } });
    await prisma.roleCapability.deleteMany({ where: { capability_id: legacyCap.id } });
    await prisma.capability.delete({ where: { id: legacyCap.id } });
    console.log('✓ Removed legacy system.configure capability');
  }

  // ============================================
  // SEED USERS  (skipped in minimal profile — setup wizard creates the Owner)
  // ============================================
  if (profile !== 'minimal') {
    console.log('\n[2/3] Seeding dev users...');

    const passwordHash = await bcrypt.hash('Admin123!@#', 12);

    const owner = await prisma.user.upsert({
      where: { email: 'owner@aecms.local' },
      update: {},
      create: {
        email: 'owner@aecms.local',
        password_hash: passwordHash,
        first_name: 'System',
        last_name: 'Owner',
        role_name: 'owner',
        email_verified: true,
        approved_at: new Date(),
      },
    });
    console.log('✓ Created Owner user:', { email: owner.email, role: owner.role_name, id: owner.id });

    const adminHash = await bcrypt.hash('Admin123!@#', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@aecms.local' },
      update: {},
      create: {
        email: 'admin@aecms.local',
        password_hash: adminHash,
        first_name: 'System',
        last_name: 'Admin',
        role_name: 'admin',
        email_verified: true,
      },
    });
    console.log('✓ Created Admin user:', { email: admin.email, role: admin.role_name, id: admin.id });

    const memberHash = await bcrypt.hash('Member123!@#', 12);
    const member = await prisma.user.upsert({
      where: { email: 'member@aecms.local' },
      update: {},
      create: {
        email: 'member@aecms.local',
        password_hash: memberHash,
        first_name: 'Test',
        last_name: 'Member',
        role_name: 'member',
        email_verified: true,
      },
    });
    console.log('✓ Created Member user:', { email: member.email, role: member.role_name, id: member.id });
  } else {
    console.log('\n[2/3] Skipping dev users (minimal profile — setup wizard creates Owner)');
  }

  // ============================================
  // SEED ROLE CAPABILITIES
  // ============================================
  console.log('\n[3/3] Seeding role capabilities...');

  // Customer-facing capabilities shared by Member and Admin
  const memberCustomerCapabilities = [
    'comment.article',
    'review.article',
    'comment.product',
    'review.product',
    'comment.edit.own',
    'comment.delete.own',
    'purchase.physical',
    'purchase.digital',
    'purchase.service',
  ];

  // Guest role: subset of customer capabilities available without an account
  const guestCapabilities = [
    'checkout.guest',
    'purchase.physical',
    'purchase.digital',
    'purchase.service',
  ];

  // Admin backstage capabilities (in addition to the customer ones above)
  const adminBackstageCapabilities = [
    'article.create',
    'article.edit.own',
    'article.edit.any',
    'article.delete.own',
    'article.delete.any',
    'article.publish',
    'page.create',
    'page.edit',
    'page.delete',
    'media.upload',
    'media.delete',
    'media.manage',
    'product.create',
    'product.edit.own',
    'product.edit',
    'product.delete.own',
    'product.delete',
    'order.view.all',
    'order.edit',
    'user.edit',
    'comment.view.all',
    'comment.moderate',
    'comment.delete',
    'review.moderate',
    'digital.deliver',
    'tag.edit',
  ];

  async function assignCapsToRole(roleName: string, capNames: string[]) {
    let count = 0;
    for (const capName of capNames) {
      const capability = await prisma.capability.findUnique({ where: { name: capName } });
      if (!capability) continue;
      const existing = await prisma.roleCapability.findFirst({
        where: { role_name: roleName, capability_id: capability.id },
      });
      if (!existing) {
        await prisma.roleCapability.create({ data: { role_name: roleName, capability_id: capability.id } });
        count++;
      }
    }
    return count;
  }

  const adminCount = await assignCapsToRole('admin', [
    ...adminBackstageCapabilities,
    ...memberCustomerCapabilities,
  ]);
  const memberCount = await assignCapsToRole('member', memberCustomerCapabilities);
  const guestCount = await assignCapsToRole('guest', guestCapabilities);

  console.log(`✓ Assigned ${adminCount} capabilities to Admin role`);
  console.log(`✓ Assigned ${memberCount} capabilities to Member role`);
  console.log(`✓ Assigned ${guestCount} capabilities to Guest role`);
  console.log('✓ Owner role has all capabilities by default');

  // ============================================
  // SEED DEFAULT SITE SETTINGS
  // ============================================
  console.log('\n[4/4] Seeding default site settings...');

  const defaultSettings = [
    // Tax defaults (all off — activate via Shop Config when legally ready)
    { key: 'tax.enabled',                  value: 'false' },
    { key: 'tax.flat_rate',                value: '' },
    { key: 'tax.default_stripe_tax_code',  value: '' },
    { key: 'general.site_title',    value: 'My Site' },
    { key: 'general.tagline',       value: '' },
    { key: 'general.timezone',      value: 'America/New_York' },
    { key: 'general.date_format',   value: 'MMM D, YYYY' },
    { key: 'general.homepage_mode', value: 'latest_articles' },
  ];

  for (const setting of defaultSettings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  console.log(`✓ Seeded ${defaultSettings.length} default settings`);

  // ============================================
  // STEP 5 — homepage page (_home_) is created by scripts/seed-sample-content.js
  // at container startup. No action needed here.
  // ============================================
  console.log('\n[5/5] Homepage page handled by seed-sample-content.js — skipping.');

  console.log('\n=== Database seeding completed ===');
  if (profile !== 'minimal') {
    console.log('\nTest credentials:');
    console.log('Owner:  owner@aecms.local  / Admin123!@#');
    console.log('Admin:  admin@aecms.local  / Admin123!@#');
    console.log('Member: member@aecms.local / Member123!@#');
  } else {
    console.log('Minimal profile: no users created. Visit /setup to create your Owner account.');
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
