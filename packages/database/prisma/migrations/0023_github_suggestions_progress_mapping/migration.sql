-- The GitHub source event remains immutable. These additions retain the smallest
-- durable provenance link for employee-reviewed evidence and contract-owned rules.
CREATE TYPE "GitHubGovernedEventKind" AS ENUM ('pull_request', 'commit', 'check', 'deployment');
CREATE TYPE "GitHubGovernedAcceptanceState" AS ENUM (
  'open', 'closed', 'merged', 'created', 'queued', 'in_progress', 'success', 'failure', 'cancelled', 'inactive'
);
CREATE TYPE "GitHubProgressReviewDisposition" AS ENUM ('matched', 'no_match', 'ambiguous');

ALTER TABLE "EvidenceRecord"
ADD COLUMN "githubSourceEventId" UUID;

ALTER TABLE "EvidenceRecord"
ADD CONSTRAINT "EvidenceRecord_githubSourceEventId_fkey"
FOREIGN KEY ("githubSourceEventId") REFERENCES "GitHubSourceEvent"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "EvidenceRecord_githubSourceEventId_idx"
ON "EvidenceRecord"("githubSourceEventId");

CREATE UNIQUE INDEX "ProgressContract_id_contractVersion_key"
ON "ProgressContract"("id", "contractVersion");

CREATE TABLE "GitHubContractRule" (
  "id" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "contractVersion" INTEGER NOT NULL,
  "componentId" UUID NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventKind" "GitHubGovernedEventKind" NOT NULL,
  "acceptanceState" "GitHubGovernedAcceptanceState" NOT NULL,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GitHubContractRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubContractRule_source_identity_check" CHECK (
    char_length(btrim("sourceId")) BETWEEN 1 AND 500
    AND ("expiresAt" IS NULL OR "effectiveAt" < "expiresAt")
  )
);

ALTER TABLE "GitHubContractRule"
ADD CONSTRAINT "GitHubContractRule_bindingId_fkey"
FOREIGN KEY ("bindingId") REFERENCES "GitHubProjectBinding"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GitHubContractRule"
ADD CONSTRAINT "GitHubContractRule_contractId_contractVersion_fkey"
FOREIGN KEY ("contractId", "contractVersion") REFERENCES "ProgressContract"("id", "contractVersion")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GitHubContractRule"
ADD CONSTRAINT "GitHubContractRule_componentId_contractId_fkey"
FOREIGN KEY ("componentId", "contractId") REFERENCES "ProgressContractComponent"("id", "contractId")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GitHubContractRule_unique_identity"
ON "GitHubContractRule"(
  "bindingId", "contractId", "componentId", "sourceId", "eventKind", "acceptanceState", "effectiveAt"
);
CREATE INDEX "GitHubContractRule_binding_contract_effective_idx"
ON "GitHubContractRule"("bindingId", "contractId", "contractVersion", "effectiveAt");
CREATE INDEX "GitHubContractRule_contract_component_effective_idx"
ON "GitHubContractRule"("contractId", "componentId", "effectiveAt");
CREATE UNIQUE INDEX "GitHubContractRule_id_binding_contract_version_key"
ON "GitHubContractRule"("id", "bindingId", "contractId", "contractVersion");

CREATE TABLE "GitHubProgressReview" (
  "id" UUID NOT NULL,
  "sourceEventId" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "contractId" UUID,
  "contractVersion" INTEGER,
  "evaluationSequence" INTEGER NOT NULL,
  "disposition" "GitHubProgressReviewDisposition" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GitHubProgressReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubProgressReview_contract_pair_check" CHECK (
    ("contractId" IS NULL) = ("contractVersion" IS NULL)
  )
);

ALTER TABLE "GitHubProgressReview"
ADD CONSTRAINT "GitHubProgressReview_sourceEventId_fkey"
FOREIGN KEY ("sourceEventId") REFERENCES "GitHubSourceEvent"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GitHubProgressReview"
ADD CONSTRAINT "GitHubProgressReview_bindingId_fkey"
FOREIGN KEY ("bindingId") REFERENCES "GitHubProjectBinding"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GitHubProgressReview"
ADD CONSTRAINT "GitHubProgressReview_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GitHubProgressReview"
ADD CONSTRAINT "GitHubProgressReview_contractId_contractVersion_fkey"
FOREIGN KEY ("contractId", "contractVersion") REFERENCES "ProgressContract"("id", "contractVersion")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GitHubProgressReview_source_sequence_key"
ON "GitHubProgressReview"("sourceEventId", "evaluationSequence");
CREATE UNIQUE INDEX "GitHubProgressReview_id_source_binding_project_key"
ON "GitHubProgressReview"("id", "sourceEventId", "bindingId", "projectId");
CREATE INDEX "GitHubProgressReview_project_time_idx"
ON "GitHubProgressReview"("projectId", "createdAt" DESC, "id");
CREATE INDEX "GitHubProgressReview_binding_time_idx"
ON "GitHubProgressReview"("bindingId", "createdAt" DESC, "id");

