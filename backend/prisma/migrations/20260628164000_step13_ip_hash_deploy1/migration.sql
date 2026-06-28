-- Step 13 Deploy 1: add IP hash columns (dual-write; old columns kept for backfill)
ALTER TABLE "users" ADD COLUMN "last_login_ip_hash" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address_hash" TEXT;
