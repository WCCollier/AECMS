-- FR-003 Deploy 2: drop the legacy role enum column from users + role_capabilities,
-- and drop the UserRole enum type. role_name is now the sole source of truth.

-- Drop index on the old role column (if it exists)
DROP INDEX IF EXISTS "users_role_idx";

-- Drop the legacy role columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "role_capabilities" DROP COLUMN IF EXISTS "role";

-- Drop the enum type (no longer referenced by any table)
DROP TYPE IF EXISTS "UserRole";
