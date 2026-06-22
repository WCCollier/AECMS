-- Data migration: promote every category to a tag, then wire up the join rows.
-- Categories table and join tables are left intact (dropped in Deploy 2).
-- All inserts are idempotent (ON CONFLICT DO NOTHING).

-- 1. Create a tag for each category (matched by slug; skip if already exists)
INSERT INTO tags (id, name, slug, created_at, updated_at)
SELECT
  gen_random_uuid(),
  name,
  slug,
  NOW(),
  NOW()
FROM categories
ON CONFLICT (slug) DO NOTHING;

-- 2. Wire articles to their category-derived tags
INSERT INTO article_tags (article_id, tag_id)
SELECT
  ac.article_id,
  t.id
FROM article_categories ac
JOIN categories c ON c.id = ac.category_id
JOIN tags t ON t.slug = c.slug
ON CONFLICT DO NOTHING;

-- 3. Wire products to their category-derived tags
INSERT INTO product_tags (product_id, tag_id)
SELECT
  pc.product_id,
  t.id
FROM product_categories pc
JOIN categories c ON c.id = pc.category_id
JOIN tags t ON t.slug = c.slug
ON CONFLICT DO NOTHING;
