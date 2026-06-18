# Phase 21: Deployability + First Live Deployment

**Project**: AECMS  
**Phase**: 21  
**Status**: 🚧 IN PROGRESS (2026-06-18)  
**Merged with**: Phase 19 (First Deployment — see `PHASE_19_PLAN.md` for the redirect note)

---

## Decision

Phases 19 and 21 are merged. A standalone "first deployment" with no deployability guarantees is a throwaway exercise. Instead: build the thing properly — setup wizard, seed profiles, update strategy, CI/CD — and then use those systems to deploy `fantasyvreality.com` as the live integration test. The FvR deployment *is* the proof that this works for any owner.

---

## Goal

Ship a genuinely deployable version of AECMS. Any reasonably technical person should be able to:

1. Clone the repo
2. Set one env var (`SETTINGS_ENCRYPTION_KEY`)
3. Deploy to Cloud Run (or Docker Compose)
4. Hit `/setup` to create their Owner account and configure the site
5. Be running a functional CMS

Then use that exact process to stand up `fantasyvreality.com`, backfilling it with the FvR seed content as the final step.

---

## What Is Already Done

These Phase 19/21 concerns are complete and do not need implementation:

| Concern | Implementation | Phase |
|---|---|---|
| ISM (secrets storage/encryption) | `SiteSettings` DB, `SettingsService`, `LocalKeyProvider` (AES-256-GCM) | 15 |
| ISM consumer wiring | SMTP, Stripe, PayPal read from ISM lazily | session 2026-06-18 |
| Admin Settings UI | General, Email, Payment, Storage tabs; split PATCH endpoints | 15 + session |
| ESM (cloud storage abstraction) | `GcsStorageProvider`, `S3StorageProvider`, `StorageModule` factory | session 2026-06-18 |
| Theme / appearance | 8 palettes, 5 font pairings, CSS vars, Appearance tab | 20 |
| Domain aliases | Alternate domain capture (301 redirect), `alias_type` field | 8 / 17 |
| FvR seed content | `seed-fvr.ts` reads `fvr-content.xml`; 73 articles + 15 products | session 2026-06-18 |
| Basic DEPLOYMENT.md | Docker Compose deployment guide | session 2026-06-18 |

---

## What This Phase Builds

### Part A — Seed Profile System

**Goal**: Separate the application from WCC-specific content so any owner can deploy a clean instance.

The current `seed-all.sh` runs `seed.ts` (users + caps) → `seed-fvr.ts` (FvR content) → `seed-orders.ts` (test data). For a generic deployment, only `seed.ts` should run; FvR content must be opt-in.

**Implementation**:

1. Add `SEED_PROFILE` env var: `minimal` | `fvr` | `demo` (default: `minimal`)
2. Restructure seed directory:
   ```
   backend/prisma/
   ├── seed.ts               ← always runs: capabilities, roles, default site settings
   ├── seed-fvr.ts           ← fvr profile: reads fvr-content.xml
   ├── seed-orders.ts        ← fvr profile only (test orders)
   └── seed-all.sh           ← reads SEED_PROFILE and runs the right scripts
   ```
3. Update `seed-all.sh`:
   ```bash
   PROFILE=${SEED_PROFILE:-minimal}
   npx ts-node prisma/seed.ts
   if [ "$PROFILE" = "fvr" ] || [ "$PROFILE" = "demo" ]; then
     npx ts-node prisma/seed-fvr.ts
     npx ts-node prisma/seed-orders.ts
   fi
   ```
4. `seed.ts` does NOT create the Owner user in minimal mode — the setup wizard does that on first run.

**Note**: `FvR_Deployment/` is gitignored; `fvr-content.xml` lives there and is not shipped in the generic codebase. The `seed-fvr.ts` script is in git but is a no-op if the XML is absent.

---

### Part B — First-Run Setup Wizard

**Goal**: A new deployment with no Owner account automatically redirects to `/setup` where the deployer creates their owner account and sets minimum site identity. After completion, `/setup` is permanently disabled.

