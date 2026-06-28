-- Step 14: Drop legacy users.shipping_* columns (Step 4 stopped all writes; reads migrated to user_addresses)
ALTER TABLE "users" DROP COLUMN IF EXISTS "shipping_street";
ALTER TABLE "users" DROP COLUMN IF EXISTS "shipping_city";
ALTER TABLE "users" DROP COLUMN IF EXISTS "shipping_state";
ALTER TABLE "users" DROP COLUMN IF EXISTS "shipping_postal_code";
ALTER TABLE "users" DROP COLUMN IF EXISTS "shipping_country";
