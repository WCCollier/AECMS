-- AlterTable: add username to users
ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AlterTable: add customer_name to orders
ALTER TABLE "orders" ADD COLUMN "customer_name" TEXT;
