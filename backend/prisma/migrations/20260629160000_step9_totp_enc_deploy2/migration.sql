-- Step 9 Deploy 2: drop plaintext totp_secret (backfill verified complete)
ALTER TABLE "users" DROP COLUMN "totp_secret";
