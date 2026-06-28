-- Step 11 Deploy 2: drop plaintext order PII columns (backfill verified complete)
ALTER TABLE "orders" DROP COLUMN "customer_name";
ALTER TABLE "orders" DROP COLUMN "shipping_name";
ALTER TABLE "orders" DROP COLUMN "shipping_address";
ALTER TABLE "orders" DROP COLUMN "shipping_city";
ALTER TABLE "orders" DROP COLUMN "shipping_zip";
