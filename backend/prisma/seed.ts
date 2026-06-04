import { PrismaClient, UserRole } from '@prisma/client';
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
  console.log('Starting database seeding...');

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

    // Ecommerce
    { name: 'product.create',      category: 'ecommerce', scope: 'backstage', description: 'Create products' },
    { name: 'product.edit',        category: 'ecommerce', scope: 'backstage', description: 'Edit products' },
    { name: 'product.delete',      category: 'ecommerce', scope: 'backstage', description: 'Delete products' },
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

    // System
    { name: 'system.configure',    category: 'system',    scope: 'backstage', description: 'Configure system settings' },
    { name: 'system.view_audit',   category: 'system',    scope: 'backstage', description: 'View audit logs' },
    { name: 'system.export_data',  category: 'system',    scope: 'backstage', description: 'Export data (CSV)' },

    // Domain Management (Owner-only by default)
    { name: 'domain.manage',       category: 'system',    scope: 'backstage', description: 'Manage domain aliases' },

    // Customer-facing: comment & review actions (scope:'customer' — no backstage required)
    { name: 'comment.article',     category: 'content',   scope: 'customer',  description: 'Post a comment on an article' },
    { name: 'review.article',      category: 'content',   scope: 'customer',  description: 'Post a rated review on an article' },
    { name: 'comment.product',     category: 'ecommerce', scope: 'customer',  description: 'Post a comment on a product' },
    { name: 'review.product',      category: 'ecommerce', scope: 'customer',  description: 'Post a rated review on a product (verified purchase required)' },
  ];

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: { scope: cap.scope, description: cap.description },
      create: cap,
    });
  }

  console.log(`✓ Seeded ${capabilities.length} capabilities`);

  // ============================================
  // SEED USERS
  // ============================================
  console.log('\n[2/3] Seeding users...');

  // Hash password with same cost factor as auth service
  const passwordHash = await bcrypt.hash('Admin123!@#', 12);

  // Create Owner user
  const owner = await prisma.user.upsert({
    where: { email: 'owner@aecms.local' },
    update: {},
    create: {
      email: 'owner@aecms.local',
      password_hash: passwordHash,
      first_name: 'System',
      last_name: 'Owner',
      role: UserRole.owner,
      email_verified: true,
    },
  });

  console.log('✓ Created Owner user:', {
    email: owner.email,
    role: owner.role,
    id: owner.id,
  });

  // Create test Admin user
  const adminHash = await bcrypt.hash('Admin123!@#', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aecms.local' },
    update: {},
    create: {
      email: 'admin@aecms.local',
      password_hash: adminHash,
      first_name: 'System',
      last_name: 'Admin',
      role: UserRole.admin,
      email_verified: true,
    },
  });

  console.log('✓ Created Admin user:', {
    email: admin.email,
    role: admin.role,
    id: admin.id,
  });

  // Create test Member user
  const memberHash = await bcrypt.hash('Member123!@#', 12);
  const member = await prisma.user.upsert({
    where: { email: 'member@aecms.local' },
    update: {},
    create: {
      email: 'member@aecms.local',
      password_hash: memberHash,
      first_name: 'Test',
      last_name: 'Member',
      role: UserRole.member,
      email_verified: true,
    },
  });

  console.log('✓ Created Member user:', {
    email: member.email,
    role: member.role,
    id: member.id,
  });

  // ============================================
  // SEED ROLE CAPABILITIES
  // ============================================
  console.log('\n[3/3] Seeding role capabilities...');

  // Customer-facing capabilities shared by Member and Admin
  const customerCapabilities = [
    'comment.article',
    'review.article',
    'comment.product',
    'review.product',
  ];

  // Admin backstage capabilities (in addition to the customer ones above)
  const adminBackstageCapabilities = [
    'article.create',
    'article.edit.any',
    'article.publish',
    'media.upload',
    'media.delete',
    'product.create',
    'product.edit',
    'product.delete',
    'order.view.all',
    'order.edit',
    'user.edit',
    'comment.view.all',
    'comment.moderate',
    'comment.delete',
    'review.moderate',
  ];

  async function assignCapsToRole(role: UserRole, capNames: string[]) {
    let count = 0;
    for (const capName of capNames) {
      const capability = await prisma.capability.findUnique({ where: { name: capName } });
      if (!capability) continue;
      const existing = await prisma.roleCapability.findFirst({
        where: { role, capability_id: capability.id },
      });
      if (!existing) {
        await prisma.roleCapability.create({ data: { role, capability_id: capability.id } });
        count++;
      }
    }
    return count;
  }

  const adminCount = await assignCapsToRole(UserRole.admin, [
    ...adminBackstageCapabilities,
    ...customerCapabilities,
  ]);
  const memberCount = await assignCapsToRole(UserRole.member, customerCapabilities);

  console.log(`✓ Assigned ${adminCount} capabilities to Admin role`);
  console.log(`✓ Assigned ${memberCount} capabilities to Member role`);
  console.log('✓ Owner role has all capabilities by default');

  console.log('\n=== Database seeding completed ===');
  console.log('\nTest credentials:');
  console.log('Owner:  owner@aecms.local  / Admin123!@#');
  console.log('Admin:  admin@aecms.local  / Admin123!@#');
  console.log('Member: member@aecms.local / Member123!@#');
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
