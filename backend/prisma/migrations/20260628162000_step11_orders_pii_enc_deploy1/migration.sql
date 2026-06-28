-- Step 11 Deploy 1: add encrypted order PII columns (dual-write; old columns kept for backfill)
ALTER TABLE "orders" ADD COLUMN "customer_name_enc" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_name_enc" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_address_enc" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_city_enc" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipping_zip_enc" TEXT;
