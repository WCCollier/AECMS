# AECMS Production Deployment Guide

This guide covers deploying AECMS to a production environment using Docker Compose.

---

## ⚠️ Live Deployment Compatibility Policy

AECMS has live deployments in the wild. Every change merged to the `deploy` branch must be **live-patchable** and **backward compatible**:

- **Live-patchable**: the running instance continues to function correctly immediately after the new image is deployed, without manual intervention or downtime.
- **Backward compatible**: the old code (still running during a rolling deploy) must be able to read and write the database successfully after the migration runs.

### Rules for database migrations

| Change type | Safe to ship in one deploy? |
|---|---|
| Add nullable column | ✅ Yes |
| Add column with default | ✅ Yes |
| Add new table | ✅ Yes |
| Add index | ✅ Yes (build online) |
| Rename column | ❌ No — split: add new + dual-write → remove old |
| Drop column | ❌ No — remove code reads first, then drop |
| Add NOT NULL without default | ❌ No — backfill first, then add constraint |
| Remove an enum value | ❌ No — confirm no live rows use it first |
| Change ISM key names | ❌ No — maintain old key as alias during transition |

If a breaking change is unavoidable, schedule a coordinated maintenance window and document it explicitly in the PR before merging to `deploy`.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Environment Configuration](#environment-configuration)
4. [Internal Secrets Manager (ISM) Setup](#internal-secrets-manager-ism-setup)
5. [External Storage Manager (ESM) Setup](#external-storage-manager-esm-setup)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Database Migration](#database-migration)
8. [Deployment Steps](#deployment-steps)
9. [Post-Deployment](#post-deployment)
10. [Backup Strategy](#backup-strategy)
11. [Monitoring](#monitoring)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 22.04 LTS (recommended) or any Linux distribution
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum (SSD recommended)
- **Docker**: 24.0+ with Docker Compose v2
- **Domain**: A registered domain with DNS access

### Software Requirements

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

### Required Accounts

1. **Stripe** (https://stripe.com) - Payment processing
2. **PayPal Developer** (https://developer.paypal.com) - Alternative payments
3. **OpenAI** (https://platform.openai.com) - AI moderation
4. **SMTP Provider** - Email delivery. Recommended: **Resend** (https://resend.com) — free tier (3,000 emails/month, 100/day), requires a verified custom domain, standard SMTP credentials. Alternatives: Mailgun, SendGrid. HostGator/cPanel SMTP works as a starting point but has lower deliverability for transactional email.

---

## Server Setup

### 1. Create Application User

```bash
# Create dedicated user for AECMS
sudo useradd -m -s /bin/bash aecms
sudo usermod -aG docker aecms

# Switch to aecms user
sudo su - aecms
```

### 2. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/AECMS.git
cd AECMS
```

### 3. Create Directory Structure

```bash
# Create directories for persistent data
mkdir -p data/uploads
mkdir -p data/backups
```

---

## Environment Configuration

### 1. Create Production Environment File

```bash
# Copy the example file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

### 2. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/aecms` |
| `DB_PASSWORD` | Database password | Strong 32+ character password |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Generate with `openssl rand -base64 64` |
| `STRIPE_SECRET_KEY` | Stripe live secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `PAYPAL_CLIENT_ID` | PayPal live client ID | From PayPal dashboard |
| `PAYPAL_CLIENT_SECRET` | PayPal live secret | From PayPal dashboard |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### 3. Generate Secure Secrets

```bash
# Generate JWT secrets
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')"
```

### 4. Configure URLs

```bash
# In .env.production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
FRONTEND_ADMIN_URL=https://yourdomain.com/admin
```

---

## Internal Secrets Manager (ISM) Setup

The ISM stores service credentials (SMTP password, Stripe keys, PayPal keys, etc.) encrypted at rest in the database using AES-256-GCM. It needs one piece of external configuration that never enters the database: the **Settings Encryption Key (SEK)**.

### What the SEK is

The SEK is a 32-byte (256-bit) random value, expressed as 64 lowercase hex characters. Every secret written to the `site_settings` table is encrypted with it, and every read decrypts with it. If the SEK is lost, all ISM-stored secrets become permanently unreadable — the only recovery is to re-enter them through the Admin Settings panel.

### Step 1: Generate the SEK

Run this once and save the output immediately:

```bash
openssl rand -hex 32
# example output: f8af44804ee770751a2cc0b0c56ab9ef86d8cdea99d2f7a3b9140936670a6125
```

Do not re-run it later and expect to keep existing secrets — the new key will not decrypt anything encrypted under the old one.

### Step 2: Store the SEK — by deployment profile

#### Docker Compose on a VPS (self-hosted)

Add it to your backend `.env` file alongside the other secrets. Restrict file permissions so only the application user can read it:

```bash
echo "SETTINGS_ENCRYPTION_KEY=<your-64-hex-chars>" >> backend/.env
echo "SETTINGS_KMS_PROVIDER=local" >> backend/.env

chmod 600 backend/.env
```

The file should be owned by the same OS user that runs the Docker daemon or the Node process. Do not commit `.env` to version control.

For an extra layer of protection on a shared server, consider using Docker secrets or a separate `.env.secrets` file mounted as a read-only bind volume, excluded from any backup that goes off-site unencrypted.

#### Google Cloud Run

Store the SEK in **Google Cloud Secret Manager** and surface it as an environment variable at deploy time:

```bash
# Create the secret (one-time)
echo -n "<your-64-hex-chars>" | \
  gcloud secrets create SETTINGS_ENCRYPTION_KEY \
    --data-file=- \
    --replication-policy=automatic

# Grant the Cloud Run service account read access
gcloud secrets add-iam-policy-binding SETTINGS_ENCRYPTION_KEY \
  --member="serviceAccount:<SA>@<PROJECT>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

In your Cloud Run service definition, reference the secret as an environment variable:

```yaml
# cloud-run-service.yaml (or via --set-secrets in gcloud deploy)
env:
  - name: SETTINGS_ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: SETTINGS_ENCRYPTION_KEY
        key: latest
  - name: SETTINGS_KMS_PROVIDER
    value: "local"
```

The backend receives the SEK at startup via environment variable exactly as in the VPS case — Cloud Secret Manager is just the secure vault that holds it between deployments.

> **Future:** `SETTINGS_KMS_PROVIDER=gcp` (Phase 21+) will delegate encryption to Cloud KMS directly, removing the need to surface the raw SEK as an env var at all.

#### Railway

In the Railway dashboard, go to **Variables** for your backend service and add:

```
SETTINGS_ENCRYPTION_KEY = <your-64-hex-chars>
SETTINGS_KMS_PROVIDER   = local
```

Railway encrypts environment variables at rest and injects them into the container at runtime. Do not add these to any config file committed to your repo.

#### Render

In the Render dashboard, go to **Environment** for your backend web service and add the same two variables as secret environment values. Render stores them encrypted and never exposes them in logs.

#### Local development / GitHub Codespaces

Add to `backend/.env` (which is already gitignored):

```bash
SETTINGS_ENCRYPTION_KEY=<your-64-hex-chars>
SETTINGS_KMS_PROVIDER=local
```

On a fresh Codespace, the `.env` file is not persisted across rebuilds. Regenerate the SEK or store the value somewhere safe (a personal password manager works fine for dev keys) and paste it in at setup time.

---

### Step 3: Run the database migration

The ISM stores settings in the `site_settings` table, which is created by the standard Prisma migration. Ensure the migration has run before starting the application:

```bash
npx prisma migrate deploy
```

On first startup, `LocalKeyProvider` validates the SEK immediately. If the key is absent or the wrong length the application will refuse to start with a descriptive error — this is intentional.

---

### Step 4: Populate secrets

You have two options:

#### Option A — Enter via Admin Settings panel (recommended for fresh deployments)

Log into the backstage at `/admin`, navigate to **Settings → Email** and **Settings → Payment Providers**, enter your credentials, and save. The values are encrypted by the ISM before being written to the database.

**Resend SMTP settings** (recommended email provider — free tier):
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: your Resend API key
- From: `noreply@yourdomain.com` (must be a verified domain in Resend)

To migrate from HostGator/cPanel to Resend: add the DNS records Resend provides to verify your domain, then update these four fields in Admin Settings → Email. No code changes or redeploy required.

#### Option B — Migrate from an existing `.env` (for deployments that already have env-var secrets)

A migration script is included that reads all the recognised secret env vars from `.env`, encrypts them using the live SEK, and upserts them into `site_settings`:

```bash
cd backend
npx ts-node --project tsconfig.json scripts/migrate-env-to-ism.ts
```

The script is idempotent — re-running it overwrites the existing rows with freshly encrypted values. After running it successfully you can remove the plain-text secret lines from `.env` (keep the SEK and the non-secret vars).

The following env vars are migrated when present:

| Env var | ISM key |
|---|---|
| `SMTP_HOST` | `email.smtp_host` |
| `SMTP_PORT` | `email.smtp_port` |
| `SMTP_USER` | `email.smtp_user` |
| `SMTP_PASS` | `email.smtp_pass_enc` *(encrypted)* |
| `SMTP_FROM` | `email.from_address` |
| `STRIPE_SECRET_KEY` | `payment.stripe_secret_key_enc` *(encrypted)* |
| `STRIPE_PUBLISHABLE_KEY` | `payment.stripe_publishable_key` |
| `STRIPE_WEBHOOK_SECRET` | `payment.stripe_webhook_secret_enc` *(encrypted)* |
| `PAYPAL_CLIENT_ID` | `payment.paypal_client_id` |
| `PAYPAL_CLIENT_SECRET` | `payment.paypal_client_secret_enc` *(encrypted)* |

---

### Step 5: Verify

In the Admin Settings panel:

- **Email tab** → click **Send Test Email**. You should receive a message at the owner account's address.
- **Payment Providers tab** → click **Verify Connection** for Stripe and for PayPal. Both should show a green ✅.

If a verify check fails, the most common causes are:

1. The SEK in the environment does not match the one used to encrypt the stored values (key mismatch after a Codespace rebuild or accidental regeneration).
2. The credential itself is wrong — re-enter it through the Admin Settings panel.
3. The database migration hasn't run yet and the `site_settings` table doesn't exist — run `npx prisma migrate deploy`.

---

### Key rotation (future)

Key rotation — re-encrypting all `_enc` rows under a new SEK — is not yet automated. If you need to rotate the SEK before the Phase 21 tooling is available, the safe manual procedure is:

1. Re-enter all secrets through the Admin Settings panel while the old SEK is still active (this overwrites the stored ciphertexts).
2. Replace the SEK in your secrets vault with the new value.
3. Restart the backend so `LocalKeyProvider` picks up the new key.

The stored values are now encrypted under the new SEK. The old SEK can be retired.

---

## External Storage Manager (ESM) Setup

The ESM handles all binary file storage (uploaded media, digital product files, the site favicon). By default it uses the local filesystem, which works for single-server VPS deployments. For cloud hosting (where container filesystems are ephemeral) or for multi-server setups, configure a cloud storage provider.

### Step 1: Choose a provider

Set `STORAGE_PROVIDER_TYPE` in your backend environment:

| Value | Use when |
|---|---|
| `local` | Single VPS, Docker Compose, local dev — files persist on the host filesystem |
| `gcs` | Google Cloud Run or any GCS deployment |
| `s3` | AWS, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, MinIO, or any S3-compatible service |

```bash
# Example
STORAGE_PROVIDER_TYPE=gcs   # or s3, or local
```

> **Note:** Changing `STORAGE_PROVIDER_TYPE` requires a backend restart. Provider credentials can be updated via Admin Settings without a restart.

---

### Step 2: Create buckets

Cloud providers need two buckets — one public (media) and one private (digital files).

#### Google Cloud Storage

```bash
# Create buckets
gsutil mb -l us-central1 gs://YOUR-SITE-media
gsutil mb -l us-central1 gs://YOUR-SITE-digital

# Make the media bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://YOUR-SITE-media

# Grant the Cloud Run service account access
gsutil iam ch serviceAccount:SA@PROJECT.iam.gserviceaccount.com:objectAdmin gs://YOUR-SITE-media
gsutil iam ch serviceAccount:SA@PROJECT.iam.gserviceaccount.com:objectAdmin gs://YOUR-SITE-digital
```

No service account JSON is needed when running on Cloud Run with Workload Identity — the SDK discovers credentials automatically. Leave `storage.gcs_credentials_json_enc` blank in Admin Settings.

#### S3 / S3-compatible

Create two buckets via the provider's console or CLI:
- Media bucket: configure public-read ACL or a public bucket policy
- Digital bucket: keep private (no public access)

For Cloudflare R2:
- Use the R2 dashboard to create two buckets
- Set the media bucket to public
- Note your account ID — the endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

For Backblaze B2:
- Create two buckets (one public, one private)
- Endpoint: `https://s3.<REGION>.backblazeb2.com`

---

### Step 3: Enter credentials via Admin Settings

Once the backend is running with the correct `STORAGE_PROVIDER_TYPE`, log in to the backstage and go to **Settings → File Storage**:

1. Confirm the provider selector shows the correct provider
2. Enter the bucket names, region, and credentials
3. Click **Save Changes**
4. Click **Test Storage Connection** — it runs a write/read/delete round-trip and reports pass/fail

Provider credentials are stored encrypted in the ISM (same AES-256-GCM scheme as payment keys). The `STORAGE_PROVIDER_TYPE` itself is the only value that must remain in the environment.

#### GCS fields

| Field | ISM key | Notes |
|---|---|---|
| Media Bucket | `storage.gcs_bucket_media` | Public bucket name |
| Digital Bucket | `storage.gcs_bucket_digital` | Private bucket name |
| GCP Project ID | `storage.gcs_project_id` | Optional with Workload Identity |
| Service Account JSON | `storage.gcs_credentials_json_enc` | Leave blank on Cloud Run |

#### S3 fields

| Field | ISM key | Notes |
|---|---|---|
| Media Bucket | `storage.s3_bucket_media` | Public bucket name |
| Digital Bucket | `storage.s3_bucket_digital` | Private bucket name |
| Region | `storage.s3_region` | e.g. `us-east-1` |
| Endpoint URL | `storage.s3_endpoint` | Required for R2/B2/Spaces; leave blank for AWS |
| Access Key ID | `storage.s3_access_key_id` | |
| Secret Access Key | `storage.s3_secret_access_key_enc` | Encrypted at rest |

#### CDN Base URL (optional, any cloud provider)

If you have a CDN in front of the media bucket (Cloudflare CDN, CloudFront, Cloud CDN), set `storage.cdn_base_url` to the CDN origin. Public media URLs will use the CDN prefix instead of the direct bucket URL.

---

### Step 4: Migrate existing local files (if moving from local to cloud)

If you have an existing deployment with files in the local `uploads/` directory, copy them to the new cloud buckets:

```bash
# GCS — copy all existing uploads to media bucket
gsutil -m cp -r /path/to/uploads/* gs://YOUR-SITE-media/

# S3 / R2 — using the AWS CLI (works for most S3-compatible providers with --endpoint-url)
aws s3 sync /path/to/uploads/ s3://YOUR-SITE-media/ --endpoint-url https://...

# Update media records in the database to reflect the new storage key format
# New uploads go through the ESM and are stored as relative paths (e.g. "photo.jpg")
# Legacy records have absolute paths ("/app/uploads/photo.jpg") — the ESM handles both
```

After migration, the ESM reads credentials lazily, so existing records with absolute paths continue to resolve correctly via the legacy code path in `MediaService`.

---

## SSL/TLS Configuration

### Option 1: Nginx Reverse Proxy with Let's Encrypt (Recommended)

Create an Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/aecms
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # File upload size limit
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Stripe webhook - no body size limit
    location /payments/stripe/webhook {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and install certificates:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aecms /etc/nginx/sites-enabled/

# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Test renewal
sudo certbot renew --dry-run
```

### Option 2: Traefik (Docker-native)

Add Traefik to your docker-compose.prod.yml:

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: aecms-traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - aecms-network

  backend:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=4000"

  frontend:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

volumes:
  traefik_letsencrypt:
    driver: local
```

### Option 3: Cloudflare Proxy

If using Cloudflare:

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Create Origin Certificates in Cloudflare dashboard
4. Configure Nginx to use Cloudflare origin certificates
5. Enable Cloudflare proxy (orange cloud) for your DNS records

---

## Database Migration

### Initial Setup

```bash
# Start only the database
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U aecms

# Run migrations
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Seed initial data (creates owner account)
docker compose -f docker-compose.prod.yml run --rm backend npx prisma db seed
```

### Change Default Passwords

After seeding, immediately change the default user passwords:

1. Log in as owner@aecms.local with Admin123!@#
2. Go to account settings
3. Change password to a strong, unique password
4. Enable 2FA for admin accounts

---

## Deployment Steps

### 1. Build Images

```bash
# Build production images
docker compose -f docker-compose.prod.yml build --no-cache
```

### 2. Start Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 3. Verify Deployment

```bash
# Check backend health
curl -f http://localhost:4000/ || echo "Backend not healthy"

# Check frontend
curl -f http://localhost:3000/ || echo "Frontend not healthy"

# Check all containers
docker compose -f docker-compose.prod.yml ps
```

### 4. Configure Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://api.yourdomain.com/payments/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
5. Restart backend to apply changes

### 5. Configure PayPal Webhooks

1. Go to PayPal Developer Dashboard > My Apps & Credentials
2. Select your live app
3. Add webhook URL: `https://api.yourdomain.com/payments/paypal/webhook`
4. Subscribe to events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`

---

## Post-Deployment

### DNS Configuration

Ensure these DNS records are configured:

| Type | Name | Value |
|------|------|-------|
| A | @ | Your server IP |
| A | api | Your server IP |
| CNAME | www | yourdomain.com |

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Security Hardening

1. **Disable root SSH login**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   sudo systemctl restart sshd
   ```

2. **Install fail2ban**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

3. **Enable automatic security updates**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure unattended-upgrades
   ```

---

## Backup Strategy

### Automated Database Backups

Create a backup script:

```bash
#!/bin/bash
# /home/aecms/AECMS/scripts/backup.sh

BACKUP_DIR="/home/aecms/AECMS/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
docker compose -f /home/aecms/AECMS/docker-compose.prod.yml exec -T postgres \
  pg_dump -U aecms aecms | gzip > "$BACKUP_DIR/aecms_$DATE.sql.gz"

# Delete backups older than retention period
find "$BACKUP_DIR" -name "aecms_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: aecms_$DATE.sql.gz"
```

Schedule with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/aecms/AECMS/scripts/backup.sh >> /home/aecms/AECMS/data/backups/backup.log 2>&1
```

### Restore from Backup

```bash
# Stop the application
docker compose -f docker-compose.prod.yml stop backend frontend

# Restore database
gunzip -c data/backups/aecms_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U aecms aecms

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### Backup Uploads

```bash
# Backup uploads volume
docker run --rm -v aecms_backend_uploads:/data -v $(pwd)/data/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

### Off-site Backups

Consider syncing backups to cloud storage:

```bash
# Using rclone to sync to S3/B2/GCS
rclone sync data/backups remote:aecms-backups
```

---

## Monitoring

### Basic Monitoring with Docker

```bash
# View container stats
docker stats

# View container logs
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Check disk usage
docker system df
```

### Health Check Endpoints

- Backend: `GET /` - Returns "Hello World!" when healthy
- Frontend: `GET /` - Returns 200 when healthy

### Recommended Monitoring Stack

For production monitoring, consider:

1. **Uptime Monitoring**: UptimeRobot, Pingdom, or Better Uptime
   - Monitor: `https://yourdomain.com`
   - Monitor: `https://api.yourdomain.com`

2. **Log Aggregation**: Grafana Loki, ELK Stack, or Papertrail
   ```bash
   # Example: Forward logs to Papertrail
   docker compose -f docker-compose.prod.yml logs -f | \
     nc logs.papertrailapp.com PORT
   ```

3. **Metrics**: Prometheus + Grafana
   - Container metrics via cAdvisor
   - Node metrics via node_exporter

4. **Error Tracking**: Sentry
   - Add to backend: `@sentry/node`
   - Add to frontend: `@sentry/nextjs`

### Alert Configuration

Set up alerts for:
- Container restarts
- High CPU/memory usage (>80%)
- Disk space low (<20% free)
- Health check failures
- Error rate spikes

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check container status
docker compose -f docker-compose.prod.yml ps

# Inspect container
docker inspect aecms-backend-prod
```

#### Database Connection Failed

```bash
# Verify postgres is running
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U aecms

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL format
echo $DATABASE_URL
```

#### Frontend Can't Reach Backend

```bash
# Check network connectivity
docker compose -f docker-compose.prod.yml exec frontend wget -qO- http://backend:4000/

# Verify NEXT_PUBLIC_API_URL is set correctly
docker compose -f docker-compose.prod.yml exec frontend env | grep API
```

#### SSL Certificate Issues

```bash
# Test certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Renew Let's Encrypt
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### Maintenance Commands

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart single service
docker compose -f docker-compose.prod.yml restart backend

# Update images and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Clean up unused resources
docker system prune -af

# View resource usage
docker stats --no-stream
```

### Rolling Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart with zero downtime
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --no-deps backend
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
```

---

## Quick Reference

### Start Production

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Stop Production

```bash
docker compose -f docker-compose.prod.yml down
```

### View Logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Create Backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U aecms aecms > backup.sql
```

### Access Database Shell

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U aecms aecms
```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/AECMS/issues
- Documentation: https://github.com/your-org/AECMS/docs
