-- Step 13 Deploy 2: drop plaintext IP columns (backfill verified complete)
ALTER TABLE "users" DROP COLUMN "last_login_ip";
ALTER TABLE "refresh_tokens" DROP COLUMN "ip_address";
