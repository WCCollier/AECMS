# Phase 21: Multi-Owner Deployability

**Project**: AECMS  
**Phase**: 21  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 19 (first deployment successful), Phase 20 (themes stable)

---

## Goal

Separate the application from the `fantasyvreality.com` seed data, create a generic first-run experience for new owners, and establish an update strategy so the application can be iterated and deployed to multiple live sites — including your own — without disrupting existing data.

---

## The Core Problem

Right now AECMS is tightly coupled to your specific content:
- Seed scripts populate articles and products from your WordPress export
- The site name "AECMS" and branding is hardcoded
- Credentials (Stripe keys, email, etc.) are in `.env` files — a new owner must SSH into their server to configure them
- There is no way to update the running application without risking the owner's existing content and config

Phase 21 fixes all of this.

---

## Part A — Separate Application from Seed Data

### A1 — Directory structure

```
backend/prisma/seeds/
├── required/
│   ├── 01-capabilities.ts      ← Always runs; defines the 34 capabilities
│   └── 02-roles.ts             ← Always runs; creates Owner/Admin/Member/Guest roles
├── demo/
│   ├── 01-owner.ts             ← fantasyvreality.com owner account
│   ├── 02-articles.ts          ← W.C. Collier articles from WordPress export
│   ├── 03-products.ts          ← American Shooter Hat, lesson products
│   └── 04-media.ts             ← Media entries referencing GCS paths
└── generic/
    ├── 01-owner.ts             ← Placeholder; see First-Run Setup instead
    └── 02-sample-content.ts    ← Generic "Welcome" article and sample product
```

The `required/` seeds run always and are idempotent (upsert on capabilities, roles). The `demo/` and `generic/` seeds are run selectively based on a `SEED_PROFILE` env var:

```bash
SEED_PROFILE=demo    # run required + demo (your site)
SEED_PROFILE=generic # run required + generic (new deployments)
SEED_PROFILE=none    # run required only (clean slate, owner sets up via wizard)
```

### A2 — Remove hardcoded branding

Replace the hardcoded site name "AECMS" in the frontend with a setting fetched from the backend:
- New `SiteSettings` entry: `site_name`, `site_tagline`, `site_logo_url`
- Layout reads these and injects them into `<title>`, the header logo, and `<meta>` tags
- Default (before first-run setup): "My Site"
- The backstage "General Settings" panel lets the owner set these

---

## Part B — First-Run Setup Wizard

When a new instance is deployed with no Owner account in the database, the site redirects to `/setup`. This wizard runs once and is permanently disabled after completion.

### B1 — Detection

On startup, `AppModule` checks if any `User` with `role = 'owner'` exists. If not, it sets a flag `SETUP_REQUIRED = true` in Redis. The Next.js middleware redirects all routes to `/setup` when this flag is set (except `/api/setup/*` endpoints).

### B2 — Setup wizard steps

**Step 1 — Site identity**
- Site name (required)
- Site tagline (optional)
- Admin email (becomes the Owner account)
- Admin password (with strength validation)

**Step 2 — Payment credentials** (optional — can skip and configure later)
- Stripe publishable key + secret key
- PayPal client ID + client secret
- PAYMENT_TEST_MODE toggle (default: true until keys are entered)

**Step 3 — Email configuration** (optional — can skip)
- SMTP host, port, username, password, from address
- "Send test email" button

**Step 4 — Storage** (optional)
- Local filesystem (default; fine for development or small deployments)
- Google Cloud Storage (GCS): bucket name + service account JSON or Workload Identity

**Step 5 — Confirm + Launch**
- Review summary
- Click "Launch My Site" → creates Owner account, saves all settings to `SiteSettings`, clears `SETUP_REQUIRED` flag

### B3 — SiteSettings table and ISM

**Already implemented as of Phase 15.** The `SiteSettings` table and `SettingsService` (the Internal Secrets Manager / ISM) are fully built. The setup wizard will write to them using the existing `SettingsService.set()` API.

