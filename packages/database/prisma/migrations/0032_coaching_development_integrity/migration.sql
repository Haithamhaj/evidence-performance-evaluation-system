ALTER TABLE "DevelopmentActionRevision" ADD COLUMN "idempotencyKey" UUID;
ALTER TABLE "FormalDevelopmentPlan" ADD COLUMN "idempotencyKey" UUID;
ALTER TABLE "FormalDevelopmentPlanRevision" ADD COLUMN "idempotencyKey" UUID;

CREATE UNIQUE INDEX "DevelopmentActionRevision_idempotencyKey_key" ON "DevelopmentActionRevision"("idempotencyKey");
CREATE UNIQUE INDEX "FormalDevelopmentPlan_idempotencyKey_key" ON "FormalDevelopmentPlan"("idempotencyKey");
CREATE UNIQUE INDEX "FormalDevelopmentPlanRevision_idempotencyKey_key" ON "FormalDevelopmentPlanRevision"("idempotencyKey");
CREATE UNIQUE INDEX "CoachingInsightRevision_id_insightId_key" ON "CoachingInsightRevision"("id", "insightId");
CREATE UNIQUE INDEX "CoachingInsight_currentRevisionId_id_key" ON "CoachingInsight"("currentRevisionId", "id");
CREATE UNIQUE INDEX "DevelopmentActionRevision_id_actionId_key" ON "DevelopmentActionRevision"("id", "actionId");
CREATE UNIQUE INDEX "DevelopmentAction_currentRevisionId_id_key" ON "DevelopmentAction"("currentRevisionId", "id");
CREATE UNIQUE INDEX "FormalDevelopmentPlanRevision_id_planId_key" ON "FormalDevelopmentPlanRevision"("id", "planId");
CREATE UNIQUE INDEX "FormalDevelopmentPlan_currentRevisionId_id_key" ON "FormalDevelopmentPlan"("currentRevisionId", "id");
CREATE UNIQUE INDEX "CoachingInsightDecision_insightId_resultingVersion_key" ON "CoachingInsightDecision"("insightId", "resultingVersion");
CREATE UNIQUE INDEX "DevelopmentActionTransition_actionId_resultingVersion_key" ON "DevelopmentActionTransition"("actionId", "resultingVersion");
CREATE UNIQUE INDEX "FormalDevelopmentPlanTransition_planId_resultingVersion_key" ON "FormalDevelopmentPlanTransition"("planId", "resultingVersion");

ALTER TABLE "CoachingInsight"
  ADD CONSTRAINT "CoachingInsight_currentRevisionId_id_fkey"
  FOREIGN KEY ("currentRevisionId", "id") REFERENCES "CoachingInsightRevision"("id", "insightId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "CoachingInsightSource"
  ADD CONSTRAINT "CoachingInsightSource_revisionId_insightId_fkey"
  FOREIGN KEY ("revisionId", "insightId") REFERENCES "CoachingInsightRevision"("id", "insightId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "CoachingInsightRevision"
  ADD CONSTRAINT "CoachingInsightRevision_aiRunId_fkey"
  FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "DevelopmentAction"
  ADD CONSTRAINT "DevelopmentAction_insightId_fkey"
  FOREIGN KEY ("insightId") REFERENCES "CoachingInsight"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "DevelopmentAction"
  ADD CONSTRAINT "DevelopmentAction_currentRevisionId_id_fkey"
  FOREIGN KEY ("currentRevisionId", "id") REFERENCES "DevelopmentActionRevision"("id", "actionId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "FormalDevelopmentPlan"
  ADD CONSTRAINT "FormalDevelopmentPlan_currentRevisionId_id_fkey"
  FOREIGN KEY ("currentRevisionId", "id") REFERENCES "FormalDevelopmentPlanRevision"("id", "planId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "FormalDevelopmentPlanAgreement"
  ADD CONSTRAINT "FormalDevelopmentPlanAgreement_revisionId_planId_fkey"
  FOREIGN KEY ("revisionId", "planId") REFERENCES "FormalDevelopmentPlanRevision"("id", "planId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "FormalDevelopmentPlanRevision"
  ADD CONSTRAINT "FormalDevelopmentPlanRevision_sourceEvaluationAssignmentId_fkey"
  FOREIGN KEY ("sourceEvaluationAssignmentId") REFERENCES "EvaluationAssignment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "FormalDevelopmentPlanEvidenceLink"
  ADD CONSTRAINT "FormalDevelopmentPlanEvidenceLink_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "FormalDevelopmentPlanEvidenceLink"
  ADD CONSTRAINT "FormalDevelopmentPlanEvidenceLink_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

CREATE OR REPLACE FUNCTION "reject_coaching_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'coaching development history is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "CoachingInsightRevision_append_only"
  BEFORE UPDATE OR DELETE ON "CoachingInsightRevision"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "CoachingInsightSource_append_only"
  BEFORE UPDATE OR DELETE ON "CoachingInsightSource"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "CoachingInsightDecision_append_only"
  BEFORE UPDATE OR DELETE ON "CoachingInsightDecision"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "DevelopmentActionRevision_append_only"
  BEFORE UPDATE OR DELETE ON "DevelopmentActionRevision"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "DevelopmentActionTransition_append_only"
  BEFORE UPDATE OR DELETE ON "DevelopmentActionTransition"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "ManagerSupportEntry_append_only"
  BEFORE UPDATE OR DELETE ON "ManagerSupportEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "FormalDevelopmentPlanRevision_append_only"
  BEFORE UPDATE OR DELETE ON "FormalDevelopmentPlanRevision"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "FormalDevelopmentPlanAgreement_append_only"
  BEFORE UPDATE OR DELETE ON "FormalDevelopmentPlanAgreement"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "FormalDevelopmentPlanTransition_append_only"
  BEFORE UPDATE OR DELETE ON "FormalDevelopmentPlanTransition"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
CREATE TRIGGER "FormalDevelopmentPlanEvidenceLink_append_only"
  BEFORE UPDATE OR DELETE ON "FormalDevelopmentPlanEvidenceLink"
  FOR EACH ROW EXECUTE FUNCTION "reject_coaching_history_mutation"();
