-- Step 12 Deploy 2: drop plaintext name columns (backfill verified complete)
ALTER TABLE "users" DROP COLUMN "first_name";
ALTER TABLE "users" DROP COLUMN "last_name";
