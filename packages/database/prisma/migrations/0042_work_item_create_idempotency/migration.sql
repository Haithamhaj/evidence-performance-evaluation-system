ALTER TABLE "WorkItem"
ADD COLUMN "clientRequestId" UUID;

CREATE UNIQUE INDEX "WorkItem_createdById_clientRequestId_key"
ON "WorkItem"("createdById", "clientRequestId");
