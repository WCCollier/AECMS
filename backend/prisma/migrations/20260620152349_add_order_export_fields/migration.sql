-- DropIndex
DROP INDEX "pages_slug_idx";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "product_title" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refund_amount" DECIMAL(10,2),
ADD COLUMN     "refund_id" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMP(3);
