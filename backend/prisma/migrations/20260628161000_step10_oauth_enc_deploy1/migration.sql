-- Step 10 Deploy 1: add encrypted OAuth token columns (dual-write; old columns kept for backfill)
ALTER TABLE "oauth_accounts" ADD COLUMN "access_token_enc" TEXT;
ALTER TABLE "oauth_accounts" ADD COLUMN "refresh_token_enc" TEXT;
