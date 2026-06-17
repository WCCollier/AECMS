-- AlterTable
ALTER TABLE "digital_downloads" ADD COLUMN     "kindle_send_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "digital_product_files" ADD COLUMN     "personalization_tested" BOOLEAN NOT NULL DEFAULT false;
