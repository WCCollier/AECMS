import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { KeyProvider } from './key-provider.interface';
import { KEY_PROVIDER } from './key-provider.interface';

const REDACTED = '••••••••';

const isEncryptedKey = (key: string): boolean => key.endsWith('_enc');

// Maps setting keys to corresponding env var names (fallback when DB is empty)
const ENV_KEY_MAP: Record<string, string> = {
  'general.site_title':                  'SITE_TITLE',
  'general.tagline':                     'SITE_TAGLINE',
  'general.timezone':                    'SITE_TIMEZONE',
  'general.date_format':                 'SITE_DATE_FORMAT',
  'general.homepage_mode':               'HOMEPAGE_MODE',
  'general.homepage_page_id':            'HOMEPAGE_PAGE_ID',
  'identity.logo_url':                   'IDENTITY_LOGO_URL',
  'identity.favicon_url':                'IDENTITY_FAVICON_URL',
  'identity.brand_color':                'IDENTITY_BRAND_COLOR',
  'email.smtp_host':                     'SMTP_HOST',
  'email.smtp_port':                     'SMTP_PORT',
  'email.smtp_security':                 'SMTP_SECURITY',
  'email.smtp_user':                     'SMTP_USER',
  'email.smtp_pass_enc':                 'SMTP_PASS',
  'email.from_address':                  'SMTP_FROM',
  'email.from_name':                     'EMAIL_FROM_NAME',
  'email.kindle_from':                   'KINDLE_FROM_ADDRESS',
  'payment.stripe_publishable_key':      'STRIPE_PUBLISHABLE_KEY',
  'payment.stripe_secret_key_enc':       'STRIPE_SECRET_KEY',
  'payment.stripe_webhook_secret_enc':   'STRIPE_WEBHOOK_SECRET',
  'payment.paypal_mode':                 'PAYPAL_MODE',
  'payment.paypal_client_id':            'PAYPAL_CLIENT_ID',
  'payment.paypal_client_secret_enc':    'PAYPAL_CLIENT_SECRET',
  // ESM — External Storage Manager
  'storage.provider_type':              'STORAGE_PROVIDER_TYPE',
  'storage.local_path':                 'STORAGE_PATH',
  'storage.gcs_project_id':            'GCS_PROJECT_ID',
  'storage.gcs_bucket_media':          'GCS_BUCKET_MEDIA',
  'storage.gcs_bucket_digital':        'GCS_BUCKET_DIGITAL',
  'storage.gcs_endpoint':              'GCS_ENDPOINT',
  'storage.gcs_credentials_json_enc':  'GCS_CREDENTIALS_JSON',
  'storage.s3_region':                 'S3_REGION',
  'storage.s3_endpoint':               'S3_ENDPOINT',
  'storage.s3_bucket_media':           'S3_BUCKET_MEDIA',
  'storage.s3_bucket_digital':         'S3_BUCKET_DIGITAL',
  'storage.s3_access_key_id':          'S3_ACCESS_KEY_ID',
  'storage.s3_secret_access_key_enc':  'S3_SECRET_ACCESS_KEY',
  'storage.cdn_base_url':              'STORAGE_CDN_BASE_URL',
  // SEO
  'seo.site_name':                     'SITE_NAME',
  'seo.canonical_domain':              'APP_URL',
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(KEY_PROVIDER) private keyProvider: KeyProvider,
  ) {}

  /** Returns all settings as key→value, with _enc values redacted to '••••••••'.
   *  Keys not in DB are filled from ENV_KEY_MAP fallbacks so the UI always shows active config. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSettings.findMany();
    const dbKeySet = new Set(rows.map((r) => r.key));
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = isEncryptedKey(row.key) ? REDACTED : row.value;
    }
    for (const [settingKey, envKey] of Object.entries(ENV_KEY_MAP)) {
      if (!dbKeySet.has(settingKey)) {
        const envValue = process.env[envKey];
        if (envValue) {
          result[settingKey] = isEncryptedKey(settingKey) ? REDACTED : envValue;
        }
      }
    }
    return result;
  }

  /** Returns setting keys whose active value comes from an env var, not the DB. */
  async getEnvSourcedKeys(): Promise<string[]> {
    const rows = await this.prisma.siteSettings.findMany({ select: { key: true } });
    const dbKeySet = new Set(rows.map((r) => r.key));
    return Object.entries(ENV_KEY_MAP)
      .filter(([settingKey, envKey]) => !dbKeySet.has(settingKey) && Boolean(process.env[envKey]))
      .map(([settingKey]) => settingKey);
  }

  /** Returns the decrypted plaintext value for a single key, or null if not set */
  async get(key: string): Promise<string | null> {
    const row = await this.prisma.siteSettings.findUnique({ where: { key } });
    if (!row || !row.value) return null;
    if (isEncryptedKey(key)) {
      try {
        return await this.keyProvider.decrypt(row.value);
      } catch {
        this.logger.warn(`Failed to decrypt setting: ${key}`);
        return null;
      }
    }
    return row.value;
  }

  /**
   * Returns the effective value: DB (decrypted) takes precedence over env fallback.
   * For encrypted keys, falls back to the raw env var value (stored plaintext in env).
   */
  async getEffective(key: string): Promise<string> {
    const dbValue = await this.get(key);
    if (dbValue !== null && dbValue !== '') return dbValue;
    const envKey = ENV_KEY_MAP[key];
    return (envKey ? process.env[envKey] : undefined) ?? '';
  }

  /**
   * Upserts one or more settings keys.
   * - Encrypted keys: encrypts before write; '••••••••' or '' preserves existing.
   * - All changes logged to AuditLog.
   */
  async set(updates: Record<string, string>, userId: string): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      const isEnc = isEncryptedKey(key);

      // Skip placeholder / empty values for encrypted fields
      if (isEnc && (!value || value === REDACTED)) {
        continue;
      }

      const existing = await this.prisma.siteSettings.findUnique({ where: { key } });
      const oldDisplayValue = existing
        ? (isEnc ? REDACTED : existing.value)
        : null;

      let storedValue = value;
      if (isEnc) {
        storedValue = await this.keyProvider.encrypt(value);
      }

      await this.prisma.siteSettings.upsert({
        where: { key },
        create: { key, value: storedValue, updated_by: userId },
        update: { value: storedValue, updated_by: userId },
      });

      await this.auditLogService.log({
        event_type: 'settings.changed',
        user_id: userId,
        resource_type: 'settings',
        resource_id: key,
        changes: {
          before: { [key]: oldDisplayValue ?? '' },
          after: { [key]: isEnc ? REDACTED : value },
        },
      });
    }
  }
}
