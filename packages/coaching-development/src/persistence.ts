import { AppError } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

/** Database-owned append-only persistence adapter for the Coaching & Development module. */
export class CoachingDevelopmentPersistence {
  constructor(private readonly database: Database) {}

  async findInsight(id: string) {
    return (await this.database.coachingInsight.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null;
  }
  async createInsight(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const root = await tx.coachingInsight.create({ data: { employeeId: String(input.employeeId), state: (input.state as never) ?? "DRAFT", version: 1 } });
      const revision = await tx.coachingInsightRevision.create({ data: { insightId: root.id, revision: 1, pattern: String(input.pattern), periodStartsAt: new Date(String(input.periodStartsAt)), periodEndsAt: new Date(String(input.periodEndsAt)), confidence: input.confidence as never, confidenceBasis: String(input.confidenceBasis), limitations: input.limitations as never, conflicts: (input.conflicts as never) ?? [], cannotConclude: String(input.cannotConclude), actionDraft: (input.actionDraft as never) ?? undefined, promptVersion: (input.promptVersion as string | undefined) ?? null, outputSchemaVersion: (input.outputSchemaVersion as string | undefined) ?? null, aiRunId: (input.aiRunId as string | undefined) ?? null, createdById: String(input.employeeId) } });
      await tx.coachingInsightSource.createMany({ data: ((input.sources as Array<{ sourceId: string; kind: string; excerpt?: string }>) ?? []).map((source, position) => ({ insightId: root.id, revisionId: revision.id, sourceId: source.sourceId, sourceKind: source.kind, excerpt: source.excerpt ?? null, position })) });
      await tx.coachingInsight.update({ where: { id: root.id }, data: { currentRevisionId: revision.id } });
      return { id: root.id, version: 1 };
    });
  }
  async appendInsightDecision(input: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const root = await tx.coachingInsight.findUnique({ where: { id: String(input.insightId) } });
      if (!root || root.employeeId !== input.employeeId) throw failure("AUTHZ_SCOPE", 403);
      if (root.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const existing = await tx.coachingInsightDecision.findUnique({ where: { idempotencyKey: String(input.idempotencyKey) } });
      if (existing) return;
      await tx.coachingInsightDecision.create({ data: { idempotencyKey: String(input.idempotencyKey), insightId: root.id, employeeId: root.employeeId, decision: input.decision as never, privateReason: (input.privateReason as string | null | undefined) ?? null, personalNote: (input.personalNote as string | null | undefined) ?? null, resultingVersion: root.version + 1 } });
      await tx.coachingInsight.update({ where: { id: root.id }, data: { state: "DECIDED", version: { increment: 1 } } });
    });
  }

  async find(actionId: string) { return (await this.database.developmentAction.findUnique({ where: { id: actionId } })) as unknown as { id: string; employeeId: string; privacy: "PRIVATE" | "SHARED"; state: string; version: number } | null; }
  async create(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.developmentActionTransition.findUnique({ where: { idempotencyKey: String(input.idempotencyKey) } });
      if (existing) return { id: existing.actionId, version: existing.resultingVersion };
      const action = await tx.developmentAction.create({ data: { employeeId: String(input.employeeId), insightId: (input.insightId as string | undefined) ?? null, privacy: input.privacy as never, state: "DRAFT", version: 1 } });
      const revision = await tx.developmentActionRevision.create({ data: revisionData(action.id, 1, input) as never });
      await tx.developmentAction.update({ where: { id: action.id }, data: { currentRevisionId: revision.id } });
      await tx.developmentActionTransition.create({ data: { idempotencyKey: String(input.idempotencyKey), actionId: action.id, fromState: "DRAFT", toState: "DRAFT", fromPrivacy: input.privacy as never, toPrivacy: input.privacy as never, actorId: String(input.employeeId), resultingVersion: 1 } });
      return { id: action.id, version: 1 };
    });
  }
  async revise(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const action = await tx.developmentAction.findUnique({ where: { id: String(input.actionId) } });
      if (!action || action.employeeId !== input.employeeId) throw failure("AUTHZ_ACTION", 403);
      if (action.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const revision = await tx.developmentActionRevision.create({ data: revisionData(action.id, action.version + 1, input) as never });
      await tx.developmentAction.update({ where: { id: action.id }, data: { currentRevisionId: revision.id, version: { increment: 1 } } });
      return { id: action.id, version: action.version + 1 };
    });
  }
  async changePrivacy(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const action = await tx.developmentAction.findUnique({ where: { id: String(input.actionId) } });
      if (!action || action.employeeId !== input.employeeId) throw failure("AUTHZ_ACTION", 403);
      if (action.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const existing = await tx.developmentActionTransition.findUnique({ where: { idempotencyKey: String(input.idempotencyKey) } });
      if (existing) return { id: action.id, version: existing.resultingVersion };
      await tx.developmentActionTransition.create({ data: { idempotencyKey: String(input.idempotencyKey), actionId: action.id, fromState: action.state, toState: action.state, fromPrivacy: action.privacy, toPrivacy: input.privacy as never, actorId: action.employeeId, resultingVersion: action.version + 1 } });
      await tx.developmentAction.update({ where: { id: action.id }, data: { privacy: input.privacy as never, version: { increment: 1 } } });
      return { id: action.id, version: action.version + 1 };
    });
  }
  async append(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const action = await tx.developmentAction.findUnique({ where: { id: String(event.actionId) } });
      if (!action) throw failure("DEVELOPMENT_ACTION_NOT_FOUND", 404);
      if (action.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const existing = await tx.developmentActionTransition.findUnique({ where: { idempotencyKey: String(event.idempotencyKey) } });
      if (existing) return;
      await tx.developmentActionTransition.create({ data: { idempotencyKey: String(event.idempotencyKey), actionId: action.id, fromState: action.state as never, toState: event.toState as never, fromPrivacy: action.privacy, toPrivacy: action.privacy, actorId: action.employeeId, resultingVersion: action.version + 1 } });
      await tx.developmentAction.update({ where: { id: action.id }, data: { state: event.toState as never, version: { increment: 1 } } });
    });
  }
  async isAuthorizedManager(employeeId: string, managerId: string) {
    return (await this.database.evaluationAssignment.count({ where: { employeeId, managerId, employee: { active: true } } })) > 0;
  }
  async appendSupport(entry: Record<string, unknown>) {
    const action = await this.database.developmentAction.findUnique({ where: { id: String(entry.actionId) } });
    if (!action || action.privacy !== "SHARED" || !(await this.isAuthorizedManager(action.employeeId, String(entry.managerId)))) throw failure("AUTHZ_SCOPE", 403);
    await this.database.managerSupportEntry.create({ data: { idempotencyKey: String(entry.idempotencyKey), actionId: action.id, managerId: String(entry.managerId), kind: entry.kind as never, body: String(entry.body), resourceUrl: (entry.resourceUrl as string | null) ?? null } });
  }
  async findPlan(planId: string) {
    return (await this.database.formalDevelopmentPlan.findUnique({ where: { id: planId }, include: { evidenceLinks: true } })) as unknown as { id: string; employeeId: string; managerId: string; state: string; version: number; evidenceLinks: readonly { confirmed: boolean }[] } | null;
  }
  async createPlan(event: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      if (!(await this.isAuthorizedManager(String(event.employeeId), String(event.managerId)))) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      const plan = await tx.formalDevelopmentPlan.create({ data: { employeeId: String(event.employeeId), managerId: String(event.managerId), actionId: (event.actionId as string | null) ?? null, state: "DRAFT", version: 1 } });
      const revision = await tx.formalDevelopmentPlanRevision.create({ data: planRevisionData(plan.id, 1, event) as never });
      await tx.formalDevelopmentPlan.update({ where: { id: plan.id }, data: { currentRevisionId: revision.id } });
      return { id: plan.id, version: 1 };
    });
  }
  async appendPlan(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const plan = await tx.formalDevelopmentPlan.findUnique({ where: { id: String(event.planId) } });
      if (!plan) throw failure("FORMAL_PLAN_NOT_FOUND", 404);
      if (plan.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      if (event.toState === "EMPLOYEE_APPROVED" && plan.employeeId !== event.actorId) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (event.toState === "MANAGER_AGREED" || event.toState === "ACTIVE") {
        if (plan.managerId !== event.actorId) throw failure("AUTHZ_SCOPE", 403);
      }
      if (event.toState === "COMPLETED" && plan.employeeId !== event.actorId && plan.managerId !== event.actorId) throw failure("AUTHZ_SCOPE", 403);
      const existing = await tx.formalDevelopmentPlanTransition.findUnique({ where: { idempotencyKey: String(event.idempotencyKey) } });
      if (existing) return;
      const toState = String(event.toState);
      const agreement = toState === "EMPLOYEE_APPROVED" || toState === "MANAGER_AGREED";
      if (agreement) await tx.formalDevelopmentPlanAgreement.create({ data: { idempotencyKey: String(event.idempotencyKey), planId: plan.id, revisionId: plan.currentRevisionId!, kind: toState as never, actorId: String(event.actorId) } });
      await tx.formalDevelopmentPlanTransition.create({ data: { idempotencyKey: String(event.idempotencyKey), planId: plan.id, fromState: plan.state, toState: toState as never, actorId: String(event.actorId), resultingVersion: plan.version + 1, reason: null } });
      await tx.formalDevelopmentPlan.update({ where: { id: plan.id }, data: { state: toState as never, version: { increment: 1 } } });
    });
  }
  async linkPlanEvidence(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const plan = await tx.formalDevelopmentPlan.findUnique({ where: { id: String(event.planId) } });
      if (!plan || plan.employeeId !== event.employeeId) throw failure("AUTHZ_SCOPE", 403);
      if (plan.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      // The evidence lifecycle remains authoritative: only its employee-confirmed record may be linked.
      const evidence = await tx.evidenceRecord.findUnique({ where: { id: String(event.evidenceId) }, select: { employeeId: true, confirmation: { select: { employeeId: true } } } });
      if (!evidence || evidence.employeeId !== event.employeeId || evidence.confirmation?.employeeId !== event.employeeId) throw failure("FORMAL_PLAN_CONFIRMED_EVIDENCE_REQUIRED", 409);
      await tx.formalDevelopmentPlanEvidenceLink.upsert({ where: { planId_evidenceId: { planId: plan.id, evidenceId: String(event.evidenceId) } }, create: { planId: plan.id, evidenceId: String(event.evidenceId), confirmed: true, confirmedAt: new Date(), confirmedById: String(event.employeeId) }, update: {} });
    });
  }
}
function revisionData(actionId: string, revision: number, input: Record<string, unknown>) { return { actionId, revision, title: String(input.title), objective: String(input.objective), expectedBenefit: String(input.expectedBenefit), activity: String(input.activity), completionEvidenceDefinition: String(input.completionEvidenceDefinition), targetDate: input.targetDate ? new Date(String(input.targetDate)) : null, projectId: (input.projectId as string | null) ?? null, researchId: (input.researchId as string | null) ?? null, workItemId: (input.workItemId as string | null) ?? null, employeeSelectedContext: (input.employeeSelectedContext as string | null) ?? null, createdById: String(input.employeeId) }; }
function planRevisionData(planId: string, revision: number, input: Record<string, unknown>) { return { planId, revision, developmentArea: String(input.developmentArea), reason: String(input.reason), expectedBehavior: String(input.expectedBehavior), activities: input.activities as never, followUpOwnerId: String(input.followUpOwnerId), targetDate: input.targetDate ? new Date(String(input.targetDate)) : null, completionEvidenceDefinition: String(input.completionEvidenceDefinition), sourceEvaluationAssignmentId: (input.sourceEvaluationAssignmentId as string | null) ?? null, createdById: String(input.employeeId) }; }
function failure(code: string, status: number) { return new AppError(code, "errors.coaching.invalid", status); }
