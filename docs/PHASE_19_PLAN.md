# Phase 19: First Deployment — fantasyvreality.com on Google Cloud

**Project**: AECMS  
**Phase**: 19  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 13 (QA complete), Phase 16 (Nav/URLs clean), all prior phases stable

---

## Goal

Deploy AECMS as `fantasyvreality.com` on Google Cloud Run, using the existing seed data (extracted from the old WordPress site) to populate the new site. Digital product files and media assets go to Google Cloud Storage. Payments, email, and other external services are wired to production credentials.

---

## Architecture Overview

```
User Browser
    │
    ▼
Cloud Load Balancer  ←── Custom domain SSL (fantasyvreality.com)
    │
    ├── /api/* ──────► Cloud Run: NestJS backend
    │                      │
    │                      ├── Cloud SQL (PostgreSQL 15) 
    │                      ├── Memorystore (Redis)
    │                      ├── Cloud Storage (uploads + digital files)
    │                      └── Secret Manager (all secrets)
    │
    └── /* ──────────► Cloud Run: Next.js frontend
                           │
                           └── Cloud Storage (static assets via CDN)
```

---

## Part A — Google Cloud Services

### A1 — Cloud Run (Compute)

Two Cloud Run services:
- **`aecms-backend`**: NestJS app. Stateless — reads/writes to Cloud SQL, Redis, and GCS. Min instances: 0 (cold-start acceptable for a low-traffic personal site). Max instances: 3.
- **`aecms-frontend`**: Next.js app (via `next start` with App Router). Min instances: 0. Max instances: 3.

**Dockerization**: Both services already have `Dockerfile`s from Phase 0 (or will need them finalized). The key change is ensuring the images work without local storage (GCS replaces local filesystem for uploads).

**Concurrency**: Cloud Run handles concurrent requests within one instance. Set `--concurrency=80` (default) for both services.

**Region**: `us-central1` is the recommended default (lowest latency for US traffic; widest Cloud Run feature support). Can be changed.

### A2 — Cloud SQL (PostgreSQL)

- **Instance**: `db-f1-micro` (free tier eligible) or `db-g1-small` for better performance. PostgreSQL 15.
- **Connection**: Cloud Run connects via **Cloud SQL Auth Proxy** (automatic when using the `CLOUD_SQL_CONNECTION_NAME` env var with the Cloud Run add-on). No public IP needed.
- **Backups**: Enable automated backups (daily, 7-day retention).
- **Migration**: Run `npx prisma migrate deploy` as a Cloud Run job or during container startup before the server binds.

**Cost estimate**: db-f1-micro ≈ $7/month. db-g1-small ≈ $25/month.

### A3 — Memorystore (Redis)

- **Tier**: Basic (no replication needed for a personal site). 1GB instance.
- **Connectivity**: Cloud Run → Memorystore requires Serverless VPC Access connector (adds ~$5/month or can be skipped if using Cloud Run direct VPC egress, which is in preview).
- **Alternative**: If Memorystore cost is a concern, use **Upstash Redis** (serverless Redis, free tier available, no VPC required — just HTTP). Trade-off: slightly higher latency, simpler connectivity.

**Cost estimate**: 1GB Memorystore Basic ≈ $16/month. Upstash free tier = $0 (up to 10k commands/day).

### A4 — Cloud Storage (GCS)

Two buckets:
- **`fantasyvreality-media`**: Product images, article images, uploaded media. Public-read. Served via CDN.
- **`fantasyvreality-digital`**: Digital product files (EPUBs, PDFs). Private-read (signed URLs only). No CDN — files served through the backend which applies personalization before streaming.

**CDN**: Enable Cloud CDN on the media bucket and the frontend static assets. Configurable via the Load Balancer backend settings.

### A5 — Secret Manager

All secrets currently in `.env` files move to Google Secret Manager. The backend Cloud Run service accesses them at startup via the Secret Manager client library or (cleaner) via Cloud Run's native secret mounting (`--set-secrets` flag). Secrets are not stored in the Docker image or in git.

