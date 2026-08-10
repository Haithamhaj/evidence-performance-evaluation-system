BEGIN;

ALTER TABLE "ExportRequest"
  ADD COLUMN "generationToken" UUID,
  ADD COLUMN "generationLeaseUntil" TIMESTAMPTZ(6);

ALTER TABLE "ExportManifest"
  ADD COLUMN "requesterId" UUID,
  ADD COLUMN "reportType" TEXT,
  ADD COLUMN "audience" TEXT,
  ADD COLUMN "format" TEXT,
  ADD COLUMN "locale" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "cycleId" UUID,
  ADD COLUMN "renderAt" TIMESTAMPTZ(6);

ALTER TABLE "ExportManifest" DISABLE TRIGGER "ExportManifest_append_only";

UPDATE "ExportManifest" AS manifest
SET
  "requesterId" = request."requesterId",
  "reportType" = request."reportType",
  "audience" = request."audience",
  "format" = request."format",
  "locale" = request."locale",
  "timezone" = request."timezone",
  "cycleId" = request."cycleId",
  "renderAt" = request."createdAt"
FROM "ExportRequest" AS request
WHERE request."id" = manifest."requestId";

ALTER TABLE "ExportManifest" ENABLE TRIGGER "ExportManifest_append_only";

ALTER TABLE "ExportManifest"
  ALTER COLUMN "requesterId" SET NOT NULL,
  ALTER COLUMN "reportType" SET NOT NULL,
  ALTER COLUMN "audience" SET NOT NULL,
  ALTER COLUMN "format" SET NOT NULL,
  ALTER COLUMN "locale" SET NOT NULL,
  ALTER COLUMN "timezone" SET NOT NULL,
  ALTER COLUMN "renderAt" SET NOT NULL;

ALTER TABLE "ExportManifest"
  ADD CONSTRAINT "ExportManifest_format_check" CHECK ("format" IN ('HTML', 'PDF')),
  ADD CONSTRAINT "ExportManifest_locale_check" CHECK ("locale" IN ('en', 'ar'));

CREATE INDEX "ExportRequest_generationLeaseUntil_idx"
  ON "ExportRequest"("state", "generationLeaseUntil");

COMMIT;
