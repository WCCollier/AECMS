# FR-010: PII Encryption at Rest

**Status:** `accepted`
**Requested:** 2026-06-26
**Deployed:** —
**Size:** `medium`
**Paired with:** Phase 24 (address book built encrypted from day one; `EncryptionService` extracted as shared infrastructure)

---

## Synopsis

Several fields in the database that contain personally identifiable information — user names, addresses, IP addresses, OAuth tokens, and TOTP secrets — are stored in plaintext. A database dump would expose all of it unredacted. The ISM already has a correct AES-256-GCM encryption implementation (`LocalKeyProvider` / `GcpKeyProvider`), but it is only wired to the `SiteSettings` table. This FR extracts that encryption capability into a shared `EncryptionService`, encrypts new PII fields in Phase 24 from the start, and backfills encryption onto the existing plaintext PII fields already in the database.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Identified during Phase 24 design session; paired with Phase 24 implementation |

---

## Discussion

### Request context

During Phase 24 design, a review of the database schema found that user-facing PII is stored in plaintext despite the existence of a working AES-256-GCM encryption stack (built for the ISM in Phase 15). The gap was not intentional — encryption was added only where the ISM required it and was never extended to user data tables. Two fields (`totp_secret` and the OAuth `access_token`/`refresh_token`) even carry schema comments claiming they are encrypted, when in fact no encrypt/decrypt call exists anywhere in the code that reads or writes them. That is a documentation bug that also indicates the original encryption intention was never followed through.

### What is currently at risk

| Field(s) | Table | Sensitivity |
|----------|-------|-------------|
| `first_name`, `last_name` | `users` | Medium — name alone is not actionable but combined with email enables phishing |
| `last_login_ip` | `users` | Low-medium — reveals rough location history |
| `shipping_street`, `shipping_city`, `shipping_postal_code` | `users` (legacy flat columns) | High — home address |
| `totp_secret` | `users` | High — enables 2FA bypass if combined with password |
| `access_token`, `refresh_token` | `oauth_accounts` | High — live OAuth tokens can be replayed |
| `customer_name`, `shipping_name`, `shipping_address`, `shipping_city`, `shipping_zip` | `orders` | High — full name + home address per order |
| `ip_address` | `refresh_tokens` | Low — session IP history |

Fields that cannot be encrypted (used in WHERE clauses or unique indexes):
- `users.email` — primary login key, unique constraint; encryption would break authentication
- `users.shipping_state`, `users.shipping_country` — used in tax queries; kept plaintext (low sensitivity individually)
- `user_addresses.state`, `user_addresses.country` — same (Phase 24 new model)

### Options considered

| Option | Trade-off |
|--------|-----------|
| Application-layer column encryption (chosen) | Encrypt/decrypt in service layer before Prisma reads/writes; existing `KeyProvider` reused; no DB changes required beyond backfill |
| Transparent DB encryption (pgcrypto / TDE) | Encrypts at the storage level but the DB process itself decrypts on read — doesn't protect against a logical dump (`pg_dump`) which is the realistic attack vector |
| Row-level security + separate key per user | Maximum isolation but high complexity and performance cost; overkill for a single-owner low-traffic CMS |

### Decisions

- **Reuse the existing `KeyProvider` / AES-256-GCM stack.** It is correct and already battle-tested for ISM. No new crypto primitives.
- **Extract an `EncryptionService`** that wraps `KeyProvider` and is importable by any NestJS module. `SettingsModule` continues to use its own internal provider; `EncryptionModule` shares the same underlying key.
- **`_enc` suffix convention** (already established for ISM keys) marks encrypted columns in the schema. Encrypted columns are never returned raw to clients — they are decrypted in the service layer before inclusion in response DTOs.
- **`state` and `country` stay plaintext** on all address models. They are needed for tax queries and are low-sensitivity on their own — a state code does not identify a person.
- **Phase 24 new fields are encrypted from day one.** `UserAddress` free-text fields (`full_name_enc`, `street_enc`, `city_enc`, `postal_code_enc`) are encrypted at write and never stored plaintext. No backfill needed for these.
- **Backfill for existing fields is a one-time migration** that reads each row, encrypts in-place, and renames the column. This must run during a maintenance window (or as a blue/green deploy) because the old column name and new encrypted column name cannot coexist transparently in a live deploy.
- **Fix the false "Encrypted" comments** on `totp_secret` and `oauth_accounts` fields as part of this work — either actually encrypt them or remove the misleading comments.

