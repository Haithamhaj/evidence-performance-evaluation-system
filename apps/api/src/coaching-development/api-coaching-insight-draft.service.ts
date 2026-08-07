/* eslint-disable no-unused-vars */
import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { AppError } from "@evaluation/contracts";
import {
  CoachingInsightAiService,
  CoachingDevelopmentPersistence,
  COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
  COACHING_INSIGHT_PROMPT_VERSION,
  qualifyCoachingFacts,
} from "@evaluation/coaching-development";
import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";

export class ApiCoachingInsightDraftService {
  constructor(
    private readonly database: import("@evaluation/database").DatabaseClient,
    private readonly facts: EvaluationFactViewService,
    private readonly persistence: CoachingDevelopmentPersistence,
  ) {}
  async draft(input: Readonly<{ actorId: string; assignmentId: string }>) {
    const assignment = await this.database.evaluationAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { cycle: { include: { snapshot: true } } },
    });
    if (
      !assignment ||
      assignment.employeeId !== input.actorId ||
      assignment.cycle.snapshot === null
    )
      throw new AppError("AUTHZ_SCOPE", "errors.coaching.invalid", 403);
    const view = await this.facts.read({
      cycle: {
        id: assignment.cycle.id,
        startsAt: assignment.cycle.startsAt.toISOString(),
        endsAt: assignment.cycle.endsAt.toISOString(),
        rubricVersionId: assignment.cycle.snapshot.rubricVersionId,
      },
      subjectEmployeeId: input.actorId,
      requester: {
        actorId: input.actorId,
        subjectEmployeeId: input.actorId,
        access: "self",
        active: true,
      },
    });
    const facts = qualifyCoachingFacts(
      [...view.confirmedEvidence, ...view.projectFacts, ...view.researchFacts]
        .slice(0, 100)
        .map((fact) => ({
          sourceId: fact.sourceId,
          kind: "EVALUATION_FACT" as const,
          text: JSON.stringify(fact),
        })),
    );
    if (facts.length === 0)
      throw new AppError("COACHING_MANUAL_RECOVERY_REQUIRED", "errors.coaching.aiUnavailable", 503);
    const router = createDeferredRuntimeAiRouter(() =>
      createRuntimeAiRouter({
        database: this.database,
        secretResolver: new EnvironmentAiCredentialSecretResolver(),
      }),
    );
    const result = await new CoachingInsightAiService(router, {
      read: (routeKey, version) =>
        this.database.analysisPromptArtifact.findUnique({
          where: { routeKey_version: { routeKey, version } },
          select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
        }),
    }).draft({
      employeeId: input.actorId,
      departmentId: assignment.cycle.departmentId,
      systemId: await resolveSystemAiScopeId(this.database, "coaching.insight"),
      period: {
        startsAt: assignment.cycle.startsAt.toISOString(),
        endsAt: assignment.cycle.endsAt.toISOString(),
      },
      facts,
    });
    return this.persistence.createInsight({
      employeeId: input.actorId,
      state:
        result.confidence === "REVIEW_REQUIRED" || result.confidence === "LIMITED"
          ? "REVIEW_REQUIRED"
          : "DRAFT",
      pattern: result.pattern,
      periodStartsAt: assignment.cycle.startsAt.toISOString(),
      periodEndsAt: assignment.cycle.endsAt.toISOString(),
      confidence: result.confidence,
      confidenceBasis: result.confidenceBasis,
      limitations: result.limitations,
      conflicts: result.conflicts,
      cannotConclude: result.cannotConclude,
      actionDraft: result.actionDraft,
      promptVersion: COACHING_INSIGHT_PROMPT_VERSION,
      outputSchemaVersion: COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
      aiRunId: result.aiRunId,
      sources: facts
        .filter((fact) => result.sourceIds.includes(fact.sourceId))
        .map(({ sourceId, kind }) => ({ sourceId, kind })),
    });
  }
}