Secret inventory:
| Secret Name | Current env var | Description |
|------------|----------------|-------------|
| `database-url` | `DATABASE_URL` | Cloud SQL connection string |
| `redis-url` | `REDIS_URL` | Memorystore / Upstash URL |
| `jwt-secret` | `JWT_SECRET` | Auth JWT signing key |
| `jwt-refresh-secret` | `JWT_REFRESH_SECRET` | Refresh token signing key |
| `stripe-secret-key` | `STRIPE_SECRET_KEY` | Stripe live key |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `paypal-client-id` | `PAYPAL_CLIENT_ID` | PayPal live credentials |
| `paypal-client-secret` | `PAYPAL_CLIENT_SECRET` | |
| `smtp-password` | `SMTP_PASSWORD` | Gmail app password or SendGrid key |
| `totp-encryption-key` | `TOTP_ENCRYPTION_KEY` | 2FA secret encryption key |

### A6 — Artifact Registry (Docker images)

Store Docker images in **Artifact Registry** (`us-central1-docker.pkg.dev/PROJECT/aecms/`). Cloud Build can be set up to auto-build on git push (or use manual `gcloud builds submit` for now).

---

## Part B — GCS Storage Provider

Currently AECMS uses local filesystem storage (`STORAGE_PROVIDER_TYPE=local`). Add a GCS provider.

### B1 — New `GcsStorageProvider`

```typescript
// backend/src/storage/gcs-storage.provider.ts
import { Storage } from '@google-cloud/storage';

@Injectable()
export class GcsStorageProvider implements StorageProvider {
  private storage: Storage;
  private mediaBucket: string;
  private digitalBucket: string;
  
  async upload(buffer, path, options): Promise<string> { ... }
  async download(path): Promise<Buffer> { ... }
  async delete(path): Promise<void> { ... }
  async getSignedUrl(path, expiresInSeconds): Promise<string> { ... }
}
```

**Authentication**: On Cloud Run, use Workload Identity Federation (no service account key file needed — the Cloud Run service account has IAM roles `storage.objectCreator` on the media bucket and `storage.objectAdmin` on the digital bucket).

**Local fallback**: The existing `LocalStorageProvider` stays; `STORAGE_PROVIDER_TYPE=gcs` selects the new one. The module factory (already exists) handles the switch.

### B2 — Signed URL flow for digital downloads

Currently the download endpoint streams the file from local disk. With GCS, the same flow works: the backend fetches the file as a Buffer from GCS, personalizes it, and streams the result to the client. The GCS signed URL is for direct GCS access (skipping the backend) — we don't use that for digital products because personalization must happen server-side.

For media assets (images), switch from serving through the backend to serving directly from GCS (public bucket or signed URL). The `MediaItem.url` stored in the DB should reference the GCS public URL, not a local path.

---

## Part C — Seed Data Migration

The current seed data was extracted from the WordPress site and is stored in the `prisma/seeds/` scripts. It includes:
- 15+ lesson products with images
- Articles extracted from WordPress
- The American Shooter Hat physical product
- Owner/Admin/Member user accounts

**Migration steps:**
1. Run `prisma migrate deploy` against Cloud SQL to set up the schema
2. Run seed scripts against Cloud SQL to populate content
3. Upload media files from the Codespace local storage to the `fantasyvreality-media` GCS bucket
4. Update media `url` fields in the DB to point to GCS URLs
5. Upload digital product files (EPUBs, PDFs) to the `fantasyvreality-digital` GCS bucket
6. Update `DigitalProductFile.file_id` fields to reflect GCS paths

**One-time migration script** (to be written):
```bash
# Upload local uploads to GCS
gsutil -m cp -r /workspaces/AECMS/backend/uploads/* gs://fantasyvreality-media/

# Update URLs in DB
psql $DATABASE_URL -c "UPDATE media SET url = REPLACE(url, 'http://localhost:4000/uploads/', 'https://storage.googleapis.com/fantasyvreality-media/') WHERE url LIKE 'http://localhost%';"
```

---

## Part D — Custom Domain Setup