CREATE TABLE "GitHubProgressReviewCandidate" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "sourceEventId" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "contractVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GitHubProgressReviewCandidate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GitHubProgressReviewCandidate"
ADD CONSTRAINT "GitHubProgressReviewCandidate_review_scope_fkey"
FOREIGN KEY ("reviewId", "sourceEventId", "bindingId", "projectId")
REFERENCES "GitHubProgressReview"("id", "sourceEventId", "bindingId", "projectId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GitHubProgressReviewCandidate"
ADD CONSTRAINT "GitHubProgressReviewCandidate_rule_scope_fkey"
FOREIGN KEY ("ruleId", "bindingId", "contractId", "contractVersion")
REFERENCES "GitHubContractRule"("id", "bindingId", "contractId", "contractVersion")
ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "GitHubProgressReviewCandidate_review_rule_key"
ON "GitHubProgressReviewCandidate"("reviewId", "ruleId");
CREATE INDEX "GitHubProgressReviewCandidate_source_time_idx"
ON "GitHubProgressReviewCandidate"("sourceEventId", "createdAt" DESC, "id");

CREATE FUNCTION "validate_github_contract_rule_scope"() RETURNS trigger AS $$
DECLARE
  binding_project_id UUID;
  contract_project_id UUID;
BEGIN
  SELECT "projectId" INTO binding_project_id FROM "GitHubProjectBinding" WHERE "id" = NEW."bindingId";
  SELECT "projectId" INTO contract_project_id FROM "ProgressContract" WHERE "id" = NEW."contractId";
  IF binding_project_id IS NULL OR contract_project_id IS NULL OR binding_project_id <> contract_project_id THEN
    RAISE EXCEPTION 'GitHubContractRule must bind a rule within one Project' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GitHubContractRule_validate_scope"
BEFORE INSERT OR UPDATE ON "GitHubContractRule"
FOR EACH ROW EXECUTE FUNCTION "validate_github_contract_rule_scope"();

CREATE FUNCTION "validate_github_progress_review_scope"() RETURNS trigger AS $$
DECLARE
  event_binding_id UUID;
  binding_project_id UUID;
  contract_project_id UUID;
BEGIN
  SELECT "bindingId" INTO event_binding_id FROM "GitHubSourceEvent" WHERE "id" = NEW."sourceEventId";
  SELECT "projectId" INTO binding_project_id FROM "GitHubProjectBinding" WHERE "id" = NEW."bindingId";
  SELECT "projectId" INTO contract_project_id FROM "ProgressContract" WHERE "id" = NEW."contractId";
  IF event_binding_id IS NULL OR binding_project_id IS NULL
    OR event_binding_id <> NEW."bindingId" OR binding_project_id <> NEW."projectId" THEN
    RAISE EXCEPTION 'GitHubProgressReview must retain its source event binding and Project' USING ERRCODE = '23514';
  END IF;
  IF NEW."contractId" IS NOT NULL
    AND (contract_project_id IS NULL OR contract_project_id <> NEW."projectId") THEN
    RAISE EXCEPTION 'GitHubProgressReview contract must belong to its Project' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GitHubProgressReview_validate_scope"
BEFORE INSERT OR UPDATE ON "GitHubProgressReview"
FOR EACH ROW EXECUTE FUNCTION "validate_github_progress_review_scope"();

CREATE FUNCTION "validate_github_progress_review_candidate_scope"() RETURNS trigger AS $$
DECLARE
  review_contract_id UUID;
  review_contract_version INTEGER;
BEGIN
  SELECT "contractId", "contractVersion"
  INTO review_contract_id, review_contract_version
  FROM "GitHubProgressReview"
  WHERE "id" = NEW."reviewId"
    AND "sourceEventId" = NEW."sourceEventId"
    AND "bindingId" = NEW."bindingId"
    AND "projectId" = NEW."projectId";
  IF review_contract_id IS NULL
    OR review_contract_id <> NEW."contractId"
    OR review_contract_version <> NEW."contractVersion" THEN
    RAISE EXCEPTION 'GitHubProgressReviewCandidate must retain the review contract scope'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GitHubProgressReviewCandidate_validate_scope"
BEFORE INSERT OR UPDATE ON "GitHubProgressReviewCandidate"
FOR EACH ROW EXECUTE FUNCTION "validate_github_progress_review_candidate_scope"();

CREATE FUNCTION "prevent_github_contract_rule_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GitHubContractRule records are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GitHubContractRule_guard_history"
BEFORE UPDATE OR DELETE ON "GitHubContractRule"
FOR EACH ROW EXECUTE FUNCTION "prevent_github_contract_rule_mutation"();

CREATE FUNCTION "prevent_github_progress_review_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GitHubProgressReview records are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GitHubProgressReview_guard_history"
BEFORE UPDATE OR DELETE ON "GitHubProgressReview"
FOR EACH ROW EXECUTE FUNCTION "prevent_github_progress_review_mutation"();

CREATE FUNCTION "prevent_github_progress_review_candidate_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GitHubProgressReviewCandidate records are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GitHubProgressReviewCandidate_guard_history"
BEFORE UPDATE OR DELETE ON "GitHubProgressReviewCandidate"
FOR EACH ROW EXECUTE FUNCTION "prevent_github_progress_review_candidate_mutation"();

CREATE FUNCTION "guard_evidence_github_source_event"() RETURNS trigger AS $$
DECLARE
  source_project_id UUID;
  source_state "GitHubEventVerificationState";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."githubSourceEventId" IS DISTINCT FROM OLD."githubSourceEventId" THEN
    RAISE EXCEPTION 'EvidenceRecord GitHub source provenance is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."githubSourceEventId" IS NOT NULL THEN
    SELECT binding."projectId", event."verificationState"
    INTO source_project_id, source_state
    FROM "GitHubSourceEvent" event
    JOIN "GitHubProjectBinding" binding ON binding."id" = event."bindingId"
    WHERE event."id" = NEW."githubSourceEventId";
    IF source_project_id IS NULL OR source_project_id <> NEW."projectId" OR source_state <> 'VERIFIED' THEN
      RAISE EXCEPTION 'EvidenceRecord requires a verified GitHub source event from the same Project'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "EvidenceRecord_guard_github_source_event"
BEFORE INSERT OR UPDATE ON "EvidenceRecord"
FOR EACH ROW EXECUTE FUNCTION "guard_evidence_github_source_event"();
