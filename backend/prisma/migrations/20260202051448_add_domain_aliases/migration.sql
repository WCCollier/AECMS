-- CreateTable
CREATE TABLE "domain_aliases" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "target_route" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verified_at" TIMESTAMP(3),
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_aliases_domain_key" ON "domain_aliases"("domain");

-- CreateIndex
CREATE INDEX "domain_aliases_domain_idx" ON "domain_aliases"("domain");

-- CreateIndex
CREATE INDEX "domain_aliases_owner_id_idx" ON "domain_aliases"("owner_id");

-- AddForeignKey
ALTER TABLE "domain_aliases" ADD CONSTRAINT "domain_aliases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