1. **Purchase/transfer domain**: `fantasyvreality.com` — confirm registrar (Namecheap, Google Domains/Squarespace, etc.)
2. **Cloud Run custom domain**: `gcloud run domain-mappings create --service aecms-frontend --domain fantasyvreality.com --region us-central1`
3. **Subdomain for API**: Consider `api.fantasyvreality.com → aecms-backend` OR route `/api/*` through the Load Balancer to the backend service (single domain, no CORS complexity). Single domain is recommended.
4. **SSL**: Cloud Run manages SSL automatically for custom domain mappings (via Let's Encrypt). No manual cert work.
5. **DNS**: Set A/CNAME records per the Cloud Run instructions (provided after step 2).

---

## Part E — CI/CD Pipeline

For a personal site, a simple manual deploy is fine initially. For future updates:

**Minimal pipeline** (GitHub Actions):
```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    steps:
      - Build Docker images
      - Push to Artifact Registry
      - Deploy to Cloud Run (backend, then frontend)
      - Run prisma migrate deploy (as a Cloud Run job)
```

**Blue-green deployment**: Cloud Run handles this automatically — new revision is deployed; traffic shifts to it only after health checks pass. Old revision stays warm for instant rollback.

---

## Part F — Secrets Management in Backstage (Future State Discussion)

Currently all secrets are in `.env` files / environment variables. For multi-owner deployability (Phase 21), it would be better if the owner can configure external service credentials through the backstage settings panel — no SSH or file editing required.

**Proposed future model**:
- A `SiteSettings` table in the DB with encrypted key-value pairs for each configurable secret
- Owner can set Stripe keys, SMTP credentials, etc. from the backstage
- On startup, the app loads settings from DB (after decrypting) and merges with env vars (env vars take precedence for security)
- The encryption key for the `SiteSettings` table is the ONLY secret that must be set as an environment variable/Secret Manager entry

**For Phase 19**: Use Secret Manager + env vars. The backstage settings UI for secrets is Phase 21 work.

**One-time owner onboarding** (Phase 19): A `FIRST_RUN` flag or the absence of an Owner account triggers a setup wizard at `/setup` that lets the deployer set site name, admin email, and paste in API keys. After setup, the route is disabled.

---

## Part G — Cost Estimate (Low Traffic Personal Site)

| Service | Monthly cost |
|---------|-------------|
| Cloud Run (frontend + backend, min 0) | $0–$5 |
| Cloud SQL db-f1-micro | $7 |
| Memorystore Basic 1GB | $16 OR $0 (Upstash free) |
| Cloud Storage (media + digital) | $0.02/GB + $0.004/10k ops ≈ $1–3 |
| Secret Manager | $0 (< 6 active secrets free) OR $0.06/secret/mo |
| Load Balancer | $18/month minimum |
| Artifact Registry | $0 (< 0.5GB free) |
| **Total** | **~$25–50/month** |

**Note on Load Balancer cost**: The $18/month is for a full HTTPS Load Balancer with a global IP. Alternative: skip the LB and use Cloud Run's built-in HTTPS endpoint with custom domain mapping ($0). The trade-off is no Cloud CDN in front of the app, but GCS has its own CDN for static assets.

**Recommended for Phase 19**: Skip the Load Balancer. Use Cloud Run custom domain mappings directly. Add a Load Balancer in Phase 21 when multi-tenant support justifies the cost.

---

## Deployment Checklist

- [ ] Google Cloud project created; billing enabled
- [ ] `gcloud` CLI authenticated
- [ ] Artifact Registry repository created
- [ ] Cloud SQL instance created; schema migrated
- [ ] Memorystore or Upstash Redis provisioned
- [ ] GCS buckets created (`fantasyvreality-media`, `fantasyvreality-digital`)
- [ ] All secrets added to Secret Manager
- [ ] `GcsStorageProvider` implemented and tested
- [ ] Docker images built and pushed to Artifact Registry
- [ ] Backend Cloud Run service deployed with secrets mounted
- [ ] Frontend Cloud Run service deployed
- [ ] Custom domain mapped; DNS configured; SSL active
- [ ] Seed data migrated; media files uploaded to GCS
- [ ] Stripe webhook URL updated to `https://fantasyvreality.com/api/payments/webhooks/stripe`
- [ ] PayPal return URLs updated to `https://fantasyvreality.com/checkout/success`
- [ ] SMTP credentials pointing to production email address
- [ ] `PAYMENT_TEST_MODE=false` confirmed
- [ ] End-to-end purchase flow tested in production

---

## Open Questions for Owner

1. **Domain registrar**: Where is `fantasyvreality.com` registered? This affects DNS management.
2. **Redis preference**: Memorystore ($16/mo, lower latency) or Upstash (free tier, simpler setup)?
3. **Email in production**: Stick with Gmail + app password, or upgrade to a transactional service (Mailgun, SendGrid, Postmark)? Gmail has a 500/day limit which is fine for a personal site.
4. **Load Balancer**: Skip for now (saves $18/mo) or set up from day one for CDN support?
5. **CI/CD**: Manual `gcloud` deploys from the terminal, or GitHub Actions automation?
