# Phase 25 Completion Report: Cloud SQL → Neon Migration

**Project**: AECMS  
**Phase**: 25  
**Status**: ✅ DEPLOYED 2026-06-26  
**Commit**: `0c5d970` feat: Phase 25 — remove Cloud SQL connector; DB now on Neon  
**Deployed**: `86bc807` Merge branch 'main' into deploy (2026-06-26 03:06 UTC)  
**Plan**: `docs/phases/PHASE_25_PLAN.md`

---

## Overview

Phase 25 replaced Cloud SQL (db-f1-micro, ~$10/month) with Neon Postgres (free tier). This was a pure operational migration — data moved intact, zero downtime, one-line code change to the CI/CD pipeline. All other GCP services (Cloud Run, GCS, Upstash Redis) were already on free tiers; Cloud SQL was the only ongoing cost.

---

## Pre-flight

- DB size confirmed at 74 MB — 0.7% of Neon's 500 MB free cap. ✅
- Neon project `aecms` provisioned in AWS us-east-1, Postgres 16.

---

## Migration Steps (Operational — Cloud Shell)

All executed manually in Google Cloud Shell:

| Step | Action | Result |
|------|--------|--------|
| 1 | `pg_dump` from Cloud SQL via `cloud-sql-proxy` | Dump created, no errors |
| 2 | `pg_restore` to Neon direct connection URL | No errors (harmless plpgsql extension warning only) |
| 3 | Verify row counts (`users`, `articles`, `orders`, `pages`) | Counts matched production |
| 4 | Update `aecms-database-url` GCP secret to Neon pooler URL | Version 2 created |
| 6 | Post-deploy verification (site loads, backstage works, Neon dashboard shows connections) | All passing |
| 7 | `gcloud sql instances delete aecms-db` | Cloud SQL deleted; billing stopped |

---

## Code Change

**1 line removed** from `.github/workflows/deploy.yml`:

```yaml
# Removed:
--add-cloudsql-instances "${{ env.GCP_PROJECT_ID }}:${{ env.REGION }}:aecms-db" \
```

This line mounted the Cloud SQL Unix socket on the Cloud Run container. Without it, the backend connects to Neon via the standard `DATABASE_URL` environment variable (the GCP secret updated in Step 4).

**Files changed**: `.github/workflows/deploy.yml` (1 line deleted)

---

## Shipped Alongside

FR-006 (Forgot Password) and FR-007 (Order Confirmation Emails) were already on main and were included in the same deploy branch merge:

```
86bc807  Merge branch 'main' into deploy
0c5d970  feat: Phase 25 — remove Cloud SQL connector; DB now on Neon
...
e3198f6  feat: FR-006 + FR-007 — Forgot Password and Order Confirmation Emails
```

---

## Cost Impact

| Service | Before | After |
|---------|--------|-------|
| Cloud SQL (db-f1-micro + IPv4) | ~$10/mo | $0 |
| Neon Postgres | — | $0 |
| Cloud Run | ~$0–2/mo | ~$0–2/mo |
| **Total** | **~$10–12/mo** | **~$0–2/mo** |

---

## Known Trade-offs (Active)

| Topic | Detail |
|-------|--------|
| **Cold start** | Neon free tier auto-suspends after 5 min idle. First query after idle ~1–3 s. Acceptable at current traffic levels. Monitor if traffic grows. |
| **Storage cap** | 0.5 GB free. At 74 MB on migration day, ~15% used. Monitor via Neon dashboard. |
| **Connection model** | Neon pooler uses PgBouncer transaction mode. Prisma + `@prisma/adapter-pg` works correctly in this mode. |
| **IAM** | `aecms-backend` service account retains `Cloud SQL Client` binding — harmless; clean up later if desired. |

---

## Acceptance Criteria

- [x] Site loads after deploy (customer-facing pages, no database errors)
- [x] Backstage login works (admin session creation queries Neon)
- [x] Neon dashboard → Monitoring shows incoming connections from Cloud Run
- [x] FR-006: Forgot Password flow functional end-to-end
- [x] FR-007: Order confirmation email sent on test purchase
- [x] Cloud SQL instance deleted; billing stopped