**Detection logic** (backend):
- `GET /setup/status` → public endpoint; returns `{ required: boolean }` based on whether any `User` with `role = 'owner'` exists in the DB
- No Redis flag needed — the DB is the source of truth

**Next.js middleware** addition:
- If `GET /setup/status` returns `required: true`, redirect all routes (except `/setup`, `/api/setup/*`, and `/api/health`) to `/setup`
- Once an Owner exists, `/setup` redirects to `/` and the middleware is a no-op

**Wizard steps** (`frontend/app/setup/`):

Step 1 — Site Identity
- Site name (saved to `general.site_name` in SiteSettings)
- Site tagline (saved to `general.site_tagline`)
- Your name (Owner's display name — stored as `first_name` + `last_name` on the user)

Step 2 — Owner Account
- Email address
- Password (with strength meter, min 12 chars)
- Confirm password

Step 3 — Done
- "Your site is ready." message
- Link to backstage (`/admin`)
- Note: Configure email, payments, and storage in Admin Settings → the existing tabs handle all of that

**Backend** (`/setup` module):
- `POST /setup/complete` — accepts `{ site_name, site_tagline, email, password, first_name, last_name }`; validates that no Owner exists yet; creates the Owner user; writes site identity to SiteSettings; returns 201
- Guards: `SetupGuard` — blocks `POST /setup/complete` if an Owner already exists (prevents re-setup attacks)
- This endpoint does NOT require authentication (there is no user yet)

**What the wizard does NOT do**: configure Stripe, PayPal, SMTP, or storage. Those already have full UI in Admin Settings. The wizard's job is the minimum to get past the redirect and into the backstage.

---

### Part C — Site Branding from SiteSettings

**Goal**: The frontend reads site name and tagline from SiteSettings so the deployed site shows the owner's branding, not "AECMS".

`GET /settings-public/general` (already exists) returns public-safe general settings. Extend it to include `site_name` and `site_tagline`.

**Frontend changes**:
- `frontend/app/layout.tsx`: fetch `/settings-public/general` (server-side, cached); use `site_name` in `<title>` template and metadata
- `frontend/components/Header.tsx` (or wherever the site name appears): read from the same endpoint
- Default if not set: `"My Site"` (set as default in `seed.ts`)

**Default seed values** (in `seed.ts` `SiteSettings` section):
```typescript
{ key: 'general.site_name',    value: 'My Site' },
{ key: 'general.site_tagline', value: '' },
```

For the FvR deployment these are overridden in the wizard or manually via Admin Settings.

---

### Part D — ISM GCP KeyProvider

**Goal**: On Cloud Run, the `SETTINGS_ENCRYPTION_KEY` (SEK) lives in Google Secret Manager rather than an env file, and is accessed via Workload Identity (no service account JSON file).

The `KeyProvider` interface is already pluggable (Phase 15). Add `GcpKeyProvider`:

```typescript
// backend/src/settings/providers/gcp-key.provider.ts
// Uses @google-cloud/secret-manager
// Reads SEK from Secret Manager on first call; caches in memory
// Auth: Workload Identity on Cloud Run; falls back to ADC locally
```

Selection via `SETTINGS_ENCRYPTION_KEY_PROVIDER=gcp` env var (existing switch in `SettingsModule`).

When `SETTINGS_ENCRYPTION_KEY_PROVIDER=local` (default), the existing `LocalKeyProvider` reads the SEK from `SETTINGS_ENCRYPTION_KEY` env var — no change for local dev or Docker Compose deployments.

**Secret Manager setup** (one-time, owner action):
```bash
# Create the SEK secret (generate a 64-char hex key)
openssl rand -hex 32 | gcloud secrets create aecms-sek --data-file=-

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding aecms-sek \
  --member="serviceAccount:aecms-backend@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

All other secrets (Stripe, PayPal, SMTP) live in the `SiteSettings` DB encrypted by the SEK — they do NOT need their own Secret Manager entries.

---

### Part E — GCP Infrastructure

**Owner prerequisite**: GCP project created, billing enabled, `gcloud auth login` complete.

#### E1 — Cloud SQL (PostgreSQL 15)

- Instance: `db-f1-micro` (~$7/month). Sufficient for low-traffic personal site.
- Region: `us-central1`
- Connection from Cloud Run: Cloud SQL Auth Proxy via `CLOUD_SQL_CONNECTION_NAME` env var (automatic, no VPC needed)
- Public IP: disabled; access only via Auth Proxy
- Automated backups: daily, 7-day retention

```bash
gcloud sql instances create aecms-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --no-assign-ip \
  --backup-start-time=03:00

gcloud sql databases create aecms --instance=aecms-db
gcloud sql users create aecms --instance=aecms-db --password=<generated>
```

#### E2 — Redis

**Recommendation: Upstash** (serverless Redis, free tier, no VPC connector required).  
Alternative: Memorystore Basic 1GB (~$16/month, requires Serverless VPC Access connector ~$5/month).

Upstash setup: create account at upstash.com, create database, copy the `rediss://` URL → stored in Secret Manager as `aecms-redis-url`.

#### E3 — GCS Buckets

```bash
# Public media bucket (images, uploads)
gcloud storage buckets create gs://fantasyvreality-media \
  --location=us-central1 \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding gs://fantasyvreality-media \
  --member=allUsers --role=roles/storage.objectViewer

# Private digital bucket (EPUBs, PDFs — signed URLs only)
gcloud storage buckets create gs://fantasyvreality-digital \
  --location=us-central1 \
  --uniform-bucket-level-access
```

#### E4 — Secret Manager

Only two secrets go in Secret Manager. Everything else goes in ISM via Admin Settings:

| Secret name | Content |
|---|---|
| `aecms-sek` | Settings Encryption Key (32 hex bytes) |
| `aecms-database-url` | Cloud SQL connection string |

JWT secrets, Redis URL, and all third-party API keys go through the ISM (stored encrypted in `SiteSettings` DB). This is the whole point of the ISM.

```bash
# JWT secrets (generate locally, store in Secret Manager)
openssl rand -hex 32 | gcloud secrets create aecms-jwt-secret --data-file=-
openssl rand -hex 32 | gcloud secrets create aecms-jwt-refresh-secret --data-file=-
```

Wait — JWT secrets are runtime env vars, not ISM keys. They need to go in Secret Manager or Cloud Run env vars:

| Secret name | Content |
|---|---|
| `aecms-sek` | Settings Encryption Key |
| `aecms-database-url` | Cloud SQL connection string |
| `aecms-jwt-secret` | JWT signing key |
| `aecms-jwt-refresh-secret` | Refresh token signing key |
| `aecms-totp-key` | TOTP encryption key |
| `aecms-redis-url` | Redis/Upstash URL |

That's 6 secrets — all free in Secret Manager (< 6 active secrets/month free tier). Stripe, PayPal, SMTP go in ISM after first login via Admin Settings.

#### E5 — Artifact Registry

```bash
gcloud artifacts repositories create aecms \
  --repository-format=docker \
  --location=us-central1

# Auth Docker
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

### Part F — Dockerfiles and GitHub Actions CI/CD

#### F1 — Finalize Dockerfiles

Both services need production-ready Dockerfiles. Key concerns:
- Backend: multi-stage build (build stage compiles TypeScript; runtime stage is lean Node image); `prisma generate` in build stage; `prisma migrate deploy` as entrypoint pre-step
- Frontend: `next build` in build stage; `next start` in runtime stage; `NEXT_PUBLIC_*` env vars baked in at build time OR fetched from backend at runtime

**Migration on startup** (backend entrypoint):
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

This is safe because `migrate deploy` is idempotent and fast after the first run.

#### F2 — GitHub Actions CI/CD

`.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main]

