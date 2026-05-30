-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "product_id" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "author_id" TEXT,
ADD COLUMN     "compare_at_price" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "comments_product_id_idx" ON "comments"("product_id");

-- CreateIndex
CREATE INDEX "products_author_id_idx" ON "products"("author_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
