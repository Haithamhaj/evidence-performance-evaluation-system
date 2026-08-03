CREATE TYPE "UpdateSourceAttachmentKind" AS ENUM (
  'image', 'screenshot', 'file', 'document', 'pasted_text', 'pasted_code', 'cli_snapshot', 'url', 'github_snapshot'
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "UpdateSource" DROP CONSTRAINT "UpdateSource_raw_text_present";

CREATE TABLE "UpdateSourceAttachment" (
  "id" UUID NOT NULL,
  "updateSourceId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "kind" "UpdateSourceAttachmentKind" NOT NULL,
  "uploadedSourceId" UUID,
  "content" TEXT,
  "sourceUrl" TEXT,
  "checksumSha256" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UpdateSourceAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UpdateSourceAttachment_position_positive" CHECK ("position" > 0),
  CONSTRAINT "UpdateSourceAttachment_source_version_positive" CHECK ("sourceVersion" > 0),
  CONSTRAINT "UpdateSourceAttachment_checksum_sha256" CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "UpdateSourceAttachment_exactly_one_representation" CHECK (
    ("uploadedSourceId" IS NOT NULL)::int + ("content" IS NOT NULL)::int + ("sourceUrl" IS NOT NULL)::int = 1
  ),
  CONSTRAINT "UpdateSourceAttachment_kind_representation" CHECK (
    (
      "kind" IN ('image', 'screenshot', 'file', 'document')
      AND "uploadedSourceId" IS NOT NULL AND "content" IS NULL AND "sourceUrl" IS NULL
    ) OR (
      "kind" IN ('pasted_text', 'pasted_code', 'cli_snapshot', 'github_snapshot')
      AND "uploadedSourceId" IS NULL AND length(btrim("content")) BETWEEN 1 AND 100000 AND "sourceUrl" IS NULL
    ) OR (
      "kind" = 'url' AND "uploadedSourceId" IS NULL AND "content" IS NULL
      AND length(btrim("sourceUrl")) BETWEEN 1 AND 2000
    )
  )
);

ALTER TABLE "UpdateSourceAttachment"
ADD CONSTRAINT "UpdateSourceAttachment_updateSourceId_fkey"
FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpdateSourceAttachment"
ADD CONSTRAINT "UpdateSourceAttachment_uploadedSourceId_fkey"
FOREIGN KEY ("uploadedSourceId") REFERENCES "UploadedSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "UpdateSourceAttachment" (
  "id", "updateSourceId", "position", "kind", "content", "checksumSha256", "sourceVersion", "createdAt"
)
SELECT
  "id", "id", 1, 'pasted_text'::"UpdateSourceAttachmentKind", "rawText",
  encode(digest("rawText", 'sha256'), 'hex'), "sourceVersion", "createdAt"
FROM "UpdateSource";

CREATE UNIQUE INDEX "UpdateSourceAttachment_updateSourceId_position_key"
ON "UpdateSourceAttachment"("updateSourceId", "position");
CREATE INDEX "UpdateSourceAttachment_uploadedSourceId_idx" ON "UpdateSourceAttachment"("uploadedSourceId");
CREATE INDEX "UpdateSourceAttachment_updateSourceId_createdAt_idx"
ON "UpdateSourceAttachment"("updateSourceId", "createdAt");

CREATE FUNCTION "prevent_update_source_attachment_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UpdateSourceAttachment records are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "UpdateSourceAttachment_append_only"
BEFORE UPDATE OR DELETE ON "UpdateSourceAttachment"
FOR EACH ROW EXECUTE FUNCTION "prevent_update_source_attachment_mutation"();
