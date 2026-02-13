-- CreateTable
CREATE TABLE "KitAccessRequest" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "resolvedById" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitAccessRequest_kitId_idx" ON "KitAccessRequest"("kitId");

-- CreateIndex
CREATE INDEX "KitAccessRequest_personId_idx" ON "KitAccessRequest"("personId");

-- CreateIndex
CREATE INDEX "KitAccessRequest_status_idx" ON "KitAccessRequest"("status");

-- AddForeignKey
ALTER TABLE "KitAccessRequest" ADD CONSTRAINT "KitAccessRequest_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAccessRequest" ADD CONSTRAINT "KitAccessRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAccessRequest" ADD CONSTRAINT "KitAccessRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