env:
  PROJECT: your-gcp-project-id
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm ci && npm test
      - run: cd frontend && npm ci && npm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker $REGION-docker.pkg.dev

      - name: Build and push backend
        run: |
          docker build -t $REGISTRY/$PROJECT/aecms/backend:$GITHUB_SHA ./backend
          docker push $REGISTRY/$PROJECT/aecms/backend:$GITHUB_SHA

      - name: Build and push frontend
        run: |
          docker build -t $REGISTRY/$PROJECT/aecms/frontend:$GITHUB_SHA ./frontend
          docker push $REGISTRY/$PROJECT/aecms/frontend:$GITHUB_SHA

      - name: Deploy backend
        run: |
          gcloud run deploy aecms-backend \
            --image $REGISTRY/$PROJECT/aecms/backend:$GITHUB_SHA \
            --region $REGION \
            --set-secrets "DATABASE_URL=aecms-database-url:latest,SETTINGS_ENCRYPTION_KEY=aecms-sek:latest,JWT_SECRET=aecms-jwt-secret:latest,JWT_REFRESH_SECRET=aecms-jwt-refresh-secret:latest,TOTP_ENCRYPTION_KEY=aecms-totp-key:latest,REDIS_URL=aecms-redis-url:latest"

      - name: Deploy frontend
        run: |
          gcloud run deploy aecms-frontend \
            --image $REGISTRY/$PROJECT/aecms/frontend:$GITHUB_SHA \
            --region $REGION
