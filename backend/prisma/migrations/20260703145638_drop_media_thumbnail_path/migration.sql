/*
  Warnings:

  - You are about to drop the column `thumbnail_path` on the `media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "media" DROP COLUMN "thumbnail_path";

-- AlterTable
ALTER TABLE "user_addresses" ALTER COLUMN "updated_at" DROP DEFAULT;
