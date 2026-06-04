-- AlterTable
ALTER TABLE "capabilities" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'backstage';

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "session_type" TEXT NOT NULL DEFAULT 'customer';

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_session_type_idx" ON "refresh_tokens"("user_id", "session_type");
