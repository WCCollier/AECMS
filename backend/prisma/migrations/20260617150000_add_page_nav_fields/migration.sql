-- Phase 16: Add nav_order and show_in_nav to pages table
-- Also changes slug uniqueness from global @unique to per-sibling (parent_id, slug)

-- Drop the old global unique index on slug
DROP INDEX IF EXISTS "pages_slug_key";

-- Add new navigation fields
ALTER TABLE "pages"
  ADD COLUMN IF NOT EXISTS "show_in_nav" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "nav_order" INTEGER NOT NULL DEFAULT 0;

-- Add per-sibling uniqueness constraint
-- Note: two pages can share a slug as long as they have different parents (or one has no parent)
-- We use NULLS NOT DISTINCT so (NULL, 'contact') conflicts with another (NULL, 'contact')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pages_parent_id_slug_key'
  ) THEN
    ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_slug_key"
      UNIQUE NULLS NOT DISTINCT ("parent_id", "slug");
  END IF;
END $$;
