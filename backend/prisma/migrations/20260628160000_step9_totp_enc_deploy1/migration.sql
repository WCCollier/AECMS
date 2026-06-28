-- Step 9 Deploy 1: add encrypted TOTP column (dual-write; old column kept for backfill)
ALTER TABLE "users" ADD COLUMN "totp_secret_enc" TEXT;
