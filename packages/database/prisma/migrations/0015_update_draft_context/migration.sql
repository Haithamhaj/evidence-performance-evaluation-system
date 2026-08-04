ALTER TABLE "StructuredUpdateDraftRevision"
ADD COLUMN "documentationNeeds" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "relatedProgressComponentIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
