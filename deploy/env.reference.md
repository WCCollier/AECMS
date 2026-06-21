# AECMS Environment Variable Reference

All variables consumed by the backend container. Frontend variables are marked (frontend).

## Required on Every Install

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/aecms` |
| `REDIS_URL` | Redis connection string | `redis://default:pass@host:6379` |
| `JWT_SECRET` | Long random string for signing tokens | `openssl rand -hex 64` |
| `SETTINGS_ENCRYPTION_KEY` | AES-256 key for ISM encryption (local KMS) | `openssl rand -hex 32` |
| `NODE_ENV` | Runtime environment | `production` |
| `APP_URL` | Your site's public URL (no trailing slash) | `https://myblog.com` |
| `FRONTEND_URL` | Same as APP_URL unless split deployment | `https://myblog.com` |
| `API_URL` | Same as APP_URL (backend is served through same domain) | `https://myblog.com` |
| `FRONTEND_ADMIN_URL` | Admin URL | `https://myblog.com/admin` |

## Storage

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER_TYPE` | `local` | `local`, `gcs`, or `s3` |
| `STORAGE_PATH` | `/app/uploads` | Local storage path (local provider only) |
| `GCS_BUCKET_MEDIA` | — | GCS public media bucket name |
| `GCS_BUCKET_DIGITAL` | — | GCS private digital files bucket name |
| `GCS_PROJECT_ID` | — | GCP project ID (optional with Workload Identity) |
| `GCS_CREDENTIALS_JSON` | — | Service account JSON (optional with Workload Identity) |
| `S3_REGION` | `us-east-1` | S3 region |
| `S3_ENDPOINT` | — | S3-compatible endpoint URL (leave blank for AWS) |
| `S3_BUCKET_MEDIA` | — | S3 public media bucket name |
| `S3_BUCKET_DIGITAL` | — | S3 private digital files bucket name |
| `S3_ACCESS_KEY_ID` | — | S3 access key ID |
| `S3_SECRET_ACCESS_KEY` | — | S3 secret access key |
| `STORAGE_CDN_BASE_URL` | — | Optional CDN prefix for media URLs |

## Email (configure post-launch via Admin Settings → Email)

Email credentials do not need to be set before first launch. Configure them in **Admin Settings → Email** after the site is live and the setup wizard is complete.

| Variable | Default | Description |
|---|---|---|
| `EMAIL_PROVIDER_TYPE` | `smtp` | `smtp` or `console` (console = dev/test mode, no emails sent) |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURITY` | `starttls` | `starttls` or `ssl` |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | From address (e.g. `hello@myblog.com`) |
| `EMAIL_FROM_NAME` | — | From display name |
| `KINDLE_FROM_ADDRESS` | — | Kindle delivery sender (defaults to `SMTP_FROM` if unset) |

## Payments

| Variable | Description |
|---|---|
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...` or `pk_test_...`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `PAYPAL_MODE` | `sandbox` or `live` |
| `PAYPAL_CLIENT_ID` | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal app client secret |

## Auth & Tokens

| Variable | Default | Description |
|---|---|---|
| `JWT_EXPIRATION` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRATION` | `7d` | Refresh token lifetime |

## KMS (Key Management)

| Variable | Default | Description |
|---|---|---|
| `SETTINGS_KMS_PROVIDER` | `local` | `local` or `gcp` |
| `SETTINGS_ENCRYPTION_KEY` | — | Required when `SETTINGS_KMS_PROVIDER=local` |
| `GCP_PROJECT_ID` | — | Required when `SETTINGS_KMS_PROVIDER=gcp` |
| `SETTINGS_KMS_SECRET_ID` | `aecms-sek` | Secret Manager secret ID for the SEK |

## Frontend Variables (prefix `NEXT_PUBLIC_`)

| Variable | Description |
|---|---|
| `BACKEND_URL` | Backend container URL (internal or public) |
| `NEXT_PUBLIC_API_URL` | Backend URL visible to the browser |
| `NEXT_PUBLIC_BASE_DOMAIN` | Your domain (no https://) |
| `NEXT_PUBLIC_BASE_DOMAIN` | Your domain without `https://` |
