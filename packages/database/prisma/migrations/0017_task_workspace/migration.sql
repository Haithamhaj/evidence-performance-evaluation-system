-- CreateEnum
CREATE TYPE "PrivateInboxStatus" AS ENUM ('open', 'promoted', 'dismissed');

-- CreateTable
CREATE TABLE "WorkItemChecklistItem" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkItemChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateInboxItem" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "projectId" UUID,
    "status" "PrivateInboxStatus" NOT NULL DEFAULT 'open',
    "promotedWorkItemId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrivateInboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemChecklistItem_workItemId_position_key"
ON "WorkItemChecklistItem"("workItemId", "position");

-- CreateIndex
CREATE INDEX "WorkItemChecklistItem_workItemId_completed_position_idx"
ON "WorkItemChecklistItem"("workItemId", "completed", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateInboxItem_promotedWorkItemId_key"
ON "PrivateInboxItem"("promotedWorkItemId");

-- CreateIndex
CREATE INDEX "PrivateInboxItem_employeeId_status_createdAt_id_idx"
ON "PrivateInboxItem"("employeeId", "status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "PrivateInboxItem_projectId_status_createdAt_idx"
ON "PrivateInboxItem"("projectId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WorkItemChecklistItem"
ADD CONSTRAINT "WorkItemChecklistItem_workItemId_fkey"
FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateInboxItem"
ADD CONSTRAINT "PrivateInboxItem_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateInboxItem"
ADD CONSTRAINT "PrivateInboxItem_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateInboxItem"
ADD CONSTRAINT "PrivateInboxItem_promotedWorkItemId_fkey"
FOREIGN KEY ("promotedWorkItemId") REFERENCES "WorkItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bounded workspace constraints
ALTER TABLE "WorkItemChecklistItem"
ADD CONSTRAINT "WorkItemChecklistItem_position_nonnegative"
CHECK ("position" >= 0),
ADD CONSTRAINT "WorkItemChecklistItem_text_bounded"
CHECK (char_length(btrim("text")) BETWEEN 1 AND 500);

ALTER TABLE "PrivateInboxItem"
ADD CONSTRAINT "PrivateInboxItem_text_bounded"
CHECK (char_length(btrim("text")) BETWEEN 1 AND 4000),
ADD CONSTRAINT "PrivateInboxItem_version_positive"
CHECK ("version" > 0),
ADD CONSTRAINT "PrivateInboxItem_promotion_matches_status"
CHECK (
  ("status" = 'promoted' AND "promotedWorkItemId" IS NOT NULL)
  OR
  ("status" <> 'promoted' AND "promotedWorkItemId" IS NULL)
);
