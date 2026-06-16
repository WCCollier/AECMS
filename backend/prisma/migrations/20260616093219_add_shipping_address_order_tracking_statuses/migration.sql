-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'scheduled';
ALTER TYPE "OrderStatus" ADD VALUE 'shipped';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_note" TEXT,
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "tracking_carrier" TEXT,
ADD COLUMN     "tracking_number" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_country" TEXT,
ADD COLUMN     "shipping_postal_code" TEXT,
ADD COLUMN     "shipping_state" TEXT,
ADD COLUMN     "shipping_street" TEXT;
