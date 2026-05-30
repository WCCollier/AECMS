/*
  Warnings:

  - You are about to drop the column `author_email` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `author_name` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the `product_reviews` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `user_id` on table `comments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_user_id_fkey";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "author_email",
DROP COLUMN "author_name",
ADD COLUMN     "title" TEXT,
ADD COLUMN     "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "user_id" SET NOT NULL;

-- DropTable
DROP TABLE "product_reviews";

-- CreateTable
CREATE TABLE "comment_ratings" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "comment_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_ratings_comment_id_idx" ON "comment_ratings"("comment_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_ratings" ADD CONSTRAINT "comment_ratings_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
