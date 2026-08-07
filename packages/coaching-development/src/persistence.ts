/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type AuditWriter = import("@evaluation/contracts").AuditWriter<unknown>;
type ActionLinkDatabase = Pick<
  Database,
  "coachingInsight" | "projectMember" | "researchRecord" | "workItem"
>;

/** Database-owned append-only persistence adapter for the Coaching & Development module. */
export class CoachingDevelopmentPersistence {
  constructor(
    private readonly database: Database,
    private readonly audit?: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async findInsight(id: string) {
    const root = await this.database.coachingInsight.findUnique({ where: { id } });
    if (root === null) return null;
    const [currentRevision, sources, decisions] = await Promise.all([
      root.currentRevisionId === null
        ? null
        : this.database.coachingInsightRevision.findUnique({ where: { id: root.currentRevisionId } }),
      root.currentRevisionId === null
        ? []
        : this.database.coachingInsightSource.findMany({
            where: { insightId: root.id, revisionId: root.currentRevisionId },
            orderBy: { position: "asc" },
          }),
      this.database.coachingInsightDecision.findMany({
        where: { insightId: root.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { ...root, currentRevision, sources, decisions } as unknown as Record<string, unknown>;
  }
  async createInsight(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const root = await tx.coachingInsight.create({
        data: {
          employeeId: String(input.employeeId),
          state: (input.state as never) ?? "DRAFT",
          version: 1,
        },
      });
      const revision = await tx.coachingInsightRevision.create({
        data: {
          insightId: root.id,
          revision: 1,
          pattern: String(input.pattern),
          periodStartsAt: new Date(String(input.periodStartsAt)),
          periodEndsAt: new Date(String(input.periodEndsAt)),
          confidence: input.confidence as never,
          confidenceBasis: String(input.confidenceBasis),
          limitations: input.limitations as never,
          conflicts: (input.conflicts as never) ?? [],
          cannotConclude: String(input.cannotConclude),
          actionDraft: (input.actionDraft as never) ?? undefined,
          promptVersion: (input.promptVersion as string | undefined) ?? null,
          outputSchemaVersion: (input.outputSchemaVersion as string | undefined) ?? null,
          aiRunId: (input.aiRunId as string | undefined) ?? null,
          createdById: String(input.employeeId),
        },
      });
      await tx.coachingInsightSource.createMany({
        data: (
          (input.sources as Array<{ sourceId: string; kind: string; excerpt?: string }>) ?? []
        ).map((source, position) => ({
          insightId: root.id,
          revisionId: revision.id,
          sourceId: source.sourceId,
          sourceKind: source.kind,
          excerpt: source.excerpt ?? null,
          position,
        })),
      });
      await tx.coachingInsight.update({
        where: { id: root.id },
        data: { currentRevisionId: revision.id },
      });
      return { id: root.id, version: 1 };
    });
  }
  async appendInsightDecision(input: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const existing = await tx.coachingInsightDecision.findUnique({
        where: { idempotencyKey: String(input.idempotencyKey) },
      });
      if (existing) return;
      const root = await tx.coachingInsight.findUnique({ where: { id: String(input.insightId) } });
      if (!root || root.employeeId !== input.employeeId) throw failure("AUTHZ_SCOPE", 403);
      if (root.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const updated = await tx.coachingInsight.updateMany({
        where: { id: root.id, version: root.version },
        data: { state: "DECIDED", version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      await tx.coachingInsightDecision.create({
        data: {
          idempotencyKey: String(input.idempotencyKey),
          insightId: root.id,
          employeeId: root.employeeId,
          decision: input.decision as never,
          privateReason: (input.privateReason as string | null | undefined) ?? null,
          personalNote: (input.personalNote as string | null | undefined) ?? null,
          resultingVersion: root.version + 1,
        },
      });
      await this.auditEvent(tx, input, "coaching.insight.decided", root.employeeId, root.id, {
        decision: String(input.decision),
        resultingVersion: root.version + 1,
      });
    });
  }
  async findInsightDecisionByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Record<string, unknown> | null> {
    return this.database.coachingInsightDecision.findUnique({
      where: { idempotencyKey },
    }) as unknown as Promise<Record<string, unknown> | null>;
  }

  async find(actionId: string) {
    const action = await this.database.developmentAction.findUnique({ where: { id: actionId } });
    if (action === null) return null;
    const currentRevision =
      action.currentRevisionId === null
        ? null
        : await this.database.developmentActionRevision.findUnique({
            where: { id: action.currentRevisionId },
          });
    return { ...action, currentRevision } as unknown as {
      id: string;
      employeeId: string;
      privacy: "PRIVATE" | "SHARED";
      state: string;
      version: number;
    };
  }
  async create(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.developmentActionTransition.findUnique({
        where: { idempotencyKey: String(input.idempotencyKey) },
      });
      if (existing) return { id: existing.actionId, version: existing.resultingVersion };
      await validateActionLinks(tx, input, this.now());
      const action = await tx.developmentAction.create({
        data: {
          employeeId: String(input.employeeId),
          insightId: (input.insightId as string | undefined) ?? null,
          privacy: input.privacy as never,
          state: "DRAFT",
          version: 1,
        },
      });
      const revision = await tx.developmentActionRevision.create({
        data: { ...revisionData(action.id, 1, input), idempotencyKey: String(input.idempotencyKey) } as never,
      });
      await tx.developmentAction.update({
        where: { id: action.id },
        data: { currentRevisionId: revision.id },
      });
      await tx.developmentActionTransition.create({
        data: {
          idempotencyKey: String(input.idempotencyKey),
          actionId: action.id,
          fromState: "DRAFT",
          toState: "DRAFT",
          fromPrivacy: input.privacy as never,
          toPrivacy: input.privacy as never,
          actorId: String(input.employeeId),
          resultingVersion: 1,
        },
      });
      return { id: action.id, version: 1 };
    });
  }
  async revise(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.developmentActionRevision.findUnique({
        where: { idempotencyKey: String(input.idempotencyKey) },
      });
      if (existing) return { id: existing.actionId, version: existing.revision };
      const action = await tx.developmentAction.findUnique({
        where: { id: String(input.actionId) },
      });
      if (!action || action.employeeId !== input.employeeId) throw failure("AUTHZ_ACTION", 403);
      if (action.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      await validateActionLinks(tx, input, this.now());
      const updated = await tx.developmentAction.updateMany({
        where: { id: action.id, version: action.version, state: action.state, privacy: action.privacy },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      const revision = await tx.developmentActionRevision.create({
        data: {
          ...revisionData(action.id, action.version + 1, input),
          idempotencyKey: String(input.idempotencyKey),
        } as never,
      });
      await tx.developmentAction.update({ where: { id: action.id }, data: { currentRevisionId: revision.id } });
      return { id: action.id, version: action.version + 1 };
    });
  }
  async changePrivacy(input: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.developmentActionTransition.findUnique({
        where: { idempotencyKey: String(input.idempotencyKey) },
      });
      if (existing) return { id: existing.actionId, version: existing.resultingVersion };
      const action = await tx.developmentAction.findUnique({
        where: { id: String(input.actionId) },
      });
      if (!action || action.employeeId !== input.employeeId) throw failure("AUTHZ_ACTION", 403);
      if (action.version !== Number(input.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const updated = await tx.developmentAction.updateMany({
        where: { id: action.id, version: action.version, privacy: action.privacy },
        data: { privacy: input.privacy as never, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      await tx.developmentActionTransition.create({
        data: {
          idempotencyKey: String(input.idempotencyKey),
          actionId: action.id,
          fromState: action.state,
          toState: action.state,
          fromPrivacy: action.privacy,
          toPrivacy: input.privacy as never,
          actorId: action.employeeId,
          resultingVersion: action.version + 1,
        },
      });
      await this.auditEvent(tx, input, "coaching.action.privacy_changed", action.employeeId, action.id, {
        fromPrivacy: action.privacy,
        toPrivacy: String(input.privacy),
      });
      return { id: action.id, version: action.version + 1 };
    });
  }
  async append(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const existing = await tx.developmentActionTransition.findUnique({
        where: { idempotencyKey: String(event.idempotencyKey) },
      });
      if (existing) return;
      const action = await tx.developmentAction.findUnique({
        where: { id: String(event.actionId) },
      });
      if (!action) throw failure("DEVELOPMENT_ACTION_NOT_FOUND", 404);
      if (action.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const updated = await tx.developmentAction.updateMany({
        where: { id: action.id, version: action.version, state: action.state },
        data: { state: event.toState as never, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      await tx.developmentActionTransition.create({
        data: {
          idempotencyKey: String(event.idempotencyKey),
          actionId: action.id,
          fromState: action.state as never,
          toState: event.toState as never,
          fromPrivacy: action.privacy,
          toPrivacy: action.privacy,
          actorId: action.employeeId,
          resultingVersion: action.version + 1,
        },
      });
    });
  }
  async findIdempotentAction(idempotencyKey: string): Promise<{
    actionId: string;
    resultingVersion: number;
    toState?: string;
  } | null> {
    const [transition, revision] = await Promise.all([
      this.database.developmentActionTransition.findUnique({ where: { idempotencyKey } }),
      this.database.developmentActionRevision.findUnique({ where: { idempotencyKey } }),
    ]);
    if (transition)
      return {
        actionId: transition.actionId,
        resultingVersion: transition.resultingVersion,
        toState: transition.toState,
      };
    if (revision)
      return { actionId: revision.actionId, resultingVersion: revision.revision };
    return null;
  }
  async isAuthorizedManager(employeeId: string, managerId: string) {
    return this.hasCurrentManagerRelationship(this.database, employeeId, managerId);
  }
  async appendSupport(entry: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const existing = await tx.managerSupportEntry.findUnique({
        where: { idempotencyKey: String(entry.idempotencyKey) },
      });
      if (existing) return;
      const rows = await tx.$queryRaw<Array<{ id: string; employeeId: string; privacy: string }>>`
        SELECT "id", "employeeId", "privacy"::text
        FROM "DevelopmentAction"
        WHERE "id" = ${String(entry.actionId)}::uuid
        FOR UPDATE
      `;
      const action = rows[0];
      if (
        !action ||
        action.privacy !== "SHARED" ||
        !(await this.hasCurrentManagerRelationship(tx, action.employeeId, String(entry.managerId)))
      )
        throw failure("AUTHZ_SCOPE", 403);
      await tx.managerSupportEntry.create({
        data: {
          idempotencyKey: String(entry.idempotencyKey),
          actionId: action.id,
          managerId: String(entry.managerId),
          kind: entry.kind as never,
          body: String(entry.body),
          resourceUrl: (entry.resourceUrl as string | null) ?? null,
        },
      });
      await this.auditEvent(tx, entry, "coaching.action.support_added", action.employeeId, action.id, {
        kind: String(entry.kind),
      });
    });
  }
  async findPlan(planId: string) {
    const plan = await this.database.formalDevelopmentPlan.findUnique({
      where: { id: planId },
      include: { evidenceLinks: true, agreements: { orderBy: { createdAt: "asc" } } },
    });
    if (plan === null) return null;
    const currentRevision =
      plan.currentRevisionId === null
        ? null
        : await this.database.formalDevelopmentPlanRevision.findUnique({
            where: { id: plan.currentRevisionId },
          });
    return { ...plan, currentRevision } as unknown as {
      id: string;
      employeeId: string;
      managerId: string;
      state: string;
      version: number;
      evidenceLinks: readonly { confirmed: boolean }[];
    };
  }
  async createPlan(event: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.formalDevelopmentPlan.findUnique({
        where: { idempotencyKey: String(event.idempotencyKey) },
      });
      if (existing) return { id: existing.id, version: 1 };
      if (
        !(await this.hasCurrentManagerRelationship(
          tx,
          String(event.employeeId),
          String(event.managerId),
        ))
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (event.actionId) {
        const action = await tx.developmentAction.findUnique({
          where: { id: String(event.actionId) },
          select: { employeeId: true },
        });
        if (!action || action.employeeId !== event.employeeId) throw failure("AUTHZ_SCOPE", 403);
      }
      if (
        event.followUpOwnerId !== event.employeeId &&
        event.followUpOwnerId !== event.managerId
      )
        throw failure("AUTHZ_SCOPE", 403);
      if (event.sourceEvaluationAssignmentId) {
        const assignment = await tx.evaluationAssignment.findUnique({
          where: { id: String(event.sourceEvaluationAssignmentId) },
          select: { employeeId: true, managerId: true },
        });
        if (
          !assignment ||
          assignment.employeeId !== event.employeeId ||
          assignment.managerId !== event.managerId
        )
          throw failure("AUTHZ_SCOPE", 403);
      }
      const plan = await tx.formalDevelopmentPlan.create({
        data: {
          idempotencyKey: String(event.idempotencyKey),
          employeeId: String(event.employeeId),
          managerId: String(event.managerId),
          actionId: (event.actionId as string | null) ?? null,
          state: "DRAFT",
          version: 1,
        },
      });
      const revision = await tx.formalDevelopmentPlanRevision.create({
        data: {
          ...planRevisionData(plan.id, 1, event),
          idempotencyKey: String(event.idempotencyKey),
        } as never,
      });
      await tx.formalDevelopmentPlan.update({
        where: { id: plan.id },
        data: { currentRevisionId: revision.id },
      });
      return { id: plan.id, version: 1 };
    });
  }
  async appendPlan(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const existing = await tx.formalDevelopmentPlanTransition.findUnique({
        where: { idempotencyKey: String(event.idempotencyKey) },
      });
      if (existing) return;
      const plan = await tx.formalDevelopmentPlan.findUnique({
        where: { id: String(event.planId) },
      });
      if (!plan) throw failure("FORMAL_PLAN_NOT_FOUND", 404);
      if (plan.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      if (event.toState === "EMPLOYEE_APPROVED" && plan.employeeId !== event.actorId) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (event.toState === "MANAGER_AGREED" || event.toState === "ACTIVE") {
        if (plan.managerId !== event.actorId) throw failure("AUTHZ_SCOPE", 403);
      }
      if (
        event.toState === "COMPLETED" &&
        plan.employeeId !== event.actorId &&
        plan.managerId !== event.actorId
      )
        throw failure("AUTHZ_SCOPE", 403);
      const toState = String(event.toState);
      const updated = await tx.formalDevelopmentPlan.updateMany({
        where: { id: plan.id, version: plan.version, state: plan.state },
        data: { state: toState as never, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      const agreement = toState === "EMPLOYEE_APPROVED" || toState === "MANAGER_AGREED";
      if (agreement)
        await tx.formalDevelopmentPlanAgreement.create({
          data: {
            idempotencyKey: String(event.idempotencyKey),
            planId: plan.id,
            revisionId: plan.currentRevisionId!,
            kind: toState as never,
            actorId: String(event.actorId),
          },
        });
      await tx.formalDevelopmentPlanTransition.create({
        data: {
          idempotencyKey: String(event.idempotencyKey),
          planId: plan.id,
          fromState: plan.state,
          toState: toState as never,
          actorId: String(event.actorId),
          resultingVersion: plan.version + 1,
          reason: (event.reason as string | null | undefined) ?? null,
        },
      });
      if (agreement || toState === "COMPLETED")
        await this.auditEvent(
          tx,
          event,
          agreement ? "coaching.plan.agreement_recorded" : "coaching.plan.completed",
          plan.employeeId,
          plan.id,
          { transition: toState, resultingVersion: plan.version + 1 },
        );
    });
  }
  async linkPlanEvidence(event: Record<string, unknown>) {
    await this.database.$transaction(async (tx) => {
      const plan = await tx.formalDevelopmentPlan.findUnique({
        where: { id: String(event.planId) },
      });
      if (!plan || plan.employeeId !== event.employeeId) throw failure("AUTHZ_SCOPE", 403);
      if (plan.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      // The evidence lifecycle remains authoritative: only its employee-confirmed record may be linked.
      const evidence = await tx.evidenceRecord.findUnique({
        where: { id: String(event.evidenceId) },
        select: { employeeId: true, confirmation: { select: { employeeId: true } } },
      });
      if (
        !evidence ||
        evidence.employeeId !== event.employeeId ||
        evidence.confirmation?.employeeId !== event.employeeId
      )
        throw failure("FORMAL_PLAN_CONFIRMED_EVIDENCE_REQUIRED", 409);
      const existing = await tx.formalDevelopmentPlanEvidenceLink.findUnique({
        where: { planId_evidenceId: { planId: plan.id, evidenceId: String(event.evidenceId) } },
      });
      if (!existing)
        await tx.formalDevelopmentPlanEvidenceLink.create({
          data: {
          planId: plan.id,
          evidenceId: String(event.evidenceId),
          confirmed: true,
          confirmedAt: new Date(),
          confirmedById: String(event.employeeId),
          },
        });
    });
  }

  async revisePlan(event: Record<string, unknown>) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.formalDevelopmentPlanRevision.findUnique({
        where: { idempotencyKey: String(event.idempotencyKey) },
      });
      if (existing) return { id: existing.planId, state: "DRAFT", version: existing.revision };
      const plan = await tx.formalDevelopmentPlan.findUnique({ where: { id: String(event.planId) } });
      if (!plan || plan.employeeId !== event.employeeId) throw failure("AUTHZ_SCOPE", 403);
      if (plan.version !== Number(event.expectedVersion)) throw failure("VERSION_CONFLICT", 409);
      const updated = await tx.formalDevelopmentPlan.updateMany({
        where: { id: plan.id, version: plan.version, state: plan.state },
        data: { state: "DRAFT", version: { increment: 1 } },
      });
      if (updated.count !== 1) throw failure("VERSION_CONFLICT", 409);
      const revision = await tx.formalDevelopmentPlanRevision.create({
        data: {
          ...planRevisionData(plan.id, plan.version + 1, event),
          idempotencyKey: String(event.idempotencyKey),
        } as never,
      });
      await tx.formalDevelopmentPlan.update({
        where: { id: plan.id },
        data: { currentRevisionId: revision.id },
      });
      await tx.formalDevelopmentPlanTransition.create({
        data: {
          idempotencyKey: String(event.idempotencyKey),
          planId: plan.id,
          fromState: plan.state,
          toState: "DRAFT",
          actorId: plan.employeeId,
          resultingVersion: plan.version + 1,
          reason: "Employee revised the plan; prior approvals no longer apply to the current revision.",
        },
      });
      return { id: plan.id, state: "DRAFT", version: plan.version + 1 };
    });
  }

  async findIdempotentPlan(idempotencyKey: string): Promise<{
    planId: string;
    resultingVersion: number;
    toState?: string;
  } | null> {
    const [plan, transition, revision] = await Promise.all([
      this.database.formalDevelopmentPlan.findUnique({ where: { idempotencyKey } }),
      this.database.formalDevelopmentPlanTransition.findUnique({ where: { idempotencyKey } }),
      this.database.formalDevelopmentPlanRevision.findUnique({ where: { idempotencyKey } }),
    ]);
    if (transition)
      return {
        planId: transition.planId,
        resultingVersion: transition.resultingVersion,
        toState: transition.toState,
      };
    if (revision)
      return { planId: revision.planId, resultingVersion: revision.revision, toState: "DRAFT" };
    if (plan) return { planId: plan.id, resultingVersion: 1, toState: "DRAFT" };
    return null;
  }

  async auditRead(event: Record<string, unknown>) {
    if (!this.audit) return;
    await this.database.$transaction((tx) =>
      this.auditEvent(
        tx,
        event,
        String(event.eventType),
        String(event.employeeId),
        String(event.actionId ?? event.planId ?? event.insightId),
        { projection: String(event.eventType).split(".").at(-1) },
      ),
    );
  }

  private async hasCurrentManagerRelationship(
    client: Pick<Database, "evaluationAssignment">,
    employeeId: string,
    managerId: string,
  ) {
    const at = this.now();
    return (
      (await client.evaluationAssignment.count({
        where: {
          employeeId,
          managerId,
          eligibilityState: "ELIGIBLE",
          employee: { active: true },
          manager: { active: true },
          cycle: {
            startsAt: { lte: at },
            endsAt: { gte: at },
            state: { notIn: ["CLOSED", "CANCELLED"] },
          },
        },
      })) > 0
    );
  }

  private async auditEvent(
    transaction: unknown,
    input: Record<string, unknown>,
    eventType: string,
    employeeId: string,
    targetId: string,
    safeDiff: Record<string, unknown>,
  ) {
    if (!this.audit) return;
    const actorId = String(input.actorId ?? input.employeeId ?? input.managerId);
    await this.audit.append(transaction, {
      eventType,
      actor: { kind: "human", id: actorId },
      effectiveSubjectId: employeeId,
      scopeType: "system",
      scopeId: employeeId,
      targetType: eventType.includes("plan") ? "formal_development_plan" : "coaching_development",
      targetId,
      safeDiff,
      correlationId: String(input.correlationId ?? input.idempotencyKey ?? crypto.randomUUID()),
      source: "api",
    });
  }
}
function revisionData(actionId: string, revision: number, input: Record<string, unknown>) {
  return {
    actionId,
    revision,
    title: String(input.title),
    objective: String(input.objective),
    expectedBenefit: String(input.expectedBenefit),
    activity: String(input.activity),
    completionEvidenceDefinition: String(input.completionEvidenceDefinition),
    targetDate: input.targetDate ? new Date(String(input.targetDate)) : null,
    projectId: (input.projectId as string | null) ?? null,
    researchId: (input.researchId as string | null) ?? null,
    workItemId: (input.workItemId as string | null) ?? null,
    employeeSelectedContext: (input.employeeSelectedContext as string | null) ?? null,
    createdById: String(input.employeeId),
  };
}
async function validateActionLinks(
  transaction: ActionLinkDatabase,
  input: Record<string, unknown>,
  at: Date,
) {
  const employeeId = String(input.employeeId);
  const insightId = (input.insightId as string | null | undefined) ?? null;
  if (insightId !== null) {
    const insight = await transaction.coachingInsight.findFirst({
      where: { id: insightId, employeeId },
      select: { id: true },
    });
    if (!insight) throw failure("AUTHZ_SCOPE", 403);
  }

  const projectId = (input.projectId as string | null | undefined) ?? null;
  if (projectId !== null) {
    const membership = await transaction.projectMember.findFirst({
      where: {
        projectId,
        employeeId,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gte: at } }],
      },
      select: { id: true },
    });
    if (!membership) throw failure("AUTHZ_SCOPE", 403);
  }

  const researchId = (input.researchId as string | null | undefined) ?? null;
  if (researchId !== null) {
    const research = await transaction.researchRecord.findFirst({
      where: { id: researchId, ownerId: employeeId },
      select: { id: true },
    });
    if (!research) throw failure("AUTHZ_SCOPE", 403);
  }

  const workItemId = (input.workItemId as string | null | undefined) ?? null;
  if (workItemId !== null) {
    const workItem = await transaction.workItem.findFirst({
      where: {
        id: workItemId,
        OR: [
          { assigneeId: employeeId },
          {
            participants: {
              some: {
                employeeId,
                startsAt: { lte: at },
                OR: [{ endsAt: null }, { endsAt: { gte: at } }],
              },
            },
          },
          {
            project: {
              members: {
                some: {
                  employeeId,
                  startsAt: { lte: at },
                  OR: [{ endsAt: null }, { endsAt: { gte: at } }],
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!workItem) throw failure("AUTHZ_SCOPE", 403);
  }
}
function planRevisionData(planId: string, revision: number, input: Record<string, unknown>) {
  return {
    planId,
    revision,
    developmentArea: String(input.developmentArea),
    reason: String(input.reason),
    expectedBehavior: String(input.expectedBehavior),
    activities: input.activities as never,
    followUpOwnerId: String(input.followUpOwnerId),
    targetDate: input.targetDate ? new Date(String(input.targetDate)) : null,
    completionEvidenceDefinition: String(input.completionEvidenceDefinition),
    sourceEvaluationAssignmentId: (input.sourceEvaluationAssignmentId as string | null) ?? null,
    createdById: String(input.employeeId),
  };
}
function failure(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