### Out of scope

- Per-user encryption keys (key-per-row) — adds key management complexity with marginal benefit at this scale
- Encrypting `email` — breaks authentication; pseudonymization is a separate topic
- Encrypting structured/queryable fields (`state`, `country`, `role_name`) — breaks the queries that use them
- GDPR right-to-erasure mechanics — soft-delete (`deleted_at`) already handles this; encryption does not change the erasure story

---

## Design & Implementation Guide

### Build order

→ See **[PHASE_24_FR010_BUILD_ORDER.md](../phases/PHASE_24_FR010_BUILD_ORDER.md)** for the authoritative step-by-step sequence covering this FR and Phase 24 together, including which steps require two deploy passes, which require the Neon direct URL, and which require owner action outside the Codespaces terminal.

### Overview

1. Create `EncryptionModule` / `EncryptionService` — shared encrypt/decrypt backed by the existing `KeyProvider`
2. Phase 24 `UserAddress` model uses encrypted columns from day one (no backfill)
3. Backfill migrations for existing plaintext PII fields (one migration per table, run during a maintenance window)
4. Fix false "Encrypted" comments — actually encrypt `totp_secret` and OAuth tokens, or document the decision not to

### Part 1 — EncryptionService (prerequisite for Phase 24)

```
backend/src/encryption/encryption.service.ts   — wraps KeyProvider
backend/src/encryption/encryption.module.ts    — exports EncryptionService; provides KEY_PROVIDER
```

`EncryptionModule` must be imported by any module that stores encrypted PII. It does not re-export `SettingsModule` and has no circular dependency risk.

```typescript
// encryption.service.ts
@Injectable()
export class EncryptionService {
  constructor(@Inject(KEY_PROVIDER) private kp: KeyProvider) {}
  encrypt(value: string | null | undefined): Promise<string | null> {
    if (!value) return Promise.resolve(null);
    return this.kp.encrypt(value);
  }
  decrypt(value: string | null | undefined): Promise<string | null> {
    if (!value) return Promise.resolve(null);
    return this.kp.decrypt(value);
  }
}
```

### Part 2 — Phase 24 UserAddress (encrypted from day one)

Covered in Phase 24 Part H. The `UserAddress` model uses `_enc`-suffixed columns for all free-text PII. `AddressesService` calls `EncryptionService.encrypt()` on write and `decrypt()` on read. No backfill needed.

### Part 3 — Backfill existing plaintext PII

Each backfill is a two-deploy sequence per the Live Deployment Policy:

**Deploy 1**: Add new `_enc` column (nullable); write code that writes to BOTH old column (plaintext) and new column (encrypted). Run backfill script to encrypt all existing rows into the new column.

**Deploy 2**: Remove old plaintext column; code reads only from `_enc` column.

#### 3a — `users` table

Fields to encrypt: `first_name` → `first_name_enc`, `last_name` → `last_name_enc`, `shipping_street` → `shipping_street_enc`, `shipping_city` → `shipping_city_enc`, `shipping_postal_code` → `shipping_postal_code_enc`.

Note: `shipping_*` columns on `users` are legacy — Phase 24 migrates to the new `UserAddress` model. These columns should be deprecated (stop writing to them) in Phase 24 and dropped in this FR's Deploy 2. The backfill migration is therefore unnecessary for the `shipping_*` columns — just drop them after Phase 24 completes the migration to `UserAddress`.

Fields to hash (not encrypt — one-way is sufficient): `last_login_ip` → store SHA-256 hash; IP addresses need no decryption, they are only used for audit display purposes.

#### 3b — `users.totp_secret`

The schema comment says "Encrypted" but no encrypt/decrypt call exists in `auth.service.ts`. Fix:

- Add `EncryptionModule` import to `AuthModule`
- In `AuthService.setupTotp()`: call `encryptionService.encrypt(secret)` before writing to `totp_secret`
- In `AuthService.verifyTotp()` and `AuthService.verifyTotpSetup()`: call `encryptionService.decrypt(user.totp_secret)` before passing to `speakeasy.totp.verify()`
- Backfill: encrypt all existing `totp_secret` values in place
- Rename column to `totp_secret_enc` in Deploy 2

#### 3c — `oauth_accounts` table

Fields: `access_token` → `access_token_enc`, `refresh_token` → `refresh_token_enc`. Same two-deploy pattern. The OAuth service (wherever it reads/writes these) must call `encryptionService.encrypt()` / `decrypt()` after this change.

