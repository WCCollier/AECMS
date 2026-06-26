# Phase 25: Cloud SQL → Neon Migration

**Project**: AECMS  
**Phase**: 25  
**Status**: ✅ COMPLETE (deployed 2026-06-26)  
**Dependencies**: Phase 21 (live on Cloud Run)  
**Estimated savings**: ~$10/month  
**Estimated effort**: 30 minutes  

---

## Goal

Replace Cloud SQL (db-f1-micro, ~$10/month) with Neon Postgres (free tier, 0.5 GB).
Cloud Run, Upstash Redis, and GCS are already within free tiers — Cloud SQL is the only cost.

---

## Pre-flight

DB size confirmed: **74 MB** (0.7% of Neon's 500 MB free cap). ✅

---

## Neon project details

| | |
|---|---|
| Project | `aecms` |
| Region | AWS us-east-1 |
| Postgres | 16 |
| Credentials | See `docs/private/neon-credentials.md` |

---

## Step 0 — Set credential variables (Cloud Shell)

```bash
export NEON_DIRECT="<from docs/private/neon-credentials.md>"
export NEON_POOLER="<from docs/private/neon-credentials.md>"
```

---

## Step 1 — Dump from Cloud SQL (Cloud Shell)

```bash
cloud-sql-proxy $(gcloud config get-value project):us-central1:aecms-db --port 5432 & sleep 3
CLOUD_SQL_URL=$(gcloud secrets versions access latest --secret=aecms-database-url)
pg_dump "$CLOUD_SQL_URL" --no-owner --no-acl -Fc -f /tmp/aecms.dump
echo "Dump size: $(ls -lh /tmp/aecms.dump | awk '{print $5}')"
kill %1
```

Expected: dump file ~a few MB, no errors.

---

## Step 2 — Restore to Neon (Cloud Shell)

```bash
pg_restore --no-owner --no-acl -d "$NEON_DIRECT" /tmp/aecms.dump
echo "Restore done."
```

Expected: no errors. Warnings about existing extensions (plpgsql) are harmless.

---

## Step 3 — Verify Neon has data (Cloud Shell)

```bash
psql "$NEON_DIRECT" -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM articles; SELECT COUNT(*) FROM orders;"

psql "$NEON_DIRECT" -c "SELECT COUNT(*) FROM pages;"
```

Expected: row counts matching what's in production.

---

## Step 4 — Update the GCP secret (Cloud Shell)

```bash
echo -n "$NEON_POOLER" | gcloud secrets versions add aecms-database-url --data-file=-
```

Expected: `Created version [2] of the secret [aecms-database-url].`

---

## Step 5 — Remove the Cloud SQL line from deploy.yml

In `backend/.github/workflows/deploy.yml` (line 130), delete:

```yaml
--add-cloudsql-instances "${{ env.GCP_PROJECT_ID }}:${{ env.REGION }}:aecms-db" \
```

Then also merge FR-006 + FR-007 from main at the same time:

```bash
# In the Codespace
git checkout deploy && git merge main
# delete line 130 from .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "feat: Phase 25 — Cloud SQL → Neon; also ship FR-006 + FR-007"
git push origin deploy
```

---

## Step 6 — Verify after deploy (~2 min for Cloud Run revision swap)

1. Open fantasyvreality.com — pages load ✅
2. Log into backstage — admin works ✅  
3. Neon dashboard → Monitoring → confirm incoming connections ✅
4. Test forgot-password flow (FR-006) ✅
5. Place a test order (FR-007 — confirm confirmation email arrives) ✅

---

## Step 7 — Delete Cloud SQL instance (Cloud Shell)

Only do this after Step 6 is fully confirmed.

```bash
gcloud sql instances delete aecms-db --project $(gcloud config get-value project)
```

Type `y` to confirm. Billing stops immediately.

---

## Known Trade-offs

| Topic | Detail |
|---|---|
| **Cold start** | Neon free tier auto-suspends after 5 min idle. First query after idle ~1–3s. Acceptable at FvR traffic. |
| **Storage cap** | 0.5 GB free. Currently 74 MB — monitor via Neon dashboard. |
| **Connection model** | Neon pooler uses PgBouncer transaction mode. Prisma + `@prisma/adapter-pg` works correctly in this mode. |
| **IAM** | `aecms-backend` service account retains its `Cloud SQL Client` binding — harmless, clean up later if desired. |

---

## Cost After Migration

| Service | Before | After |
|---|---|---|
| Cloud SQL (db-f1-micro + IPv4) | ~$10/mo | $0 |
| Neon Postgres | $0 | $0 |
| Cloud Run | ~$0–2/mo | ~$0–2/mo |
| Upstash Redis | $0 | $0 |
| GCS media storage | ~$0 | ~$0 |
| **Total** | **~$10–12/mo** | **~$0–2/mo** |
