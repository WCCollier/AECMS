'use strict';
/**
 * Minimal capability + role + settings seed for production containers.
 * Plain CommonJS — no ts-node, no TypeScript. Safe to run with bare `node`.
 * All operations are idempotent (upsert / findFirst-then-create).
 *
 * Called by docker-start.sh when the capabilities table is empty (fresh DB).
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
  // System — granular configure atoms
  { name: 'system.configure.general',  category: 'system', scope: 'backstage', description: 'Edit General and Site Identity settings' },
  { name: 'system.configure.email',    category: 'system', scope: 'backstage', description: 'Edit SMTP / email settings and send test emails' },
  { name: 'system.configure.payments', category: 'system', scope: 'backstage', description: 'Edit payment provider credentials and verify connections' },
  { name: 'system.configure.storage',  category: 'system', scope: 'backstage', description: 'Edit file storage provider settings and run storage tests' },
  { name: 'system.view_audit',   category: 'system',    scope: 'backstage', description: 'View audit logs' },
  { name: 'system.export_data',  category: 'system',    scope: 'backstage', description: 'Export data (CSV)' },
  // Domain Management
  { name: 'domain.manage',       category: 'system',    scope: 'backstage', description: 'Manage domain aliases' },
  // Appearance
  { name: 'system.appearance',   category: 'system',    scope: 'backstage', description: 'Change site visual theme' },
  // Digital Delivery
  { name: 'digital.deliver',     category: 'ecommerce', scope: 'backstage', description: 'Manage digital delivery — extend/regenerate download tokens' },
  // Mul Converter
  { name: 'mul.convert',         category: 'system',    scope: 'backstage', description: 'Run the Mul Converter AI tool to extract palettes and page layouts from external URLs' },
  // Role Management
  { name: 'role.manage',         category: 'system',    scope: 'backstage', description: 'Create, edit, and delete roles and their capability assignments' },
  // Registration Controls
  { name: 'registration.configure', category: 'system', scope: 'backstage', description: 'Configure registration policy: default role and approval requirement' },
  { name: 'registration.approve',   category: 'users',  scope: 'backstage', description: 'Review and approve or reject pending user registrations' },
  // Account Deletion
  { name: 'account.delete.limited', category: 'users',  scope: 'backstage', description: 'Delete accounts that do not themselves hold any account.delete capability' },
  { name: 'account.delete.any',     category: 'users',  scope: 'backstage', description: 'Delete any account except your own (including other owners)' },
  // Tag Management
  { name: 'tag.edit',         category: 'content',       scope: 'backstage', description: 'Create, rename, delete, and bulk-assign tags' },
  // Subscriptions & Broadcasts
  { name: 'broadcast.send',   category: 'communication', scope: 'backstage', description: 'Send a news/alert broadcast email to all subscribed members' },
  { name: 'broadcast.config', category: 'communication', scope: 'backstage', description: 'Configure default subscription preferences for new sign-ups' },
  // Customer-facing capabilities
  { name: 'comment.article',     category: 'content',   scope: 'customer',  description: 'Post a comment on an article' },
  { name: 'review.article',      category: 'content',   scope: 'customer',  description: 'Post a rated review on an article' },
  { name: 'comment.product',     category: 'ecommerce', scope: 'customer',  description: 'Post a comment on a product' },
  { name: 'review.product',      category: 'ecommerce', scope: 'customer',  description: 'Post a rated review on a product' },
  { name: 'comment.edit.own',    category: 'content',   scope: 'customer',  description: 'Edit own comments and reviews' },
  { name: 'comment.delete.own',  category: 'content',   scope: 'customer',  description: 'Delete own comments and reviews' },
  { name: 'checkout.guest',      category: 'ecommerce', scope: 'customer',  description: 'Complete a purchase without creating an account' },
  { name: 'purchase.physical',   category: 'ecommerce', scope: 'customer',  description: 'Purchase physical products' },
  { name: 'purchase.digital',    category: 'ecommerce', scope: 'customer',  description: 'Purchase digital products' },
  { name: 'purchase.service',    category: 'ecommerce', scope: 'customer',  description: 'Purchase service products' },
];

const memberCustomerCaps = [
  'comment.article', 'review.article', 'comment.product', 'review.product',
  'comment.edit.own', 'comment.delete.own',
  'purchase.physical', 'purchase.digital', 'purchase.service',
];

const guestCaps = [
  'checkout.guest', 'purchase.physical', 'purchase.digital', 'purchase.service',
];

const adminBackstageCaps = [
  'article.create', 'article.edit.own', 'article.edit.any', 'article.delete.own',
  'article.delete.any', 'article.publish', 'page.create', 'page.edit', 'page.delete',
  'media.upload', 'media.delete', 'product.create', 'product.edit.own', 'product.edit',
  'product.delete.own', 'product.delete', 'order.view.all', 'order.edit',
  'user.edit', 'comment.view.all', 'comment.moderate', 'comment.delete',
  'review.moderate', 'digital.deliver', 'registration.approve', 'account.delete.limited',
  'tag.edit',
];

const defaultSettings = [
  { key: 'general.site_title',    value: 'My Site' },
  { key: 'general.tagline',       value: '' },
  { key: 'general.timezone',      value: 'America/New_York' },
  { key: 'general.date_format',   value: 'MMM D, YYYY' },
  { key: 'general.homepage_mode', value: 'latest_articles' },
  { key: 'general.default_role',                   value: 'member' },
  { key: 'general.require_registration_approval',  value: 'false' },
  { key: 'subscription.default_new_articles',      value: 'false' },
  { key: 'subscription.default_new_products',      value: 'false' },
  { key: 'subscription.default_news_alerts',       value: 'false' },
];

async function assignCapsToRole(role, capNames) {
  let count = 0;
  for (const capName of capNames) {
    const cap = await prisma.capability.findUnique({ where: { name: capName } });
    if (!cap) continue;
    const existing = await prisma.roleCapability.findFirst({
      where: { role_name: role, capability_id: cap.id },
    });
    if (!existing) {
      await prisma.roleCapability.create({ data: { role_name: role, capability_id: cap.id } });
      count++;
    }
  }
  return count;
}

async function main() {
  console.log('[seed-minimal] Seeding capabilities...');
  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: { scope: cap.scope, description: cap.description },
      create: cap,
    });
  }
  console.log(`[seed-minimal] ✓ ${capabilities.length} capabilities upserted`);

  // Remove legacy system.configure if present
  const legacy = await prisma.capability.findUnique({ where: { name: 'system.configure' } });
  if (legacy) {
    await prisma.userCapability.deleteMany({ where: { capability_id: legacy.id } });
    await prisma.roleCapability.deleteMany({ where: { capability_id: legacy.id } });
    await prisma.capability.delete({ where: { id: legacy.id } });
    console.log('[seed-minimal] ✓ Removed legacy system.configure capability');
  }

  console.log('[seed-minimal] Seeding roles...');
  const roleDefs = [
    { name: 'owner',  label: 'Owner',  protection: 'full' },
    { name: 'admin',  label: 'Admin',  protection: 'none' },
    { name: 'member', label: 'Member', protection: 'none' },
    { name: 'guest',  label: 'Guest',  protection: 'constrained' },
  ];
  for (const r of roleDefs) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { label: r.label, protection: r.protection },
      create: r,
    });
  }
  console.log('[seed-minimal] ✓ roles upserted');

  console.log('[seed-minimal] Seeding role capabilities...');
  const adminCount  = await assignCapsToRole('admin',  [...adminBackstageCaps, ...memberCustomerCaps]);
  const memberCount = await assignCapsToRole('member', memberCustomerCaps);
  const guestCount  = await assignCapsToRole('guest',  guestCaps);
  console.log(`[seed-minimal] ✓ admin:${adminCount} member:${memberCount} guest:${guestCount} caps assigned`);

  console.log('[seed-minimal] Seeding default site settings...');
  for (const s of defaultSettings) {
    await prisma.siteSettings.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }
  console.log(`[seed-minimal] ✓ ${defaultSettings.length} default settings upserted`);

  console.log('[seed-minimal] Done.');
}

main()
  .catch((e) => { console.error('[seed-minimal] ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
