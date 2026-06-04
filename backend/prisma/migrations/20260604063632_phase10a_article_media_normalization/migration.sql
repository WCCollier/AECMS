/*
  Warnings:

  - You are about to drop the column `featured_image_id` on the `articles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_featured_image_id_fkey";

-- AlterTable
ALTER TABLE "article_media" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "featured_image_id";