```

**GCP service account for CI** (one-time setup):
```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions deployer"

# Grant: Cloud Run deployer, Artifact Registry writer, Secret Manager accessor
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:github-actions@PROJECT.iam.gserviceaccount.com" \
  --role="roles/run.developer"
# (add other roles similarly)

# Create key for GitHub Actions secret
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@PROJECT.iam.gserviceaccount.com
# Paste content of key.json into GitHub secret GCP_SA_KEY; then delete key.json
```

---

### Part G — Cloud Run Deployment

#### G1 — Backend service

```bash
gcloud run deploy aecms-backend \
  --image us-central1-docker.pkg.dev/PROJECT/aecms/backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --add-cloudsql-instances PROJECT:us-central1:aecms-db \
  --set-env-vars "NODE_ENV=production,STORAGE_PROVIDER_TYPE=gcs,SETTINGS_ENCRYPTION_KEY_PROVIDER=gcp,GCS_MEDIA_BUCKET=fantasyvreality-media,GCS_DIGITAL_BUCKET=fantasyvreality-digital,STORAGE_GCS_PROJECT_ID=PROJECT" \
  --set-secrets "DATABASE_URL=aecms-database-url:latest,SETTINGS_ENCRYPTION_KEY=aecms-sek:latest,JWT_SECRET=aecms-jwt-secret:latest,JWT_REFRESH_SECRET=aecms-jwt-refresh-secret:latest,TOTP_ENCRYPTION_KEY=aecms-totp-key:latest,REDIS_URL=aecms-redis-url:latest"
```

#### G2 — Frontend service

```bash
gcloud run deploy aecms-frontend \
  --image us-central1-docker.pkg.dev/PROJECT/aecms/frontend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --set-env-vars "NEXT_PUBLIC_API_URL=https://aecms-backend-HASH-uc.a.run.app,NODE_ENV=production"
```

**Note**: The `NEXT_PUBLIC_API_URL` should be the backend's Cloud Run URL (or `https://fantasyvreality.com/api` once the domain is mapped). The backend and frontend are on separate Cloud Run services. Single-domain routing (frontend proxies `/api/*` to backend) avoids CORS entirely and is the recommended approach.

#### G3 — Custom Domain

```bash
# Map custom domain to frontend service
gcloud run domain-mappings create \
  --service aecms-frontend \
  --domain fantasyvreality.com \
  --region us-central1

# API subdomain mapped to backend (OR: use Next.js rewrites to proxy /api/* to backend)
gcloud run domain-mappings create \
  --service aecms-backend \
  --domain api.fantasyvreality.com \
  --region us-central1
```

