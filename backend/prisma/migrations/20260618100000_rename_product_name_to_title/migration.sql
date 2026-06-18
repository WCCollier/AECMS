-- Rename product.name → product.title (and product_versions.name → title)
-- Using RENAME COLUMN so existing data is preserved in-place.

ALTER TABLE "products" RENAME COLUMN "name" TO "title";
ALTER TABLE "product_versions" RENAME COLUMN "name" TO "title";
