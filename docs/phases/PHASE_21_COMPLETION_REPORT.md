# Phase 21 Completion Report: Deployability + First Live Deployment

**Project**: AECMS  
**Phase**: 21  
**Status**: ✅ COMPLETE (2026-06-21)  
**Merged with**: Phase 19 (see `PHASE_19_PLAN.md`)  
**Commits**: see Git Log below

---

## Overview

Phase 21 made AECMS genuinely deployable — not just runnable in a Codespace, but shippable to any cloud platform by any reasonably technical owner. It also produced the first live production deployment, which served as the live integration test of everything built in phases 1–20.

The goal was: clone the repo, set one env var, deploy, hit `/setup`, done.

By end of phase:
- A full CI/CD pipeline builds and deploys both services to Cloud Run on every `main → deploy` merge
- The first live site has been running in production since the Phase 21 deployment session
- 73 articles and 15 products from the FvR content library are live
- The codebase is clean of all personal identifiers and ready for generic distribution

---

## Part A — Seed Profile System

**Goal**: Separate application bootstrap from owner-specific content.

**Implemented**:
- `SEED_PROFILE` env var: `minimal` (default) runs only capabilities, roles, and default settings. No users, no content.
- `scripts/seed-sample-content.js` runs at container startup (first boot only, when capability count = 0): creates the `_home_` placeholder page and the `about-pages` tutorial page. No owner required — pages have no `author_id`.
- `setup.service.ts → seedSampleContent()` runs when the wizard completes: creates the tutorial article ("About Articles") and tutorial product ("About Products") using the new owner's ID.
- FvR-specific seed scripts (`seed-fvr.ts`, `seed-orders.ts`, `seed-content.ts`, `seed-reviews.ts`, `seed_lessons.ts`) removed from the repo after the production content migration was complete.
- `FvR_Deployment/` directory (XML content dump and viewer) removed from the repo.

**Seed responsibility assignment** (final state):

| Script | When | What |
|---|---|---|
| `seed.ts` | Every `seed-all.sh` run | Capabilities, roles, default SiteSettings |
| `seed-sample-content.js` | First container boot | `_home_` page, `about-pages` tutorial page |
| `setup.service.ts` | Wizard completion | Tutorial article, tutorial product |

---

## Part B — Setup Wizard

**Goal**: A new deployment with no Owner account redirects all traffic to `/setup` until the deployer creates their Owner account.

**Implemented**:
- `GET /setup/status` — public; returns `{ required: boolean }` based on whether any `role = 'owner'` user exists
- `POST /setup/complete` — accepts site name, tagline, owner email + password + name; creates Owner; writes identity to SiteSettings; idempotent guard prevents re-setup
- Next.js middleware redirects all routes to `/setup` when setup is required
- 3-step wizard UI: Site Identity → Owner Account → Done
- Wizard seeds tutorial article and product using the new owner's ID on completion

---

## Part C — Dynamic Site Branding

**Goal**: Owner's site identity appears on the customer-facing site, not "AECMS".

**Implemented**:
- `GET /settings-public/general` returns `site_title`, `tagline` (already existed from Phase 15)
- `GET /settings-public/identity` returns `favicon_url` (already existed)
- `app/layout.tsx` (root): fetches site title server-side for `<title>` tag and metadata
- `app/(site)/layout.tsx`: fetches `site_title` server-side, passes to `<Header>` as prop
- `Header.tsx`: renders `siteTitle` prop in the top-left badge (replaces hardcoded `AECMS`)
- `Footer.tsx`: async Server Component; fetches `site_title` and `tagline` from settings; renders owner's brand name and tagline. Copyright line uses the owner's site title.
- All customer-facing branding now reflects whatever the owner configured in the wizard or Admin → Settings → General. Default fallback: "My Site".
- Backstage (`app/admin/layout.tsx`) retains "AECMS Admin" badge.

---

## Part D — GcpKeyProvider

**Goal**: On Cloud Run, the Settings Encryption Key (SEK) lives in Google Secret Manager accessed via Workload Identity — no service account JSON file in the container.

**Implemented**:
- `GcpKeyProvider` — reads SEK from Secret Manager on first call, caches in memory; auth via Workload Identity on Cloud Run, falls back to ADC locally
- Selected via `SETTINGS_ENCRYPTION_KEY_PROVIDER=gcp` env var
- `LocalKeyProvider` (Phase 15) remains the default for local dev and Docker Compose deployments

---

## Part E — GCP Infrastructure

**One-time setup** (idempotent bash script at `backend/scripts/gcp-setup.sh`):

| Resource | Details |
|---|---|
| Cloud SQL | PostgreSQL 15, `db-f1-micro`, daily backups, Auth Proxy connection |
| Redis | Upstash serverless (free tier); `rediss://` URL stored in Secret Manager |
| GCS buckets | Public media bucket (images) + private digital bucket (EPUBs/PDFs); created idempotently by CI |
| Artifact Registry | Docker repository for backend + frontend images |
| Secret Manager | `aecms-sek`, `aecms-database-url`, `aecms-jwt-secret`, `aecms-redis-url` |
| Service accounts | `aecms-backend` (runtime) + `github-ci` (CI/CD) with scoped IAM roles |

All third-party API keys (Stripe, PayPal, SMTP) go through the ISM — stored encrypted in `SiteSettings` DB, configured via Admin Settings after first login.

---

## Part F — Dockerfiles and GitHub Actions CI/CD

