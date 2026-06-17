-- Phase 17: Add alias_type to domain_aliases
ALTER TABLE "domain_aliases"
  ADD COLUMN IF NOT EXISTS "alias_type" TEXT NOT NULL DEFAULT 'redirect';
