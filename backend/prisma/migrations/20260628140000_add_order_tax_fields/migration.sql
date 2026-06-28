-- AlterTable: add actual tax collected fields to orders
ALTER TABLE "orders" ADD COLUMN "tax_amount" INTEGER;
ALTER TABLE "orders" ADD COLUMN "tax_details" JSONB;
