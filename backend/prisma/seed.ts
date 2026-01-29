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

  const capabilities = [
    // Content Management
    {
      name: 'article.create',
      category: 'content',
      description: 'Create articles',
    },
    {
      name: 'article.edit.own',
      category: 'content',
      description: 'Edit own articles',
    },
    {
      name: 'article.edit.any',
      category: 'content',
      description: 'Edit any article',
    },
    {
      name: 'article.delete.own',
      category: 'content',
      description: 'Delete own articles',
    },
    {
      name: 'article.delete.any',
      category: 'content',
      description: 'Delete any article',
    },
    {
      name: 'article.publish',
      category: 'content',
      description: 'Publish articles',
    },
    {
      name: 'page.create',
      category: 'content',
      description: 'Create pages',
    },
    { name: 'page.edit', category: 'content', description: 'Edit pages' },
    { name: 'page.delete', category: 'content', description: 'Delete pages' },
    {
      name: 'media.upload',
      category: 'content',
      description: 'Upload media files',
    },
    {
      name: 'media.delete',
      category: 'content',
      description: 'Delete media files',
    },

    // Ecommerce
    {
      name: 'product.create',
      category: 'ecommerce',
      description: 'Create products',
    },
    {
      name: 'product.edit',
      category: 'ecommerce',
      description: 'Edit products',
    },
    {
      name: 'product.delete',
      category: 'ecommerce',
      description: 'Delete products',
    },
    {
      name: 'order.view.all',
      category: 'ecommerce',
      description: 'View all orders',
    },
    { name: 'order.edit', category: 'ecommerce', description: 'Edit orders' },
    {
      name: 'order.refund',
      category: 'ecommerce',
      description: 'Process refunds',
    },

    // Users
    { name: 'user.create', category: 'users', description: 'Create users' },
    { name: 'user.edit', category: 'users', description: 'Edit users' },
    { name: 'user.delete', category: 'users', description: 'Delete users' },
    {
      name: 'user.assign_role',
      category: 'users',
      description: 'Assign user roles',
    },
    {
      name: 'user.assign_capability',
      category: 'users',
      description: 'Assign capabilities',
    },

    // Comments & Reviews
    {
      name: 'comment.moderate',
      category: 'content',
      description: 'Moderate comments',
    },
    {
      name: 'review.moderate',
      category: 'ecommerce',
      description: 'Moderate reviews',
    },

    // System
    {
      name: 'system.configure',
      category: 'system',
      description: 'Configure system settings',
    },
    {
      name: 'system.view_audit',
      category: 'system',
      description: 'View audit logs',
    },
    {
      name: 'system.export_data',
      category: 'system',
      description: 'Export data (CSV)',
    },
  ];

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: {},
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

  // Admin default capabilities
  const adminCapabilities = [
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
    'comment.moderate',
    'review.moderate',
  ];

  let assignedCount = 0;
  for (const capName of adminCapabilities) {
    const capability = await prisma.capability.findUnique({
      where: { name: capName },
    });

    if (capability) {
      // Check if already exists
      const existing = await prisma.roleCapability.findFirst({
        where: {
          role: UserRole.admin,
          capability_id: capability.id,
        },
      });

      if (!existing) {
        await prisma.roleCapability.create({
          data: {
            role: UserRole.admin,
            capability_id: capability.id,
          },
        });
        assignedCount++;
      }
    }
  }

  console.log(`✓ Assigned ${assignedCount} capabilities to Admin role`);
  console.log('✓ Owner role has all capabilities by default');
  console.log('✓ Member role has no default capabilities');

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
