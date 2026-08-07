/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";

type Plan = Readonly<{
  id: string;
  employeeId: string;
  managerId: string;
  state: string;
  version: number;
  evidenceLinks: readonly { confirmed: boolean }[];
}>;
type Store = Readonly<{
  find(planId: string): Promise<Plan | null>;
  append(event: Record<string, unknown>): Promise<void>;
}>;
export class FormalDevelopmentPlanService {
  constructor(private readonly store: Store) {}
  async approve(
    input: Readonly<{
      planId: string;
      actorId: string;
      expectedVersion: number;
      idempotencyKey: string;
    }>,
  ) {
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
    const plan = await this.require(input.planId);
    if (plan.employeeId !== input.actorId && plan.managerId !== input.actorId)
      throw fail("AUTHZ_SCOPE", 403);
    if (plan.state !== "ACTIVE") throw fail("FORMAL_PLAN_TRANSITION_INVALID", 409);
    if (!plan.evidenceLinks.every((link) => link.confirmed))
      throw fail("FORMAL_PLAN_CONFIRMED_EVIDENCE_REQUIRED", 409);
    await this.store.append({
      ...input,
      fromState: plan.state,
      toState: "COMPLETED",
      resultingVersion: plan.version + 1,
    });
    return { planId: plan.id, state: "COMPLETED" as const, version: plan.version + 1 };
  }
  private async require(id: string) {
    const plan = await this.store.find(id);
    if (!plan) throw fail("FORMAL_PLAN_NOT_FOUND", 404);
    return plan;
  }
}
function fail(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
