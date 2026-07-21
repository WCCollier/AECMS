-- CreateTable
CREATE TABLE "substack_sync_records" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "substack_draft_id" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "substack_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "substack_sync_records_article_id_key" ON "substack_sync_records"("article_id");

-- AddForeignKey
ALTER TABLE "substack_sync_records" ADD CONSTRAINT "substack_sync_records_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
