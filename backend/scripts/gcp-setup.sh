#!/bin/bash
# One-time GCP infrastructure setup for AECMS.
# Run this once from a workstation with gcloud authenticated as project owner.
# Usage: bash backend/scripts/gcp-setup.sh
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project 983307563767

set -euo pipefail

PROJECT="983307563767"
REGION="us-central1"
REPO="aecms"
BACKEND_SA="aecms-backend"
CI_SA="github-ci"
SQL_INSTANCE="aecms-db"
SQL_DB="aecms"
SQL_USER="aecms"
MEDIA_BUCKET="fantasyvreality-media"
DIGITAL_BUCKET="fantasyvreality-digital"

echo "=== AECMS GCP Setup ==="
echo "Project: $PROJECT | Region: $REGION"
echo ""

# ── 1. Enable required APIs ────────────────────────────────────────────────
echo "[1/8] Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  sql-component.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project "$PROJECT"

# ── 2. Artifact Registry ───────────────────────────────────────────────────
echo "[2/8] Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project "$PROJECT" 2>/dev/null || echo "  (already exists)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── 3. Backend service account ─────────────────────────────────────────────
echo "[3/8] Creating backend service account..."
BACKEND_SA_EMAIL="${BACKEND_SA}@${PROJECT}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe "$BACKEND_SA_EMAIL" --project "$PROJECT" &>/dev/null; then
  echo "  (already exists)"
else
  gcloud iam service-accounts create "$BACKEND_SA" \
    --display-name="AECMS Backend" \
    --project "$PROJECT"
fi

