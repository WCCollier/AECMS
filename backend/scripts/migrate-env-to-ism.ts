/**
 * One-off migration: read secrets from .env and write them into the ISM
 * (site_settings table) using the same encryption as LocalKeyProvider.
 *
 * Run from the backend directory:
 *   npx ts-node --project tsconfig.json scripts/migrate-env-to-ism.ts
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ── Encryption (mirrors LocalKeyProvider) ────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function env(name: string): string | null {
  return process.env[name] || null;
}

function required(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function upsert(key: string, value: string, isSecret: boolean, sek: string) {
  const stored = isSecret ? encrypt(value, sek) : value;
  await prisma.siteSettings.upsert({
    where: { key },
    update: { value: stored },
    create: { key, value: stored },
  });
  const display = isSecret ? '••••••••' : value;
  console.log(`  ✓  ${key} = ${display}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sek = required('SETTINGS_ENCRYPTION_KEY');
  if (sek.length !== 64) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be 64 hex characters');
  }

  console.log('\nMigrating secrets from .env → ISM (site_settings)\n');

  // ── Email / SMTP ─────────────────────────────────────────────────
  const smtpHost = env('SMTP_HOST');
  if (smtpHost) {
    await upsert('email.smtp_host',     smtpHost,                    false, sek);
    await upsert('email.smtp_port',     env('SMTP_PORT') || '587',   false, sek);
    await upsert('email.smtp_security', env('SMTP_SECURE') === 'true' ? 'ssl' : 'starttls', false, sek);
    await upsert('email.smtp_user',     env('SMTP_USER') || smtpHost, false, sek);
    if (env('SMTP_PASS')) {
      await upsert('email.smtp_pass_enc', required('SMTP_PASS'),     true,  sek);
    }
    await upsert('email.from_address',  env('SMTP_FROM') || '',      false, sek);
  } else {
    console.log('  –  SMTP_HOST not set; skipping email settings');
  }

  // ── Stripe ───────────────────────────────────────────────────────
  const stripeSecret = env('STRIPE_SECRET_KEY');
  if (stripeSecret) {
    await upsert('payment.stripe_secret_key_enc',     stripeSecret,                    true,  sek);
    await upsert('payment.stripe_publishable_key',    env('STRIPE_PUBLISHABLE_KEY') || '', false, sek);
    if (env('STRIPE_WEBHOOK_SECRET')) {
      await upsert('payment.stripe_webhook_secret_enc', required('STRIPE_WEBHOOK_SECRET'), true, sek);
    }
  } else {
    console.log('  –  STRIPE_SECRET_KEY not set; skipping Stripe settings');
  }

  // ── PayPal ───────────────────────────────────────────────────────
  const paypalClientId = env('PAYPAL_CLIENT_ID');
  if (paypalClientId) {
    await upsert('payment.paypal_client_id',          paypalClientId,                  false, sek);
    if (env('PAYPAL_CLIENT_SECRET')) {
      await upsert('payment.paypal_client_secret_enc', required('PAYPAL_CLIENT_SECRET'), true, sek);
    }
  } else {
    console.log('  –  PAYPAL_CLIENT_ID not set; skipping PayPal settings');
  }

  // ── Test mode ────────────────────────────────────────────────────
  const testMode = env('PAYMENT_TEST_MODE');
  if (testMode !== null) {
    await upsert('payment.test_mode', testMode, false, sek);
  }

  console.log('\nDone. Secrets are now encrypted at rest in site_settings.\n');
  console.log('You can now remove the following lines from backend/.env');
  console.log('(or keep them as env-var fallbacks — ISM takes precedence):\n');
  const removable = [
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET',
    'SMTP_PASS',
  ];
  removable.forEach(k => console.log(`  # ${k}`));
  console.log();
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
