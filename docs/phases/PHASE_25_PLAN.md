# Phase 25: Cloud SQL → Neon Migration

**Project**: AECMS  
**Phase**: 25  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 21 (live on Cloud Run — migration only makes sense once deployed)  
**Estimated savings**: ~$10/month (eliminates Cloud SQL compute + public IPv4 charges)  
**Estimated effort**: 45 minutes

---

## Goal

Replace Cloud SQL (db-f1-micro, ~$10/month) with Neon Postgres (free tier, 0.5 GB) to reduce the FvR hosting cost from ~$10–12/month to near-zero. Cloud Run compute, Upstash Redis, and Cloudflare R2 are already within their free tiers; Cloud SQL is the only remaining cost.

---

## Activation Trigger

Do this whenever it's convenient. There is no urgency — it is a pure cost reduction with no feature impact. Suggested timing: a quiet deploy window when traffic is low (e.g. early morning).

---

## Pre-flight Check

Before starting, verify the current database size is under Neon's 0.5 GB free limit:

```sql
SELECT pg_size_pretty(pg_database_size('aecms'));
```

Run via Cloud SQL Studio in the GCP console or via the Cloud SQL proxy. If the DB is approaching 0.5 GB, consider Neon's Launch plan ($19/month, 10 GB) — it would still be cheaper than Cloud SQL.

---

## Step 1 — Create Neon Project (5 min, browser)

1. Sign up or log in at [neon.tech](https://neon.tech).
2. Create a new project. Choose **AWS us-east-1** (lowest latency from Cloud Run us-central1; or us-east4 if that's your Cloud Run region).
3. Note both connection strings:
   - **Pooler** (port 6543): `postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **Direct** (port 5432): `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Use the **pooler URL** for `DATABASE_URL` — Cloud Run is serverless and the pooler prevents connection exhaustion.

---

## Step 2 — Export from Cloud SQL (10 min)

**Option A — Cloud Shell + proxy (preferred):**

```bash
# In Google Cloud Shell
cloud-sql-proxy PROJECT_ID:REGION:aecms-db --port 5433 &
sleep 3
pg_dump "postgresql://DB_USER:DB_PASS@localhost:5433/aecms" > aecms_dump.sql
```

**Option B — GCP Console export:**

Cloud SQL → `aecms-db` → Export → Format: SQL → Database: `aecms` → Destination: Cloud Storage bucket → Download the `.sql` file.

---

## Step 3 — Import to Neon (5 min)

```bash
psql "postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" < aecms_dump.sql
```

The `_prisma_migrations` table is included in the dump. Prisma will not re-run migrations on first boot — it only runs migrations not present in that table.

---

## Step 4 — Update the GCP Secret (2 min)

The `DATABASE_URL` is stored in GCP Secret Manager as `aecms-database-url`. Update it to the Neon pooler URL:

```bash
echo -n "postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" | \
  gcloud secrets versions add aecms-database-url \
    --data-file=- \
    --project YOUR_PROJECT_ID
```

---

## Step 5 — Edit `deploy.yml` (one-line change)

Remove line 130 from `.github/workflows/deploy.yml`:

```yaml
# DELETE this line:
--add-cloudsql-instances "${{ env.GCP_PROJECT_ID }}:${{ env.REGION }}:aecms-db" \
```

This is the only code change. The Cloud SQL connector socket is no longer needed; Neon uses a standard TCP connection via the URL.

Commit and push to `deploy`. The CI/CD workflow builds and deploys automatically. Cloud Run performs an atomic revision swap (~30 seconds of switchover).

---

## Step 6 — Verify

After the new revision is live:

1. Open the FvR site and confirm pages load.
2. Log into backstage and confirm admin functions work.
3. Check Neon's dashboard — you should see incoming connections and query activity.

---

## Step 7 — Delete Cloud SQL (2 min)

Once verified:

```bash
gcloud sql instances delete aecms-db --project YOUR_PROJECT_ID
```

This immediately stops billing for the instance. The public IPv4 charge also stops.

---

## Known Trade-offs

| Topic | Detail |
|---|---|
| **Cold start** | Neon free tier auto-suspends after 5 min of no DB activity. First query after idle takes 1–3 seconds (Neon waking up). Subsequent queries are normal. Acceptable at FvR's traffic level. |
| **Storage cap** | 0.5 GB on free tier. FvR's DB is currently well under this; monitor via Neon dashboard. |
| **Connection model** | Neon pooler uses PgBouncer in transaction mode. Prisma works fine in this mode (it does not use advisory locks or `SET` session variables by default). |
| **No Cloud SQL IAM cleanup needed** | The `aecms-backend` service account retains its `Cloud SQL Client` IAM binding. It's harmless to leave — you can clean it up later if desired. |

---

## Cost After Migration

| Service | Before | After |
|---|---|---|
| Cloud SQL (db-f1-micro + IPv4) | ~$10/mo | $0 |
| Neon Postgres | $0 | $0 |
| Cloud Run compute | ~$0–2/mo | ~$0–2/mo |
| Upstash Redis | $0 | $0 |
| Cloudflare R2 | $0 | $0 |
| **Total** | **~$10–12/mo** | **~$0–2/mo** |