#### 3d — `orders` table

Fields: `customer_name` → `customer_name_enc`, `shipping_name` → `shipping_name_enc`, `shipping_address` → `shipping_address_enc`, `shipping_city` → `shipping_city_enc`, `shipping_zip` → `shipping_zip_enc`.

Keep `shipping_state` and `shipping_country` plaintext (used in tax reporting aggregations).

Note: `orders` may have significant row counts over time. The backfill script should process in batches (e.g. 500 rows at a time) to avoid long-running transactions.

#### 3e — `refresh_tokens.ip_address`

Hash rather than encrypt — store `SHA-256(ip_address)`. Display in audit logs as `[hashed]` or omit. No decryption needed; IP is only useful for anomaly detection, which a hash still supports (compare hash of incoming IP to stored hash).

### Backfill script pattern

```typescript
// backend/scripts/encrypt-pii-backfill.ts
// Process one table at a time; run inside a transaction per batch
const BATCH = 500;
let cursor = '';
do {
  const rows = await prisma.user.findMany({
    where: { id: { gt: cursor }, first_name_enc: null, first_name: { not: null } },
    take: BATCH, orderBy: { id: 'asc' },
  });
  for (const row of rows) {
    await prisma.user.update({
      where: { id: row.id },
      data: { first_name_enc: await enc.encrypt(row.first_name!) },
    });
  }
  cursor = rows.at(-1)?.id ?? '';
} while (cursor);
```

### API contract

No new endpoints. All changes are internal to the service layer. Encrypted values are transparently decrypted before reaching response DTOs — callers see no difference.

### Key implementation notes

- The `KEY_PROVIDER` injection token must be provided in `EncryptionModule` independently of `SettingsModule`. Both modules read from the same env var / GCP secret but maintain separate provider instances — no circular dependency.
- If `SETTINGS_ENCRYPTION_KEY` is not set (local dev without a `.env`), `LocalKeyProvider` throws at startup. That is correct behavior — encryption must be configured before data is written.
- Encrypting a field that is also used as a Prisma `@unique` constraint is not possible without dropping the constraint. Verify no encrypted fields carry `@unique` before proceeding.
- The backfill script must be idempotent: skip rows where the `_enc` column is already populated.
- During the Deploy 1 window (both columns exist), reads should prefer `_enc` if non-null, falling back to the plaintext column. This ensures rows backfilled after Deploy 1 but before Deploy 2 are read correctly.

---

## Completion Report

> _Fill in after implementation._

---

## Testing Guide

> _Written alongside implementation._

### Prerequisites
- Local dev with `SETTINGS_ENCRYPTION_KEY` set in `backend/.env`
- At least one user with a saved address, active TOTP, and a completed order in the DB

### Test scenarios

**A. New UserAddress written and read back**
1. Log in, add a shipping address in /account.
2. Inspect the `user_addresses` table directly in the DB.
3. Confirm `street_enc`, `city_enc`, `postal_code_enc`, `full_name_enc` are base64 ciphertexts (not plaintext).
4. Load /account again — confirm the address displays correctly (service decrypted it).

**B. TOTP still works after encryption**
1. Enable 2FA on an account.
2. Confirm `totp_secret_enc` in the DB is a ciphertext, not a base32 string.
3. Log out, log back in — confirm TOTP codes are accepted correctly.

**C. Backfill script idempotency**
1. Run the backfill script twice.
2. Confirm row counts match and no duplicate encryption occurred.

**D. Key rotation safety**
1. Confirm that changing `SETTINGS_ENCRYPTION_KEY` to a new value causes decryption of old rows to fail with a clear error (not silently return garbage).

### Acceptance criteria

- [ ] `EncryptionService` extracted and importable from any module
- [ ] All `UserAddress` free-text fields stored as ciphertexts in DB
- [ ] `totp_secret` actually encrypted (false comment resolved)
- [ ] OAuth `access_token` / `refresh_token` actually encrypted
- [ ] `orders` shipping PII encrypted; `shipping_state` / `shipping_country` remain plaintext
- [ ] `users` name fields encrypted; `email` remains plaintext
- [ ] IP fields hashed (not encrypted); existing values migrated
- [ ] All backfill scripts are idempotent and batch-safe
- [ ] No plaintext PII visible in a `pg_dump` of the live DB after Deploy 2
- [ ] All existing tests pass; no decrypt errors in normal operation
