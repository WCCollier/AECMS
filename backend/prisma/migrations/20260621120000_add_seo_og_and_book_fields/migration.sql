-- Phase 26: SEO toolkit — OG image fields on all content types, book metadata on products

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "og_image_url" TEXT;
ALTER TABLE "pages"    ADD COLUMN IF NOT EXISTS "og_image_url" TEXT;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "og_image_url"     TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isbn"             TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "book_format"      TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "page_count"       INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publisher"        TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "amazon_url"       TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "goodreads_url"    TEXT;