**Dockerfiles** (both multi-stage):
- Backend: TypeScript compile → lean Node 22 Alpine runtime; `prisma migrate deploy` runs before `node dist/main.js` on every startup (idempotent, fast after first run)
- Frontend: `next build` → Next.js standalone output; env vars injected at runtime via Cloud Run

**GitHub Actions** (`.github/workflows/deploy.yml`):
- Trigger: push to `deploy` branch
- Steps: build + push both Docker images to Artifact Registry → deploy backend Cloud Run service → deploy frontend Cloud Run service
- Configuration: 7 GitHub Variables (`GCP_PROJECT_NUMBER`, `GCP_PROJECT_ID`, `APP_DOMAIN`, `GCS_MEDIA_BUCKET`, `GCS_DIGITAL_BUCKET`, `SETTINGS_KMS_SECRET_ID`, `KINDLE_FROM_EMAIL`) — no FvR-specific values hardcoded
- CI creates GCS buckets idempotently on every deploy so a new owner's first deploy succeeds
- `github-ci` SA granted `roles/storage.admin` for bucket creation

---

## Part G — Cloud Run Deployment

**Architecture**:
- Backend: Cloud Run service (`aecms-backend`), Cloud SQL Auth Proxy sidecar, Workload Identity for Secret Manager and GCS
- Frontend: Cloud Run service (`aecms-frontend`), stateless, proxies `/api/*` to backend
- Single-domain routing: `yourdomain.com` maps to the frontend; frontend rewrites `/api/*` to the backend Cloud Run URL. No CORS issues; no `api.` subdomain needed.
- Domain mapping: `gcloud beta run domain-mappings create` with DNS validation

**Deployment workflow** (after initial setup):
```bash
git checkout deploy && git merge main --no-edit && git push origin deploy && git checkout main
```
Pipeline runs in ~6 minutes.

---

## Part H — Content Migration

**FvR production content migration** (completed 2026-06-21):

Ran `seed-fvr.ts` against the production Cloud SQL instance via the Cloud SQL proxy:

```
73 articles parsed — 72 created, 1 updated
7 categories seeded (Fiction, Non-Fiction, Short Thoughts, Reviews, Promos, Books, Reality)
10 tags seeded
15 lesson products created
```

Source: `FvR_Deployment/fvr-content.xml` (630 KB, generated from WordPress SQL dump). Now removed from the repo.

---

## Generic Distribution Prep

After the content migration, the repo was purged of all personal and site-specific identifiers:

**Deleted**:
- `FvR_Deployment/` (XML content dump + HTML viewer)
- `backend/prisma/seed-fvr.ts`, `seed-orders.ts`, `seed-content.ts`, `seed-reviews.ts`, `seed_lessons.ts`
- `docs/CLIPBOARD.md` (contained raw DB password)
- `HANDOFF_NOTES.md` (old internal dev artifact)
- `backend/scripts/seed-faux-orders.js`

**Sanitized across 37 files**:
- All references to the live site domain, GCP project IDs, Cloud Run URLs, DB password, personal email, personal name, personal GitHub username, product brand names replaced with generic placeholders
- `Header.tsx` logo badge: hardcoded site name → dynamic `siteTitle` prop
- `Footer.tsx`: hardcoded site name + tagline → server-fetched from settings
- `domain-aliases` DTO and spec: personal domain → `example.com`
- `sku.ts` and `sku.test.ts`: FvR product slug examples → generic examples
- `gcp-setup.sh`: all FvR-specific values → env var placeholders

**Final sweep**: zero matches on all personal identifier patterns across the entire non-generated codebase.

---

## Live Deployment Policy

With a live deployment in the wild, all future merges to `deploy` must be live-patchable and backward compatible. Policy documented in `CLAUDE.md` and `docs/DEPLOYMENT.md`:
- Migrations must be additive only (new columns/tables with defaults or nullable)
- No column renames or drops in the same deploy as the code that reads them
- No NOT NULL without a default or preceding backfill
- No enum value removal without confirming no live rows use it
- Breaking changes require a coordinated maintenance window

---

## First Live Deployment — Current State

- **Backend**: Cloud Run (`aecms-backend`)
- **Frontend**: Cloud Run (`aecms-frontend`)
- **Database**: Cloud SQL PostgreSQL 15 (`aecms-db`)
- **Redis**: Upstash (serverless)
- **Storage**: GCS (public media bucket + private digital bucket)
- **Email**: Resend / SMTP, `yourdomain.com` verified
- **Payments**: Stripe restricted key + webhook configured; PayPal sandbox credentials pending
- **Setup wizard**: Complete — Owner account created, 2FA enabled
- **Content**: 73 articles + 15 lesson products + tutorial pages live
- **Domains**: Primary domain + www mapped; alternate domain alias active

---

## Git Log (this session, 2026-06-21)

```
f31ac9d Branding: owner site title in customer-facing header; AECMS + donate link in backstage
2354890 Policy: live-patchable and backward-compatible deploys required
71d3dc6 Purge: remove all personal/site-specific identifiers for generic distribution
ccad262 Seed cleanup: rich wizard content, article/product removed from JS script
ab16c02 Consolidate seed-sample-content: single JS source of truth
54b738d Fix: seed p() helper emitted empty text nodes, breaking TipTap render
4039db1 Fix: wizard seedSampleContent created pages with raw TipTap JSON
0e1417d Fix: _home_ placeholder content and publish status for seed
064d39b Fix: seed pages used raw TipTap JSON instead of zone-layout format
```

Earlier Phase 21 work is recorded in the phase plan and across commits from the Phase 21 deployment sessions.
