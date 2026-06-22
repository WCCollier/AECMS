-- Drop category join tables first (FK references categories), then the categories table itself.
-- All data was migrated to tags in migration 20260622100000_convert_categories_to_tags.
DROP TABLE IF EXISTS "article_categories";
DROP TABLE IF EXISTS "product_categories";
DROP TABLE IF EXISTS "categories";
