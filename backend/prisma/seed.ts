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