SSL is managed automatically by Cloud Run (Let's Encrypt). DNS records are provided by the `domain-mappings create` command output.

**Single-domain option** (recommended — no CORS, cleaner URLs):  
Add Next.js rewrites in `next.config.ts`:
```typescript
rewrites: async () => [{
  source: '/api/:path*',
  destination: `${process.env.BACKEND_URL}/api/:path*`,  // internal Cloud Run URL
}]
```
Then only `fantasyvreality.com` is the public-facing domain. No `api.` subdomain needed.

---

### Part H — FvR Content Migration

Once the production instance is running and the setup wizard is complete:

1. **Run seed against production DB**:
   ```bash
   SEED_PROFILE=fvr \
   DATABASE_URL="postgresql://aecms:PASSWORD@/aecms?host=/cloudsql/PROJECT:us-central1:aecms-db" \
   bash prisma/seed-all.sh
   ```
   This seeds all 73 articles + 15 products + the test order history.

2. **Upload media files to GCS**:
   ```bash
   gsutil -m cp -r backend/uploads/wp-import/* gs://fantasyvreality-media/wp-import/
   ```
   Lesson product images are now in GCS and served via public bucket URL.

3. **Inline image references in article content**: Some long articles have `<img>` tags pointing at old WordPress domain URLs. These need a find-and-replace. A one-time script:
   ```sql
   UPDATE articles 
   SET content = REPLACE(content, 
     'https://fantasyvreality.com/wp-content/uploads/', 
     'https://storage.googleapis.com/fantasyvreality-media/wp-import/')
   WHERE content LIKE '%wp-content/uploads%';
   ```
   (Exact URLs TBD based on what's actually in the content.)

4. **Configure via Admin Settings** (post-login in backstage):
   - General: site name = "Fantasy v Reality", tagline, favicon
   - Email: SMTP credentials (Gmail app password)
   - Payments: Stripe live keys, PayPal live keys
   - Storage: already set to GCS via env vars on Cloud Run; verify Test Connection ✓

5. **Stripe webhook**: Update webhook endpoint in Stripe dashboard to `https://fantasyvreality.com/api/payments/webhooks/stripe`. Re-run `stripe listen` is not needed in production — use the Stripe dashboard to create a production webhook.

6. **PayPal return URLs**: Update in PayPal developer portal to `https://fantasyvreality.com/checkout/success` and `/checkout/cancel`.

---

### Part I — Update Strategy

**The owner update path** (tested on FvR after initial launch):

```bash
# On Codespaces: develop, test, push
git push origin main
# → GitHub Actions runs tests, builds images, deploys to Cloud Run automatically

# Or manually:
gcloud run deploy aecms-backend --image .../backend:NEW_SHA --region us-central1
gcloud run deploy aecms-frontend --image .../frontend:NEW_SHA --region us-central1
# prisma migrate deploy runs automatically on container startup
```

**Safety rules** (enforced by convention):
1. Prisma migrations are additive only in production-facing releases. Destructive migrations require a maintenance window and are flagged in commit messages with `BREAKING MIGRATION`.
2. `seed.ts` is safe to re-run (idempotent upserts). `seed-fvr.ts` is safe to re-run (updates content from XML). `seed-orders.ts` skips if orders exist.
3. Owner data (articles, products, users, ISM secrets) is never touched by application updates.

**Backstage version display** (minimal): Show current commit SHA or package.json version in the backstage footer. No automated update checker needed for a personal site.

---

## Implementation Order

| # | Part | Description | Owner action needed? |
|---|------|-------------|----------------------|
| 1 | A | SEED_PROFILE system + seed-all.sh restructure | No |
| 2 | B | Setup wizard backend (`/setup` module + `SetupGuard`) | No |
| 3 | B | Setup wizard frontend (`/setup` pages, middleware) | No |
| 4 | C | Site branding from SiteSettings (layout + header) | No |
| 5 | D | `GcpKeyProvider` (Cloud Secret Manager for SEK) | No |
| 6 | F | Finalize Dockerfiles (backend + frontend, production builds) | No |
| 7 | — | **Owner: GCP project, billing, `gcloud auth login`** | **YES** |
| 8 | E | GCP infrastructure provisioning (Cloud SQL, GCS, secrets) | Partly |
| 9 | F | GitHub Actions workflow + GCP service account | Partly |
| 10 | G | Cloud Run deploy (backend + frontend) | No |
| 11 | G | Custom domain + SSL | Partly |
| 12 | H | FvR content migration (seed + media upload) | No |
| 13 | I | Update strategy test (push a change, verify auto-deploy) | No |

Steps 1–6 can be done entirely in Codespaces before any GCP work. Step 7 is the owner gate.

---

## Cost Estimate (FvR — Low Traffic)

| Service | Monthly |
|---|---|
| Cloud Run (2 services, min-instances=0) | $0–5 |
| Cloud SQL db-f1-micro | ~$7 |
| Upstash Redis (free tier) | $0 |
| GCS (media + digital, < 1GB) | ~$0.02 |
| Secret Manager (6 secrets, free tier) | $0 |
| Artifact Registry (< 0.5GB) | $0 |
| **Total** | **~$7–12/month** |

No Load Balancer. Cloud Run custom domain mappings handle SSL natively. CDN deferred — GCS public bucket is fast enough for a low-traffic personal site.

---

## Deployment Checklist

### Pre-deployment (Codespaces work)
- [ ] Part A: SEED_PROFILE system implemented and tested
- [ ] Part B: Setup wizard backend + frontend complete
- [ ] Part C: Site branding reads from SiteSettings
- [ ] Part D: GcpKeyProvider implemented
- [ ] Part F: Dockerfiles finalized; images build and run locally

### GCP setup (owner actions)
- [ ] GCP project created; billing enabled
- [ ] `gcloud auth login` complete; project set (`gcloud config set project PROJECT`)
- [ ] Cloud SQL instance created and accessible
- [ ] Upstash Redis instance created; URL noted
- [ ] GCS buckets created (`fantasyvreality-media`, `fantasyvreality-digital`)
- [ ] Secret Manager secrets populated (SEK, database URL, JWT secrets, Redis URL)
- [ ] Artifact Registry repository created
- [ ] GitHub secret `GCP_SA_KEY` added

### Deployment
- [ ] GitHub Actions workflow in place; first run succeeds
- [ ] Backend Cloud Run service running; `/api/health` returns 200
- [ ] Frontend Cloud Run service running; site loads
- [ ] Custom domain `fantasyvreality.com` mapped; DNS configured; SSL active
- [ ] `/setup` wizard completes; Owner account created; redirects to backstage

### FvR content
- [ ] `seed-all.sh SEED_PROFILE=fvr` run against production DB
- [ ] Lesson product images uploaded to GCS media bucket
- [ ] Admin Settings → General: site name = "Fantasy v Reality", favicon uploaded
- [ ] Admin Settings → Email: SMTP configured; test email sent ✓
- [ ] Admin Settings → Payment: Stripe live keys; PayPal live keys; both verified ✓
- [ ] Admin Settings → Storage: GCS; Test Connection ✓
- [ ] Stripe webhook updated to `https://fantasyvreality.com/api/payments/webhooks/stripe`
- [ ] PayPal return URLs updated to production domain
- [ ] End-to-end purchase flow tested in production (Stripe live, small amount)

### Update strategy
- [ ] Make a minor change; push to `main`; verify GitHub Actions deploys automatically
- [ ] Verify `prisma migrate deploy` runs on container start with no errors
- [ ] Confirm article content and user data untouched after re-deploy

---

## Out of Scope (Deferred)

- **ISM key rotation**: Re-encrypting all `_enc` rows under a new SEK. Design is documented in PRD 05; implementation deferred until there's a reason to rotate.
- **Backstage update notifications**: Banner showing available version. Useful for multi-owner, unnecessary for single-owner with GitHub Actions CD.
- **Getting-started checklist**: Nice UX, but the wizard + Admin Settings already guide the owner through the same tasks.
- **Multi-instance generalization**: Licensing, published packages, SaaS model — all deferred indefinitely.
- **Docker Compose single-server deployment**: DEPLOYMENT.md covers this. Not the primary target for FvR.
- **Load Balancer + CDN**: Skip for now. Cloud Run native domain mapping + GCS public bucket is sufficient.
