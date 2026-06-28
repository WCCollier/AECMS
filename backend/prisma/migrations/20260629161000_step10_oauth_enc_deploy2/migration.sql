-- Step 10 Deploy 2: drop plaintext OAuth token columns (backfill verified complete)
ALTER TABLE "oauth_accounts" DROP COLUMN "access_token";
ALTER TABLE "oauth_accounts" DROP COLUMN "refresh_token";
