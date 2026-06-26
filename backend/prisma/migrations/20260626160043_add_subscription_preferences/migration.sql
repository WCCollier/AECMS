-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscribe_new_articles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscribe_new_products" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscribe_news_alerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unsubscribe_token" TEXT;
