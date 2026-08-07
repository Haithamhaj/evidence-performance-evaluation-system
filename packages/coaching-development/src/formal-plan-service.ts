/* eslint-disable no-unused-vars */
import {
  AppError,
  CreateFormalPlanInputSchema,
  EndFormalPlanInputSchema,
  LinkFormalPlanEvidenceInputSchema,
  ReviseFormalPlanInputSchema,
} from "@evaluation/contracts";

type Plan = Readonly<{
  id: string;
  employeeId: string;
  managerId: string;
  state: string;
  version: number;
  evidenceLinks: readonly { confirmed: boolean }[];
  currentRevision?: Readonly<Record<string, unknown>> | null;
  agreements?: readonly Readonly<Record<string, unknown>>[];
}>;
type Store = Readonly<{
  find(planId: string): Promise<Plan | null>;
  append(event: Record<string, unknown>): Promise<void>;
  create?(event: Record<string, unknown>): Promise<{ id: string; version: number }>;
  revise?(event: Record<string, unknown>): Promise<{ id: string; state: string; version: number }>;
  linkEvidence?(event: Record<string, unknown>): Promise<void>;
  auditRead?(event: Record<string, unknown>): Promise<void>;
  findIdempotentPlan?(idempotencyKey: string): Promise<Readonly<{
    planId: string;
    resultingVersion: number;
    toState?: string;
  }> | null>;
}>;
export class FormalDevelopmentPlanService {
  constructor(private readonly store: Store) {}
  async create(input: unknown) {
    const parsed = CreateFormalPlanInputSchema.parse(input);
    const replay = await this.store.findIdempotentPlan?.(parsed.idempotencyKey);
    if (replay) return { id: replay.planId, version: replay.resultingVersion };
    if (!this.store.create) throw fail("FORMAL_PLAN_STORE_UNAVAILABLE", 500);
    return this.store.create(parsed);
  }
  async read(input: Readonly<{ planId: string; actorId: string; correlationId?: string }>) {
    const plan = await this.require(input.planId);
    if (plan.employeeId !== input.actorId && plan.managerId !== input.actorId)
      throw fail("AUTHZ_SCOPE", 403);
    await this.store.auditRead?.({
      ...input,
      employeeId: plan.employeeId,
      eventType: "coaching.plan.participant_read",
    });
    const { currentRevision, ...root } = plan;
    if (!currentRevision) return root;
    return {
      ...root,
      developmentArea: currentRevision.developmentArea,
      reason: currentRevision.reason,
      expectedBehavior: currentRevision.expectedBehavior,
      activities: currentRevision.activities,
      followUpOwnerId: currentRevision.followUpOwnerId,
      targetDate: currentRevision.targetDate,
      completionEvidenceDefinition: currentRevision.completionEvidenceDefinition,
      sourceEvaluationAssignmentId: currentRevision.sourceEvaluationAssignmentId,
      revision: currentRevision.revision,
    };
  }
  async linkEvidence(input: unknown) {
    const parsed = LinkFormalPlanEvidenceInputSchema.parse(input);
    const plan = await this.require(parsed.planId);
    if (plan.employeeId !== parsed.employeeId) throw fail("AUTHZ_SCOPE", 403);
    if (plan.version !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    if (!this.store.linkEvidence) throw fail("FORMAL_PLAN_STORE_UNAVAILABLE", 500);
    await this.store.linkEvidence(parsed);
  }
  async revise(input: unknown) {
    const parsed = ReviseFormalPlanInputSchema.parse(input);
    const replay = await this.replay(parsed.idempotencyKey, parsed.planId);
    if (replay)
      return { id: replay.planId, state: replay.toState ?? "DRAFT", version: replay.resultingVersion };
    const plan = await this.require(parsed.planId);
    if (plan.employeeId !== parsed.employeeId) throw fail("AUTHZ_SCOPE", 403);
    if (plan.version !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    if (!this.store.revise) throw fail("FORMAL_PLAN_STORE_UNAVAILABLE", 500);
    return this.store.revise({ ...parsed, fromState: plan.state, toState: "DRAFT" });
  }
  async approve(
    input: Readonly<{
      planId: string;
      actorId: string;
      expectedVersion: number;
      idempotencyKey: string;
    }>,
  ) {
    const replay = await this.replay(input.idempotencyKey, input.planId);
    if (replay)
      return { planId: replay.planId, state: "EMPLOYEE_APPROVED" as const, version: replay.resultingVersion };
    const plan = await this.require(input.planId);
    if (plan.employeeId !== input.actorId) throw fail("AUTHZ_SCOPE", 403);
    if (plan.state !== "DRAFT") throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    await this.store.append({
      ...input,
      fromState: plan.state,
      toState: "EMPLOYEE_APPROVED",
      resultingVersion: plan.version + 1,
    });
    return { planId: plan.id, state: "EMPLOYEE_APPROVED" as const, version: plan.version + 1 };
  }
  async agree(
    input: Readonly<{
      planId: string;
      actorId: string;
      expectedVersion: number;
      idempotencyKey: string;
    }>,
  ) {
    const replay = await this.replay(input.idempotencyKey, input.planId);
    if (replay)
      return { planId: replay.planId, state: "MANAGER_AGREED" as const, version: replay.resultingVersion };
    const plan = await this.require(input.planId);
    if (plan.managerId !== input.actorId) throw fail("AUTHZ_SCOPE", 403);
    if (plan.state !== "EMPLOYEE_APPROVED") throw fail("EMPLOYEE_APPROVAL_REQUIRED", 409);
    await this.store.append({
      ...input,
      fromState: plan.state,
      toState: "MANAGER_AGREED",
      resultingVersion: plan.version + 1,
    });
    return { planId: plan.id, state: "MANAGER_AGREED" as const, version: plan.version + 1 };
  }
  async activate(
    input: Readonly<{
      planId: string;
      actorId: string;
      expectedVersion: number;
      idempotencyKey: string;
    }>,
  ) {
    const replay = await this.replay(input.idempotencyKey, input.planId);
    if (replay)
      return { planId: replay.planId, state: "ACTIVE" as const, version: replay.resultingVersion };
    const plan = await this.require(input.planId);
    if (plan.managerId !== input.actorId) throw fail("AUTHZ_SCOPE", 403);
    if (plan.state === "DRAFT") throw fail("EMPLOYEE_APPROVAL_REQUIRED", 409);
    if (plan.state !== "MANAGER_AGREED") throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    await this.store.append({
      ...input,
      fromState: plan.state,
      toState: "ACTIVE",
      resultingVersion: plan.version + 1,
    });
    return { planId: plan.id, state: "ACTIVE" as const, version: plan.version + 1 };
  }
  async complete(
    input: Readonly<{
      planId: string;
      actorId: string;
      expectedVersion: number;
      idempotencyKey: string;
    }>,
  ) {
    const replay = await this.replay(input.idempotencyKey, input.planId);
    if (replay)
      return { planId: replay.planId, state: "COMPLETED" as const, version: replay.resultingVersion };
    const plan = await this.require(input.planId);
    if (plan.employeeId !== input.actorId && plan.managerId !== input.actorId)
      throw fail("AUTHZ_SCOPE", 403);
    if (plan.state !== "ACTIVE") throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    if (plan.evidenceLinks.length === 0 || !plan.evidenceLinks.every((link) => link.confirmed))
      throw fail("FORMAL_PLAN_CONFIRMED_EVIDENCE_REQUIRED", 409);
    await this.store.append({
      ...input,
      fromState: plan.state,
      toState: "COMPLETED",
      resultingVersion: plan.version + 1,
    });
    return { planId: plan.id, state: "COMPLETED" as const, version: plan.version + 1 };
  }
  async withdraw(input: unknown) {
    const parsed = EndFormalPlanInputSchema.parse(input);
    const replay = await this.replay(parsed.idempotencyKey, parsed.planId);
    if (replay)
      return { planId: replay.planId, state: "WITHDRAWN" as const, version: replay.resultingVersion };
    const plan = await this.require(parsed.planId);
    if (plan.employeeId !== parsed.actorId) throw fail("AUTHZ_SCOPE", 403);
    if (["COMPLETED", "CLOSED", "WITHDRAWN"].includes(plan.state))
      throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    await this.store.append({ ...parsed, fromState: plan.state, toState: "WITHDRAWN" });
    return { planId: plan.id, state: "WITHDRAWN" as const, version: plan.version + 1 };
  }
  async close(input: unknown) {
    const parsed = EndFormalPlanInputSchema.parse(input);
    const replay = await this.replay(parsed.idempotencyKey, parsed.planId);
    if (replay)
      return { planId: replay.planId, state: "CLOSED" as const, version: replay.resultingVersion };
    const plan = await this.require(parsed.planId);
    if (plan.employeeId !== parsed.actorId && plan.managerId !== parsed.actorId)
      throw fail("AUTHZ_SCOPE", 403);
    if (["CLOSED", "WITHDRAWN"].includes(plan.state))
      throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    await this.store.append({ ...parsed, fromState: plan.state, toState: "CLOSED" });
    return { planId: plan.id, state: "CLOSED" as const, version: plan.version + 1 };
  }
  private async require(id: string) {
    const plan = await this.store.find(id);
    if (!plan) throw fail("FORMAL_PLAN_NOT_FOUND", 404);
    return plan;
  }
  private async replay(idempotencyKey: string, planId: string) {
    const replay = await this.store.findIdempotentPlan?.(idempotencyKey);
    if (replay && replay.planId !== planId) throw fail("IDEMPOTENCY_CONFLICT", 409);
    return replay;
  }
}
function fail(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
