ALTER TABLE "VoiceUpdateSession"
  ADD COLUMN "transcriptionAttemptToken" UUID,
  ADD COLUMN "transcriptionAttemptStartedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "VoiceUpdateSession"
SET "transcriptionAttemptToken" = gen_random_uuid()
WHERE "transcriptionAttemptToken" IS NULL;

ALTER TABLE "VoiceUpdateSession"
  ALTER COLUMN "transcriptionAttemptToken" SET NOT NULL;
