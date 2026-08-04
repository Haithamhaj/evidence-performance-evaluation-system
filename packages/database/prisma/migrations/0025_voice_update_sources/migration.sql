ALTER TYPE "UpdateSourceAttachmentKind" ADD VALUE 'voice_transcript';

CREATE TYPE "VoiceUpdateSessionState" AS ENUM ('transcribing', 'transcript_ready', 'transcript_confirmed', 'cancelled', 'failed');
CREATE TYPE "VoiceTranscriptRevisionOrigin" AS ENUM ('ai', 'employee');

CREATE TABLE "VoiceUpdateSession" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "workstreamId" UUID,
  "workItemId" UUID,
  "employeeId" UUID NOT NULL,
  "uploadedSourceId" UUID NOT NULL,
  "state" "VoiceUpdateSessionState" NOT NULL,
  "declaredDurationSeconds" INTEGER NOT NULL,
  "language" TEXT,
  "dialect" TEXT,
  "aiRunId" UUID,
  "retentionPolicyKey" TEXT NOT NULL,
  "retentionMetadata" JSONB NOT NULL,
  "temporaryArtifactsCleanedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceUpdateSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceUpdateSession_duration" CHECK ("declaredDurationSeconds" BETWEEN 1 AND 14400),
  CONSTRAINT "VoiceUpdateSession_retention_policy" CHECK (length(btrim("retentionPolicyKey")) > 0)
);
CREATE UNIQUE INDEX "VoiceUpdateSession_idempotencyKey_key" ON "VoiceUpdateSession"("idempotencyKey");
CREATE INDEX "VoiceUpdateSession_employeeId_createdAt_idx" ON "VoiceUpdateSession"("employeeId", "createdAt");
CREATE INDEX "VoiceUpdateSession_projectId_workstreamId_createdAt_idx" ON "VoiceUpdateSession"("projectId", "workstreamId", "createdAt");

CREATE TABLE "VoiceTranscriptRevision" (
  "id" UUID NOT NULL, "voiceSessionId" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "origin" "VoiceTranscriptRevisionOrigin" NOT NULL, "transcript" TEXT NOT NULL,
  "language" TEXT NOT NULL, "dialect" TEXT NOT NULL, "aiRunId" UUID, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceTranscriptRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceTranscriptRevision_revision" CHECK ("revision" > 0),
  CONSTRAINT "VoiceTranscriptRevision_transcript" CHECK (length(btrim("transcript")) BETWEEN 1 AND 50000),
  CONSTRAINT "VoiceTranscriptRevision_voiceSessionId_revision_key" UNIQUE ("voiceSessionId", "revision")
);
CREATE TABLE "VoiceTranscriptConfirmation" (
  "id" UUID NOT NULL, "voiceSessionId" UUID NOT NULL, "transcriptRevisionId" UUID NOT NULL,
  "employeeId" UUID NOT NULL, "reason" TEXT NOT NULL, "confirmedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceTranscriptConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceTranscriptConfirmation_voiceSessionId_key" UNIQUE ("voiceSessionId"),
  CONSTRAINT "VoiceTranscriptConfirmation_transcriptRevisionId_key" UNIQUE ("transcriptRevisionId")
);

ALTER TABLE "UpdateSourceAttachment" ADD COLUMN "voiceSessionId" UUID;
ALTER TABLE "UpdateSourceAttachment" DROP CONSTRAINT "UpdateSourceAttachment_exactly_one_representation";
ALTER TABLE "UpdateSourceAttachment" DROP CONSTRAINT "UpdateSourceAttachment_kind_representation";
ALTER TABLE "UpdateSourceAttachment" ADD CONSTRAINT "UpdateSourceAttachment_exactly_one_representation" CHECK (("uploadedSourceId" IS NOT NULL)::int + ("content" IS NOT NULL)::int + ("sourceUrl" IS NOT NULL)::int + ("voiceSessionId" IS NOT NULL)::int = 1);
ALTER TABLE "UpdateSourceAttachment" ADD CONSTRAINT "UpdateSourceAttachment_kind_representation" CHECK (("kind" IN ('image','screenshot','file','document') AND "uploadedSourceId" IS NOT NULL) OR ("kind" IN ('pasted_text','pasted_code','cli_snapshot','github_snapshot') AND length(btrim("content")) BETWEEN 1 AND 100000) OR ("kind" = 'url' AND length(btrim("sourceUrl")) BETWEEN 1 AND 2000) OR ("kind" = 'voice_transcript' AND "voiceSessionId" IS NOT NULL));

ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_uploadedSourceId_fkey" FOREIGN KEY ("uploadedSourceId") REFERENCES "UploadedSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceUpdateSession" ADD CONSTRAINT "VoiceUpdateSession_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceTranscriptRevision" ADD CONSTRAINT "VoiceTranscriptRevision_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceUpdateSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceTranscriptRevision" ADD CONSTRAINT "VoiceTranscriptRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceTranscriptConfirmation" ADD CONSTRAINT "VoiceTranscriptConfirmation_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceUpdateSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceTranscriptConfirmation" ADD CONSTRAINT "VoiceTranscriptConfirmation_transcriptRevisionId_fkey" FOREIGN KEY ("transcriptRevisionId") REFERENCES "VoiceTranscriptRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceTranscriptConfirmation" ADD CONSTRAINT "VoiceTranscriptConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpdateSourceAttachment" ADD CONSTRAINT "UpdateSourceAttachment_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceUpdateSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_voice_history_mutation"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Voice transcript history is immutable' USING ERRCODE = '23514'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "VoiceTranscriptRevision_append_only" BEFORE UPDATE OR DELETE ON "VoiceTranscriptRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_voice_history_mutation"();
CREATE TRIGGER "VoiceTranscriptConfirmation_append_only" BEFORE UPDATE OR DELETE ON "VoiceTranscriptConfirmation" FOR EACH ROW EXECUTE FUNCTION "prevent_voice_history_mutation"();
