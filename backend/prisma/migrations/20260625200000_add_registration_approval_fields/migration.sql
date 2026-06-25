-- AddColumn: registration approval fields on users (additive, both nullable)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