The ISM stores secrets under `_enc`-suffixed keys (e.g. `payment.stripe_secret_key_enc`), automatically encrypting them with AES-256-GCM via `LocalKeyProvider`. The `SettingsService.getEffective()` method provides DB-over-env-var fallback for all keys.

**The one secret that cannot be stored in `SiteSettings`**: the `SETTINGS_ENCRYPTION_KEY` env var (the SEK) used by the ISM to encrypt all other secrets. This is the only thing the deployer must set in the hosting environment (one env var, vs. the current 10+). Everything else flows through the backstage Admin Settings UI.

See `docs/prd/05-security.md` → "Internal Secrets Manager (ISM)" for the full design.

Phase 21 adds to the ISM:
- Key rotation tooling: a CLI script or Owner-only backstage endpoint that re-encrypts all `_enc` rows under a new SEK within a single DB transaction

---

## Part C — Backstage Settings Panel

A new backstage section: **Settings** with subsections:

### C1 — General
- Site name, tagline, logo upload
- Timezone, locale, date format
- Maintenance mode toggle (shows a maintenance page to non-admin visitors)

### C2 — Payments
- Stripe keys (live + test mode toggle)
- PayPal keys
- "Verify connection" button for each (calls the provider's health/balance endpoint)

### C3 — Email
- SMTP configuration
- "Send test email" button
- Option to switch to a provider preset: Gmail, SendGrid, Mailgun, Postmark

### C4 — Storage
- Current storage provider display
- Switch to GCS: enter bucket name; upload service account JSON or enter Workload Identity project
- "Test storage" button (writes and reads a small test file)

### C5 — Appearance
- (From Phase 20) Color palette, fonts, backgrounds

### C6 — Domain Aliases
- (From Phase 8 / Phase 17) Domain alias management

### C7 — Advanced
- Export all content (JSON / SQL dump)
- Clear Redis cache
- View application version
- Check for updates (see Part D)

---

## Part D — Update Strategy

This is the hardest part. Once AECMS is deployed for multiple owners, how do you ship updates without breaking their data or configs?

### The key tension

- **Application code** (NestJS, Next.js, React components) — can be updated freely
- **Database schema** (Prisma migrations) — must be applied carefully; additive changes are safe, destructive changes are not
- **Owner data** (their content, products, users) — must never be touched by an update
- **Owner configuration** (stored in `SiteSettings`) — defaults can change, but existing values must be preserved

### Option 1 — Docker image versioning (recommended)

Each release is a versioned Docker image tag:
```
us-central1-docker.pkg.dev/PROJECT/aecms/backend:1.2.3
us-central1-docker.pkg.dev/PROJECT/aecms/frontend:1.2.3
```

**Update process for owner**:
1. Pull new image: `docker pull .../backend:1.2.3 && docker pull .../frontend:1.2.3`
2. Run migrations: `docker run .../backend:1.2.3 npx prisma migrate deploy`
3. Restart containers with new images

**On Cloud Run**:
```bash
gcloud run deploy aecms-backend --image us-central1-docker.pkg.dev/PROJECT/aecms/backend:1.2.3
gcloud run deploy aecms-frontend --image .../frontend:1.2.3
```

**Backstage update notification**: The backend checks Artifact Registry (or a GitHub releases page) for a newer version number and shows a banner in the backstage: "Version 1.3.0 is available. [View changelog] [Update guide]". The update itself is a manual step — the owner chooses when to update.

### Option 2 — Git-based updates

Owners clone the git repo and run `git pull` to update. They run `npm install && npm run build` and restart.

**Pros**: Free; no Docker required; easy to customize.
**Cons**: Requires git and build tools on the server; merge conflicts if owner customized the code; no version pinning.

**Verdict**: Good for technical owners; bad for non-technical ones. GitHub Actions can automate the build and push step, making it workable. But it's fragile compared to Docker images.

### Option 3 — Hosted SaaS (future, post Phase 21)

You manage the infrastructure; other owners get accounts. They never touch Docker, git, or servers. Revenue model: monthly subscription.

**Verdict**: Out of scope for Phase 21. Document as a future direction.

### Recommended Update Architecture

```
Your development environment (Codespace)
    │
    │  git push main
    ▼
GitHub Actions CI
    ├── Run tests (backend + frontend)
    ├── Build Docker images
    ├── Push to Artifact Registry with semantic version tag
    └── Deploy to YOUR instance automatically (CD)
    
Other owners' instances
    ← They receive a notification in their backstage
    ← They follow the update guide to run 2 gcloud commands
    ← Migrations run automatically on container start
```

### Migration safety rules (enforced by convention)

1. All migrations must be **additive only** in the application code update. If a column is renamed, the migration keeps the old column as a deprecated alias for at least one release.
2. A `BREAKING_MIGRATION` flag in the release notes signals that the update requires a maintenance window.
3. No seed script ever runs on an existing (non-empty) database. Capabilities and roles are seeded idempotently (upsert).

---

## Part E — Generic Starter Experience

When a new owner deploys AECMS with no seed data (`SEED_PROFILE=none`), what do they see after the setup wizard?

**Proposed generic starter content** (created by the setup wizard, not the seed script):
- A "Welcome" draft article explaining how to get started
- A sample page titled "About" at `/about` with placeholder text
- The shop is empty (no sample products — products are too specific to the owner)
- The backstage shows a "Getting Started" checklist banner:
  - [ ] Upload your logo
  - [ ] Set your site description
  - [ ] Create your first article
  - [ ] Add a product to your shop
  - [ ] Configure your payment provider

This banner disappears once all items are checked off.

---

## Part F — Multi-Instance Considerations

If this CMS is eventually deployed by multiple owners:

### Namespace isolation
Each instance is a completely separate deployment (separate Cloud Run services, Cloud SQL instance, GCS buckets). There is no shared infrastructure between owners. This is the simplest and safest model.

### Licensing
The MIT license (or similar) allows anyone to deploy the app. The Docker images in Artifact Registry would need to be either:
- Made public (anyone can pull the image)
- Or owners build their own images from the public source

### Customization policy
Owners who customize the application code will diverge from the upstream. The update guide should note that customized instances may need manual merge work. This is the standard open-source tradeoff.

---

## Implementation Order

1. Part A — Separate seed data into `required/`, `demo/`, `generic/` directories; `SEED_PROFILE` env var
2. Part A — `SiteSettings` table + service (foundation for everything else)
3. Part A — Remove hardcoded "AECMS" branding; read from `SiteSettings`
4. Part B — First-run detection + `/setup` wizard (Step 1: site identity + owner account is the minimum viable version)
5. Part C — Backstage General Settings panel
6. Part C — Backstage Payment Settings panel (with "verify connection" buttons)
7. Part C — Backstage Email Settings panel (with "send test" button)
8. Part D — Docker image versioning + GitHub Actions CI/CD
9. Part D — Backstage version check + update notification
10. Part B — Complete setup wizard (Steps 2–4: payments, email, storage)
11. Part E — Generic starter content + Getting Started checklist

---

## Open Questions for Owner

1. **Target deployer**: Who is the typical other owner — technical (developer) or non-technical (content creator)? The answer determines how automated the update path needs to be.
2. **Hosting requirement**: Should AECMS officially support Docker Compose (single server) as well as Cloud Run? Docker Compose is simpler for technical owners; Cloud Run scales automatically.
3. **License**: What open-source license should the public package carry? MIT (permissive, anyone can use commercially) or GPL (derivative works must also be open-source)?
4. **Branding**: Should other owners' sites say "Powered by AECMS" somewhere (e.g., a footer link)? This is good for visibility but some owners will want to remove it.
5. **Monorepo vs published packages**: Should the backend and frontend be published as separate npm packages (installable via `npm create aecms-app`), or should owners always clone the full monorepo?
