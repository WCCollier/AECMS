-- FR-003 Deploy 1: Add roles table and role_name columns
-- Additive only — no columns dropped; backward compatible with live code

-- CreateEnum
CREATE TYPE "RoleProtection" AS ENUM ('none', 'constrained', 'full');

-- CreateTable: roles
CREATE TABLE "roles" (
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "protection" "RoleProtection" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- Seed the 4 canonical roles
INSERT INTO "roles" ("name", "label", "protection", "created_at") VALUES
  ('owner',  'Owner',  'full',        NOW()),
  ('admin',  'Admin',  'none',        NOW()),
  ('member', 'Member', 'none',        NOW()),
  ('guest',  'Guest',  'constrained', NOW());

-- AlterTable users: add role_name column (default 'member'), then backfill from enum
ALTER TABLE "users" ADD COLUMN "role_name" TEXT NOT NULL DEFAULT 'member';
UPDATE "users" SET "role_name" = "role"::TEXT;

-- AlterTable role_capabilities: add role_name column (default 'admin'), then backfill
ALTER TABLE "role_capabilities" ADD COLUMN "role_name" TEXT NOT NULL DEFAULT 'admin';
UPDATE "role_capabilities" SET "role_name" = "role"::TEXT WHERE "role" IS NOT NULL;

-- Drop old unique constraint on (role, capability_id)
DROP INDEX IF EXISTS "role_capabilities_role_capability_id_key";

-- Make role nullable on role_capabilities (Deploy 2 will drop it entirely)
ALTER TABLE "role_capabilities" ALTER COLUMN "role" DROP NOT NULL;

-- Add new unique constraint on (role_name, capability_id)
CREATE UNIQUE INDEX "role_capabilities_role_name_capability_id_key" ON "role_capabilities"("role_name", "capability_id");

-- Add index on users.role_name
CREATE INDEX "users_role_name_idx" ON "users"("role_name");

-- AddForeignKey: users.role_name -> roles.name
ALTER TABLE "users" ADD CONSTRAINT "users_role_name_fkey" FOREIGN KEY ("role_name") REFERENCES "roles"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: role_capabilities.role_name -> roles.name
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_role_name_fkey" FOREIGN KEY ("role_name") REFERENCES "roles"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
