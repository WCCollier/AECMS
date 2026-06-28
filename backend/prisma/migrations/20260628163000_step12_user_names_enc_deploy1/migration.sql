-- Step 12 Deploy 1: add encrypted user name columns (dual-write; old columns kept for backfill)
ALTER TABLE "users" ADD COLUMN "first_name_enc" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name_enc" TEXT;
