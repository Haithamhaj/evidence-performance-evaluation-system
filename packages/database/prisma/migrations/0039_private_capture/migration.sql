-- Private, unclassified capture sources are intentionally separate from project/workstream documents.
CREATE TYPE "PrivateCaptureSourceType" AS ENUM ('text', 'link', 'code', 'file', 'image');

ALTER TABLE "PrivateInboxItem"
  ADD COLUMN "sourceType" "PrivateCaptureSourceType" NOT NULL DEFAULT 'text',
  ADD COLUMN "sourceUploadId" UUID;

ALTER TABLE "PrivateInboxItem"
  ADD CONSTRAINT "PrivateInboxItem_source_upload_check"
  CHECK (
    ("sourceType" IN ('file', 'image') AND "sourceUploadId" IS NOT NULL)
    OR ("sourceType" NOT IN ('file', 'image') AND "sourceUploadId" IS NULL)
  );

CREATE TABLE "PrivateCaptureUpload" (
  "id" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "detectedType" TEXT NOT NULL,
  "detectedMime" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateCaptureUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateCaptureUpload_objectKey_key" UNIQUE ("objectKey"),
  CONSTRAINT "PrivateCaptureUpload_metadata_check" CHECK (
    length(btrim("originalFilename")) BETWEEN 1 AND 255
    AND length(btrim("objectKey")) BETWEEN 1 AND 1000
    AND length(btrim("detectedType")) BETWEEN 1 AND 100
    AND length(btrim("detectedMime")) BETWEEN 1 AND 200
    AND "byteSize" BETWEEN 1 AND 2147483647
    AND "sha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE INDEX "PrivateCaptureUpload_ownerId_createdAt_id_idx"
  ON "PrivateCaptureUpload"("ownerId", "createdAt" DESC, "id");

ALTER TABLE "PrivateCaptureUpload"
  ADD CONSTRAINT "PrivateCaptureUpload_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
