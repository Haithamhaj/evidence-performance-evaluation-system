-- CreateEnum
CREATE TYPE "ContextIntelligenceReviewStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'CORRECTED',
  'REJECTED',
  'SUPERSEDED'
);

-- CreateEnum
CREATE TYPE "ContextIntelligenceRevisionOrigin" AS ENUM ('AI', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProjectLinkDecision" AS ENUM ('AUTO_LINK', 'REVIEW', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "SourceLinkCorrectionAction" AS ENUM ('CORRECT', 'REJECT');

-- CreateTable
CREATE TABLE "ContextAnalysis" (
  "id" UUID NOT NULL,
  "sourceItemId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "aiRunTraceId" UUID NOT NULL,
  "outputCiphertext" TEXT NOT NULL,
  "outputKeyVersion" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "reviewStatus" "ContextIntelligenceReviewStatus" NOT NULL DEFAULT 'PENDING',
  "revisionOrigin" "ContextIntelligenceRevisionOrigin" NOT NULL,
  "correctionReasonCiphertext" TEXT,
  "correctionReasonKeyVersion" TEXT,
  "supersedesAnalysisId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContextAnalysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContextAnalysis_positive_revision" CHECK ("revision" > 0),
  CONSTRAINT "ContextAnalysis_versioned_lineage" CHECK (
    ("revision" = 1 AND "supersedesAnalysisId" IS NULL)
    OR ("revision" > 1 AND "supersedesAnalysisId" IS NOT NULL)
  ),
  CONSTRAINT "ContextAnalysis_version_tags" CHECK (
    char_length(btrim("schemaVersion")) BETWEEN 3 AND 160
    AND char_length(btrim("promptVersion")) BETWEEN 3 AND 160
  ),
  CONSTRAINT "ContextAnalysis_output_protected" CHECK (
    char_length(btrim("outputCiphertext")) BETWEEN 1 AND 60000
    AND char_length(btrim("outputKeyVersion")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "ContextAnalysis_nonempty_sources" CHECK (
    jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") > 0
  ),
  CONSTRAINT "ContextAnalysis_employee_revision" CHECK (
    (
      "revisionOrigin" = 'AI'
      AND "correctionReasonCiphertext" IS NULL
      AND "correctionReasonKeyVersion" IS NULL
    )
    OR (
      "revisionOrigin" = 'EMPLOYEE'
      AND "createdById" = "employeeId"
      AND "correctionReasonCiphertext" IS NOT NULL
      AND char_length(btrim("correctionReasonCiphertext")) BETWEEN 1 AND 20000
      AND "correctionReasonKeyVersion" IS NOT NULL
      AND char_length(btrim("correctionReasonKeyVersion")) BETWEEN 1 AND 200
    )
  )
);

-- CreateTable
CREATE TABLE "ProjectLinkSuggestion" (
  "id" UUID NOT NULL,
  "analysisId" UUID NOT NULL,
  "sourceItemId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "projectId" UUID,
  "decision" "ProjectLinkDecision" NOT NULL,
  "explanationCiphertext" TEXT NOT NULL,
  "explanationKeyVersion" TEXT NOT NULL,
  "anchors" JSONB NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "aiRunTraceId" UUID NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "reviewStatus" "ContextIntelligenceReviewStatus" NOT NULL DEFAULT 'PENDING',
  "revisionOrigin" "ContextIntelligenceRevisionOrigin" NOT NULL,
  "correctionReasonCiphertext" TEXT,
  "correctionReasonKeyVersion" TEXT,
  "supersedesSuggestionId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectLinkSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectLinkSuggestion_positive_revision" CHECK ("revision" > 0),
  CONSTRAINT "ProjectLinkSuggestion_versioned_lineage" CHECK (
    ("revision" = 1 AND "supersedesSuggestionId" IS NULL)
    OR ("revision" > 1 AND "supersedesSuggestionId" IS NOT NULL)
  ),
  CONSTRAINT "ProjectLinkSuggestion_version_tags" CHECK (
    char_length(btrim("schemaVersion")) BETWEEN 3 AND 160
    AND char_length(btrim("promptVersion")) BETWEEN 3 AND 160
  ),
  CONSTRAINT "ProjectLinkSuggestion_explanation_protected" CHECK (
    char_length(btrim("explanationCiphertext")) BETWEEN 1 AND 40000
    AND char_length(btrim("explanationKeyVersion")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "ProjectLinkSuggestion_anchor_array" CHECK (
    jsonb_typeof("anchors") = 'array'
  ),
  CONSTRAINT "ProjectLinkSuggestion_auto_link_anchors" CHECK (
    "decision" <> 'AUTO_LINK'
    OR (
      "projectId" IS NOT NULL
      AND jsonb_typeof("anchors") = 'array'
      AND (
        "anchors" @? '$[*] ? (@.kind == "EXPLICIT_USER_MAPPING" && @.conflicts == false)'
        OR (
          jsonb_array_length("anchors") >= 2
          AND NOT "anchors" @? '$[*] ? (@.conflicts == true)'
        )
      )
    )
  ),
  CONSTRAINT "ProjectLinkSuggestion_nonempty_sources" CHECK (
    jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") > 0
  ),
  CONSTRAINT "ProjectLinkSuggestion_employee_revision" CHECK (
    (
      "revisionOrigin" = 'AI'
      AND "correctionReasonCiphertext" IS NULL
      AND "correctionReasonKeyVersion" IS NULL
    )
    OR (
      "revisionOrigin" = 'EMPLOYEE'
      AND "createdById" = "employeeId"
      AND "correctionReasonCiphertext" IS NOT NULL
      AND char_length(btrim("correctionReasonCiphertext")) BETWEEN 1 AND 20000
      AND "correctionReasonKeyVersion" IS NOT NULL
      AND char_length(btrim("correctionReasonKeyVersion")) BETWEEN 1 AND 200
    )
  )
);

-- CreateTable
CREATE TABLE "TaskDraft" (
  "id" UUID NOT NULL,
  "sourceItemId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "draftCiphertext" TEXT NOT NULL,
  "draftKeyVersion" TEXT NOT NULL,
  "projectId" UUID,
  "workstreamId" UUID,
  "proposedAssigneeId" UUID,
  "dueAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "aiRunTraceId" UUID NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "reviewStatus" "ContextIntelligenceReviewStatus" NOT NULL DEFAULT 'PENDING',
  "revisionOrigin" "ContextIntelligenceRevisionOrigin" NOT NULL,
  "correctionReasonCiphertext" TEXT,
  "correctionReasonKeyVersion" TEXT,
  "supersedesTaskDraftId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskDraft_positive_revision" CHECK ("revision" > 0),
  CONSTRAINT "TaskDraft_versioned_lineage" CHECK (
    ("revision" = 1 AND "supersedesTaskDraftId" IS NULL)
    OR ("revision" > 1 AND "supersedesTaskDraftId" IS NOT NULL)
  ),
  CONSTRAINT "TaskDraft_version_tags" CHECK (
    char_length(btrim("schemaVersion")) BETWEEN 3 AND 160
    AND char_length(btrim("promptVersion")) BETWEEN 3 AND 160
  ),
  CONSTRAINT "TaskDraft_payload_protected" CHECK (
    char_length(btrim("draftCiphertext")) BETWEEN 1 AND 100000
    AND char_length(btrim("draftKeyVersion")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "TaskDraft_workstream_requires_project" CHECK (
    "workstreamId" IS NULL OR "projectId" IS NOT NULL
  ),
  CONSTRAINT "TaskDraft_nonempty_sources" CHECK (
    jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") > 0
  ),
  CONSTRAINT "TaskDraft_employee_revision" CHECK (
    (
      "revisionOrigin" = 'AI'
      AND "correctionReasonCiphertext" IS NULL
      AND "correctionReasonKeyVersion" IS NULL
    )
    OR (
      "revisionOrigin" = 'EMPLOYEE'
      AND "createdById" = "employeeId"
      AND "correctionReasonCiphertext" IS NOT NULL
      AND char_length(btrim("correctionReasonCiphertext")) BETWEEN 1 AND 20000
      AND "correctionReasonKeyVersion" IS NOT NULL
      AND char_length(btrim("correctionReasonKeyVersion")) BETWEEN 1 AND 200
    )
  )
);

-- CreateTable
CREATE TABLE "SourceLinkCorrection" (
  "id" UUID NOT NULL,
  "suggestionId" UUID NOT NULL,
  "sourceItemId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "previousProjectId" UUID,
  "correctedProjectId" UUID,
  "action" "SourceLinkCorrectionAction" NOT NULL,
  "reasonCiphertext" TEXT NOT NULL,
  "reasonKeyVersion" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "supersedingSuggestionId" UUID,
  "correctedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SourceLinkCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SourceLinkCorrection_employee_owned" CHECK (
    "correctedById" = "employeeId"
  ),
  CONSTRAINT "SourceLinkCorrection_reason_protected" CHECK (
    char_length(btrim("reasonCiphertext")) BETWEEN 1 AND 20000
    AND char_length(btrim("reasonKeyVersion")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "SourceLinkCorrection_nonempty_sources" CHECK (
    jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") > 0
  ),
  CONSTRAINT "SourceLinkCorrection_action_shape" CHECK (
    (
      "action" = 'CORRECT'
      AND "correctedProjectId" IS NOT NULL
      AND "supersedingSuggestionId" IS NOT NULL
    )
    OR (
      "action" = 'REJECT'
      AND "correctedProjectId" IS NULL
    )
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "ContextAnalysis_supersedesAnalysisId_key"
ON "ContextAnalysis"("supersedesAnalysisId");
CREATE UNIQUE INDEX "ContextAnalysis_id_sourceItemId_employeeId_key"
ON "ContextAnalysis"("id", "sourceItemId", "employeeId");
CREATE UNIQUE INDEX "ContextAnalysis_sourceItemId_employeeId_revision_key"
ON "ContextAnalysis"("sourceItemId", "employeeId", "revision");
CREATE UNIQUE INDEX "ContextAnalysis_supersedesAnalysisId_sourceItemId_employeeI_key"
ON "ContextAnalysis"("supersedesAnalysisId", "sourceItemId", "employeeId");
CREATE INDEX "ContextAnalysis_employeeId_reviewStatus_createdAt_idx"
ON "ContextAnalysis"("employeeId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "ContextAnalysis_aiRunTraceId_idx" ON "ContextAnalysis"("aiRunTraceId");
CREATE INDEX "ContextAnalysis_createdById_createdAt_idx"
ON "ContextAnalysis"("createdById", "createdAt");

CREATE UNIQUE INDEX "ProjectLinkSuggestion_supersedesSuggestionId_key"
ON "ProjectLinkSuggestion"("supersedesSuggestionId");
CREATE UNIQUE INDEX "ProjectLinkSuggestion_id_sourceItemId_employeeId_key"
ON "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId");
CREATE UNIQUE INDEX "ProjectLinkSuggestion_sourceItemId_employeeId_revision_key"
ON "ProjectLinkSuggestion"("sourceItemId", "employeeId", "revision");
CREATE UNIQUE INDEX "ProjectLinkSuggestion_supersedesSuggestionId_sourceItemId_e_key"
ON "ProjectLinkSuggestion"("supersedesSuggestionId", "sourceItemId", "employeeId");
CREATE INDEX "ProjectLinkSuggestion_employeeId_reviewStatus_createdAt_idx"
ON "ProjectLinkSuggestion"("employeeId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "ProjectLinkSuggestion_projectId_reviewStatus_createdAt_idx"
ON "ProjectLinkSuggestion"("projectId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "ProjectLinkSuggestion_analysisId_idx" ON "ProjectLinkSuggestion"("analysisId");
CREATE INDEX "ProjectLinkSuggestion_aiRunTraceId_idx"
ON "ProjectLinkSuggestion"("aiRunTraceId");
CREATE INDEX "ProjectLinkSuggestion_createdById_createdAt_idx"
ON "ProjectLinkSuggestion"("createdById", "createdAt");

CREATE UNIQUE INDEX "TaskDraft_supersedesTaskDraftId_key"
ON "TaskDraft"("supersedesTaskDraftId");
CREATE UNIQUE INDEX "TaskDraft_id_sourceItemId_employeeId_key"
ON "TaskDraft"("id", "sourceItemId", "employeeId");
CREATE UNIQUE INDEX "TaskDraft_sourceItemId_employeeId_revision_key"
ON "TaskDraft"("sourceItemId", "employeeId", "revision");
CREATE UNIQUE INDEX "TaskDraft_supersedesTaskDraftId_sourceItemId_employeeId_key"
ON "TaskDraft"("supersedesTaskDraftId", "sourceItemId", "employeeId");
CREATE INDEX "TaskDraft_employeeId_reviewStatus_createdAt_idx"
ON "TaskDraft"("employeeId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "TaskDraft_projectId_reviewStatus_createdAt_idx"
ON "TaskDraft"("projectId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "TaskDraft_workstreamId_reviewStatus_createdAt_idx"
ON "TaskDraft"("workstreamId", "reviewStatus", "createdAt" DESC);
CREATE INDEX "TaskDraft_aiRunTraceId_idx" ON "TaskDraft"("aiRunTraceId");
CREATE INDEX "TaskDraft_createdById_createdAt_idx"
ON "TaskDraft"("createdById", "createdAt");

CREATE UNIQUE INDEX "SourceLinkCorrection_supersedingSuggestionId_key"
ON "SourceLinkCorrection"("supersedingSuggestionId");
CREATE INDEX "SourceLinkCorrection_employeeId_createdAt_idx"
ON "SourceLinkCorrection"("employeeId", "createdAt" DESC);
CREATE INDEX "SourceLinkCorrection_suggestionId_createdAt_idx"
ON "SourceLinkCorrection"("suggestionId", "createdAt");
CREATE INDEX "SourceLinkCorrection_correctedProjectId_createdAt_idx"
ON "SourceLinkCorrection"("correctedProjectId", "createdAt" DESC);

-- Preserve every analysis, suggestion, draft, and employee correction as append-only history.
CREATE FUNCTION "guard_context_intelligence_history"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% history is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ContextAnalysis_guard_update"
BEFORE UPDATE ON "ContextAnalysis"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "ContextAnalysis_guard_delete"
BEFORE DELETE ON "ContextAnalysis"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "ProjectLinkSuggestion_guard_update"
BEFORE UPDATE ON "ProjectLinkSuggestion"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "ProjectLinkSuggestion_guard_delete"
BEFORE DELETE ON "ProjectLinkSuggestion"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "TaskDraft_guard_update"
BEFORE UPDATE ON "TaskDraft"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "TaskDraft_guard_delete"
BEFORE DELETE ON "TaskDraft"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "SourceLinkCorrection_guard_update"
BEFORE UPDATE ON "SourceLinkCorrection"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();
CREATE TRIGGER "SourceLinkCorrection_guard_delete"
BEFORE DELETE ON "SourceLinkCorrection"
FOR EACH ROW EXECUTE FUNCTION "guard_context_intelligence_history"();

-- Restrictive foreign keys preserve source ownership, AI route trace, and revision lineage.
ALTER TABLE "ContextAnalysis"
ADD CONSTRAINT "ContextAnalysis_sourceItemId_employeeId_fkey"
FOREIGN KEY ("sourceItemId", "employeeId")
REFERENCES "ConnectedSourceItem"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ContextAnalysis_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ContextAnalysis_aiRunTraceId_fkey"
FOREIGN KEY ("aiRunTraceId") REFERENCES "AiRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ContextAnalysis_supersedesAnalysisId_sourceItemId_employee_fkey"
FOREIGN KEY ("supersedesAnalysisId", "sourceItemId", "employeeId")
REFERENCES "ContextAnalysis"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ContextAnalysis_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectLinkSuggestion"
ADD CONSTRAINT "ProjectLinkSuggestion_analysisId_sourceItemId_employeeId_fkey"
FOREIGN KEY ("analysisId", "sourceItemId", "employeeId")
REFERENCES "ContextAnalysis"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_sourceItemId_employeeId_fkey"
FOREIGN KEY ("sourceItemId", "employeeId")
REFERENCES "ConnectedSourceItem"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_aiRunTraceId_fkey"
FOREIGN KEY ("aiRunTraceId") REFERENCES "AiRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_supersedesSuggestionId_sourceItemId__fkey"
FOREIGN KEY ("supersedesSuggestionId", "sourceItemId", "employeeId")
REFERENCES "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectLinkSuggestion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskDraft"
ADD CONSTRAINT "TaskDraft_sourceItemId_employeeId_fkey"
FOREIGN KEY ("sourceItemId", "employeeId")
REFERENCES "ConnectedSourceItem"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_workstreamId_projectId_fkey"
FOREIGN KEY ("workstreamId", "projectId")
REFERENCES "Workstream"("id", "projectId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_proposedAssigneeId_fkey"
FOREIGN KEY ("proposedAssigneeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_aiRunTraceId_fkey"
FOREIGN KEY ("aiRunTraceId") REFERENCES "AiRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_supersedesTaskDraftId_sourceItemId_employeeId_fkey"
FOREIGN KEY ("supersedesTaskDraftId", "sourceItemId", "employeeId")
REFERENCES "TaskDraft"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "TaskDraft_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SourceLinkCorrection"
ADD CONSTRAINT "SourceLinkCorrection_suggestionId_sourceItemId_employeeId_fkey"
FOREIGN KEY ("suggestionId", "sourceItemId", "employeeId")
REFERENCES "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceLinkCorrection_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceLinkCorrection_previousProjectId_fkey"
FOREIGN KEY ("previousProjectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceLinkCorrection_correctedProjectId_fkey"
FOREIGN KEY ("correctedProjectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceLinkCorrection_supersedingSuggestionId_sourceItemId__fkey"
FOREIGN KEY ("supersedingSuggestionId", "sourceItemId", "employeeId")
REFERENCES "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceLinkCorrection_correctedById_fkey"
FOREIGN KEY ("correctedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