for ROLE in \
  roles/secretmanager.secretAccessor \
  roles/cloudsql.client \
  roles/storage.objectAdmin \
  roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${BACKEND_SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done
echo "  Backend SA: $BACKEND_SA_EMAIL"

# ── 4. GitHub CI service account ──────────────────────────────────────────
echo "[4/8] Creating GitHub CI service account..."
CI_SA_EMAIL="${CI_SA}@${PROJECT}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe "$CI_SA_EMAIL" --project "$PROJECT" &>/dev/null; then
  echo "  (already exists)"
else
  gcloud iam service-accounts create "$CI_SA" \
    --display-name="GitHub Actions CI" \
    --project "$PROJECT"
fi

for ROLE in \
  roles/run.developer \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${CI_SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done
echo "  CI SA: $CI_SA_EMAIL"

# ── 5. Cloud SQL ───────────────────────────────────────────────────────────
echo "[5/8] Creating Cloud SQL instance (this takes 3-5 minutes)..."
if ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT" &>/dev/null; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --backup-start-time=03:00 \
    --retained-backups-count=7 \
    --project "$PROJECT"
  echo "  Instance created."
else
  echo "  (already exists)"
fi

# Create database and user
gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE" --project "$PROJECT" 2>/dev/null || echo "  DB (already exists)"

SQL_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$SQL_PASSWORD" \
  --project "$PROJECT" 2>/dev/null || echo "  User (already exists — password not changed)"

CONNECTION_NAME="${PROJECT}:${REGION}:${SQL_INSTANCE}"
DATABASE_URL="postgresql://${SQL_USER}:${SQL_PASSWORD}@/${SQL_DB}?host=/cloudsql/${CONNECTION_NAME}"
echo "  Connection name: $CONNECTION_NAME"

# Allow backend SA to connect
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${BACKEND_SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser" \
  --quiet 2>/dev/null || true

# ── 6. GCS Buckets ────────────────────────────────────────────────────────
echo "[6/8] Creating GCS buckets..."
if ! gcloud storage buckets describe "gs://$MEDIA_BUCKET" &>/dev/null; then
  gcloud storage buckets create "gs://$MEDIA_BUCKET" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --project "$PROJECT"
  gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" \
    --member=allUsers --role=roles/storage.objectViewer
  echo "  Created public media bucket: $MEDIA_BUCKET"
else
  echo "  Media bucket (already exists)"
fi

if ! gcloud storage buckets describe "gs://$DIGITAL_BUCKET" &>/dev/null; then
  gcloud storage buckets create "gs://$DIGITAL_BUCKET" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --project "$PROJECT"
  echo "  Created private digital bucket: $DIGITAL_BUCKET"
else
  echo "  Digital bucket (already exists)"
fi

# ── 7. Secret Manager ─────────────────────────────────────────────────────
echo "[7/8] Creating Secret Manager secrets..."

create_secret() {
  local NAME="$1"
  local VALUE="$2"
  if gcloud secrets describe "$NAME" --project "$PROJECT" &>/dev/null; then
    echo "  $NAME (already exists — skipping)"
  else
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=- --project "$PROJECT"
    gcloud secrets add-iam-policy-binding "$NAME" \
      --member="serviceAccount:${BACKEND_SA_EMAIL}" \
      --role="roles/secretmanager.secretAccessor" \
      --project "$PROJECT" --quiet
    echo "  Created: $NAME"
  fi
}

# Settings Encryption Key (SEK) — the master key for ISM
SEK=$(openssl rand -hex 32)
create_secret "aecms-sek" "$SEK"

# Database URL with Cloud SQL unix socket path
create_secret "aecms-database-url" "$DATABASE_URL"

# JWT secrets
create_secret "aecms-jwt-secret" "$(openssl rand -hex 32)"
create_secret "aecms-redis-url" "PLACEHOLDER_SET_THIS_TO_YOUR_UPSTASH_URL"

echo ""
echo "  NOTE: Update aecms-redis-url with your Upstash Redis URL:"
echo "    echo -n 'rediss://...' | gcloud secrets versions add aecms-redis-url --data-file=- --project $PROJECT"

# Also grant CI SA access to secrets (needed if CI runs migrations that need DB)
for SECRET in aecms-sek aecms-database-url aecms-jwt-secret aecms-redis-url; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${CI_SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT" --quiet 2>/dev/null || true
done

# ── 8. GitHub CI key ──────────────────────────────────────────────────────
echo "[8/8] Exporting GitHub CI service account key..."
KEY_FILE="/tmp/github-ci-key.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$CI_SA_EMAIL" \
  --project "$PROJECT"

echo ""
echo "================================================================"
echo "  GCP setup complete."
echo "================================================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Add Upstash Redis URL to Secret Manager:"
echo "   Sign up at https://upstash.com → create a Redis DB → copy the rediss:// URL"
echo "   echo -n 'rediss://...' | gcloud secrets versions add aecms-redis-url --data-file=- --project $PROJECT"
echo ""
echo "2. Add GCP_SA_KEY to GitHub repository secrets:"
echo "   Go to: https://github.com/WCCollier/AECMS/settings/secrets/actions"
echo "   Create secret named: GCP_SA_KEY"
echo "   Value: $(cat "$KEY_FILE")"
echo ""
echo "3. DELETE the local key file:"
echo "   rm $KEY_FILE"
echo ""
echo "4. Push to main to trigger the first deployment."
echo ""
echo "5. After first deploy, map custom domains:"
echo "   gcloud run domain-mappings create --service aecms-frontend --domain fantasyvreality.com --region $REGION --project $PROJECT"
echo "   gcloud run domain-mappings create --service aecms-frontend --domain www.fantasyvreality.com --region $REGION --project $PROJECT"
echo "   gcloud run domain-mappings create --service aecms-frontend --domain wccollier.com --region $REGION --project $PROJECT"
echo ""
echo "6. After first deploy, log in to backstage and configure:"
echo "   - Admin Settings → File Storage: set GCS bucket names:"
echo "       Media bucket:   $MEDIA_BUCKET"
echo "       Digital bucket: $DIGITAL_BUCKET"
echo "   - Admin Settings → Email: SMTP credentials"
echo "   - Admin Settings → Payments: Stripe + PayPal keys"
echo ""
echo "Secrets Encryption Key (SEK) — store this securely, you'll never see it again:"
echo "  $SEK"
echo ""
